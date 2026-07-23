// Fluxo de autenticação MTProto (userbot) via gramjs, com pending PERSISTIDO em SQLite.
// Persiste { phone, phoneCodeHash, sessionStr, apiId, apiHash } para sobreviver a restart:
// no restart, recria o client a partir da sessionStr salva e completa o signIn.
const userbotAuth = require("./userbotAuth");
const db = require("../../db");

db.exec(`
  CREATE TABLE IF NOT EXISTS tg_userbot_pending (
    phone TEXT PRIMARY KEY,
    phone_code_hash TEXT NOT NULL,
    session_str TEXT NOT NULL,
    api_id TEXT NOT NULL,
    api_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Cache de clients vivos em memória (evita reconectar no fluxo feliz)
const liveClients = new Map();

function lazyGramjs() {
  const { TelegramClient, Api } = require("telegram");
  const { StringSession } = require("telegram/sessions");
  return { TelegramClient, Api, StringSession };
}

function savePending(phone, row) {
  db.prepare(
    `INSERT INTO tg_userbot_pending (phone, phone_code_hash, session_str, api_id, api_hash, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(phone) DO UPDATE SET phone_code_hash=excluded.phone_code_hash, session_str=excluded.session_str,
       api_id=excluded.api_id, api_hash=excluded.api_hash, created_at=datetime('now')`
  ).run(phone, row.phoneCodeHash, row.sessionStr, String(row.apiId), String(row.apiHash));
}

function getPending(phone) {
  return db.prepare("SELECT * FROM tg_userbot_pending WHERE phone = ?").get(String(phone));
}

function clearPending(phone) {
  db.prepare("DELETE FROM tg_userbot_pending WHERE phone = ?").run(String(phone));
  // Limpa pendências antigas (>15min)
  db.prepare("DELETE FROM tg_userbot_pending WHERE datetime(created_at) < datetime('now','-15 minutes')").run();
}

async function startAuth({ apiId, apiHash, phone }) {
  if (!apiId || !apiHash || !phone) {
    const missing = [!apiId && "apiId", !apiHash && "apiHash", !phone && "phone"].filter(Boolean).join(", ");
    const err = new Error(`Campos obrigatórios ausentes: ${missing}`);
    err.status = 400;
    throw err;
  }
  const { TelegramClient, StringSession } = lazyGramjs();
  const client = new TelegramClient(new StringSession(""), Number(apiId), String(apiHash), { connectionRetries: 3 });
  await client.connect();
  const result = await client.sendCode({ apiId: Number(apiId), apiHash: String(apiHash) }, String(phone));

  const sessionStr = client.session.save();
  savePending(String(phone), { phoneCodeHash: result.phoneCodeHash, sessionStr, apiId, apiHash });
  liveClients.set(String(phone), client);
  return { ok: true, sent: true };
}

async function completeAuth({ phone, code, password }) {
  if (!phone || !code) {
    const err = new Error("phone e code são obrigatórios");
    err.status = 400;
    throw err;
  }
  const pend = getPending(String(phone));
  if (!pend) {
    const err = new Error("Sessão de autenticação expirada. Reinicie o pareamento.");
    err.status = 409;
    throw err;
  }

  const { TelegramClient, Api, StringSession } = lazyGramjs();
  let client = liveClients.get(String(phone));
  if (!client) {
    // Recria a partir da session persistida (sobreviveu a restart)
    client = new TelegramClient(new StringSession(pend.session_str), Number(pend.api_id), String(pend.api_hash), {
      connectionRetries: 3,
    });
    await client.connect();
  }

  try {
    await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: String(phone),
        phoneCodeHash: pend.phone_code_hash,
        phoneCode: String(code),
      })
    );
  } catch (err) {
    if (String(err?.errorMessage || err?.message || "").includes("SESSION_PASSWORD_NEEDED")) {
      if (!password) {
        const e = new Error("2FA ativado: envie o campo 'password' (senha de duas etapas).");
        e.status = 401;
        e.needPassword = true;
        throw e;
      }
      await client.signInWithPassword(
        { apiId: Number(pend.api_id), apiHash: String(pend.api_hash) },
        { password: async () => password, onError: (e) => { throw e; } }
      );
    } else {
      throw err;
    }
  }

  const sessionStr = client.session.save();
  userbotAuth.saveSession(sessionStr);
  try { await client.disconnect(); } catch {}
  liveClients.delete(String(phone));
  clearPending(String(phone));
  return { ok: true, connected: true };
}

module.exports = { startAuth, completeAuth };
