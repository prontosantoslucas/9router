const fs = require("fs");
const path = require("path");
const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");

const dataDir = process.env.DATA_DIR || path.join(require("os").homedir(), ".9router");
const CREDS_FILE = path.join(dataDir, "agent", "telegram-userbot.json");

// ────────────────────────────────────────────────────────────────
// Map de autenticações pendentes (phone → { client, phoneCodeHash, apiId, apiHash, phone, timer })
// Cada entrada expira em 5 minutos se não for completada.
// ────────────────────────────────────────────────────────────────
const PENDING_TTL_MS = 5 * 60 * 1000;
const pendingAuths = new Map();

// ────────────────────────────────────────────────────────────────
// Persistência de credenciais em disco
// ────────────────────────────────────────────────────────────────
function getSavedCredentials() {
  try {
    if (fs.existsSync(CREDS_FILE)) {
      return JSON.parse(fs.readFileSync(CREDS_FILE, "utf8"));
    }
  } catch (err) {
    console.error("[UserbotAuth] Erro ao ler credenciais:", err.message);
  }
  return null;
}

function saveCredentials({ sessionString, apiId, apiHash, phone }) {
  try {
    fs.mkdirSync(path.dirname(CREDS_FILE), { recursive: true });
    fs.writeFileSync(
      CREDS_FILE,
      JSON.stringify({ sessionString, apiId, apiHash, phone }, null, 2),
      "utf8"
    );
    return true;
  } catch (err) {
    console.error("[UserbotAuth] Erro ao salvar credenciais:", err.message);
    return false;
  }
}

function deleteCredentials() {
  try {
    if (fs.existsSync(CREDS_FILE)) fs.unlinkSync(CREDS_FILE);
  } catch {}
}

// Compatibilidade com o legado — getSavedSession retorna a StringSession ou ""
function getSavedSession() {
  const creds = getSavedCredentials();
  return creds?.sessionString || "";
}

function saveSession(sessionString, opts = {}) {
  const existing = getSavedCredentials() || {};
  return saveCredentials({
    sessionString,
    apiId: opts.apiId || existing.apiId || "",
    apiHash: opts.apiHash || existing.apiHash || "",
    phone: opts.phone || existing.phone || "",
  });
}

// ────────────────────────────────────────────────────────────────
// Etapa 1: start-auth — Envia código OTP via MTProto
// ────────────────────────────────────────────────────────────────
async function startAuth({ apiId, apiHash, phoneNumber }) {
  if (!apiId || !apiHash || !phoneNumber) {
    throw new Error("apiId, apiHash e phoneNumber são obrigatórios");
  }

  const numericApiId = parseInt(apiId, 10);
  if (isNaN(numericApiId)) throw new Error("apiId deve ser numérico");

  // Limpa pendente anterior do mesmo telefone, se existir
  cleanupPending(phoneNumber);

  const session = new StringSession("");
  const client = new TelegramClient(session, numericApiId, apiHash, {
    connectionRetries: 3,
    deviceModel: "9Router Agent",
    systemVersion: "1.0",
    appVersion: "1.0",
  });

  try {
    await client.connect();

    const result = await client.invoke(
      new Api.auth.SendCode({
        phoneNumber,
        apiId: numericApiId,
        apiHash,
        settings: new Api.CodeSettings({}),
      })
    );

    const phoneCodeHash = result.phoneCodeHash;

    // Armazena no Map com timer de expiração
    const timer = setTimeout(() => {
      cleanupPending(phoneNumber);
    }, PENDING_TTL_MS);

    pendingAuths.set(phoneNumber, {
      client,
      phoneCodeHash,
      apiId: numericApiId,
      apiHash,
      phone: phoneNumber,
      timer,
      createdAt: Date.now(),
    });

    console.log(`[UserbotAuth] Código OTP enviado para ${phoneNumber}`);
    return { ok: true, phoneNumber, codeType: result.type?.className || "sms" };
  } catch (err) {
    // Desconecta o cliente em caso de erro
    try { await client.disconnect(); } catch {}
    throw mapTelegramError(err);
  }
}

// ────────────────────────────────────────────────────────────────
// Etapa 2: complete-auth — Valida o código OTP e persiste sessão
// ────────────────────────────────────────────────────────────────
async function completeAuth({ phoneNumber, code }) {
  if (!phoneNumber || !code) {
    throw new Error("phoneNumber e code são obrigatórios");
  }

  const pending = pendingAuths.get(phoneNumber);
  if (!pending) {
    throw new Error("Nenhuma autenticação pendente para este número. O código pode ter expirado (5 min). Solicite um novo.");
  }

  const { client, phoneCodeHash, apiId, apiHash } = pending;

  try {
    await client.invoke(
      new Api.auth.SignIn({
        phoneNumber,
        phoneCodeHash,
        phoneCode: code.toString().trim(),
      })
    );

    // Serializa a sessão MTProto e persiste em disco
    const sessionString = client.session.save();
    saveCredentials({ sessionString, apiId, apiHash, phone: phoneNumber });

    // Limpa o pendente (sem desconectar o client — será reaproveitado pelo listener)
    clearTimeout(pending.timer);
    pendingAuths.delete(phoneNumber);

    console.log(`[UserbotAuth] Autenticação bem-sucedida para ${phoneNumber}`);
    return { ok: true, phoneNumber, client };
  } catch (err) {
    const mapped = mapTelegramError(err);

    // Se for 2FA, não desconecta (o user pode tentar de novo após resolver 2FA)
    if (mapped.code === "SESSION_PASSWORD_NEEDED") {
      throw mapped;
    }

    // Outros erros fatais: limpa tudo
    cleanupPending(phoneNumber);
    throw mapped;
  }
}

// ────────────────────────────────────────────────────────────────
// Desconexão e limpeza
// ────────────────────────────────────────────────────────────────
function disconnect() {
  deleteCredentials();
  console.log("[UserbotAuth] Credenciais do Telegram Userbot removidas.");
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────
function cleanupPending(phoneNumber) {
  const pending = pendingAuths.get(phoneNumber);
  if (!pending) return;
  clearTimeout(pending.timer);
  try { pending.client.disconnect().catch(() => {}); } catch {}
  pendingAuths.delete(phoneNumber);
}

function mapTelegramError(err) {
  const msg = err?.errorMessage || err?.message || String(err);

  const errorMap = {
    PHONE_NUMBER_INVALID: "Número de telefone inválido. Use o formato internacional (+5511999998888).",
    PHONE_CODE_INVALID: "Código de verificação inválido. Verifique o código e tente novamente.",
    PHONE_CODE_EXPIRED: "Código de verificação expirado. Solicite um novo código.",
    SESSION_PASSWORD_NEEDED: "Sua conta possui Verificação em Duas Etapas (2FA) ativada. Desative temporariamente a senha de 2FA nas configurações do Telegram para concluir o login do Userbot.",
    API_ID_INVALID: "API ID inválido. Confira suas credenciais em https://my.telegram.org.",
    PHONE_NUMBER_BANNED: "Este número de telefone está banido pelo Telegram.",
    FLOOD_WAIT: `Muitas tentativas. Aguarde antes de tentar novamente. ${msg}`,
  };

  // Procura match por prefixo (FLOOD_WAIT_123, etc.)
  for (const [key, friendly] of Object.entries(errorMap)) {
    if (msg.includes(key)) {
      const error = new Error(friendly);
      error.code = key;
      return error;
    }
  }

  return new Error(`Erro do Telegram: ${msg}`);
}

// Exporta internals para testes
module.exports = {
  getSavedSession,
  saveSession,
  getSavedCredentials,
  saveCredentials,
  deleteCredentials,
  startAuth,
  completeAuth,
  disconnect,
  mapTelegramError,
  // Para testes: acesso ao Map interno
  _pendingAuths: pendingAuths,
  _PENDING_TTL_MS: PENDING_TTL_MS,
  _CREDS_FILE: CREDS_FILE,
};
