// OAuth 2.0 real do Google Workspace.
// Usa googleapis + google-auth-library. Persiste tokens no SQLite (tabela google_tokens).
// Escopos P0: Gmail (send + read), Calendar (read+write), Drive (files criados por nós), Docs, Chat (send/read).
const { google } = require("googleapis");
const crypto = require("crypto");
const db = require("../db");

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/chat.messages",
];

const USER_ID_DEFAULT = "default";

function isConfigured() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  );
}

function assertConfigured() {
  if (!isConfigured()) {
    throw new Error(
      "Google Workspace não configurado. Defina GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI."
    );
  }
}

function newOAuthClient() {
  assertConfigured();
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/**
 * Gera URL de consentimento + salva `state` no DB para validação no callback (CSRF).
 * `redirectAfter` (opcional) permite ao caller redirecionar para uma tela do dashboard
 * ao invés do JSON default do callback.
 */
function getAuthUrl({ redirectAfter } = {}) {
  const client = newOAuthClient();
  const state = crypto.randomBytes(24).toString("hex");
  const stateObj = redirectAfter ? { s: state, r: redirectAfter } : { s: state };
  const stateEncoded = Buffer.from(JSON.stringify(stateObj), "utf8").toString("base64url");

  db.prepare("INSERT INTO google_oauth_state(state) VALUES (?)").run(state);

  // Limpar states antigos (>10 min) para não acumular
  db.prepare("DELETE FROM google_oauth_state WHERE datetime(created_at) < datetime('now', '-10 minutes')").run();

  const url = client.generateAuthUrl({
    access_type: "offline",       // garante refresh_token na primeira aprovação
    prompt: "consent",             // força refresh_token mesmo se já autorizado antes
    scope: SCOPES,
    state: stateEncoded,
    include_granted_scopes: true,
  });
  return { url, state };
}

/**
 * Consome o `code` do callback, troca por tokens, persiste no DB.
 * Retorna { ok, email, redirectAfter? }.
 */
async function handleCallback(code, stateEncoded) {
  assertConfigured();
  if (!code) return { ok: false, error: "code ausente" };

  // Valida state — evita CSRF
  let stateInfo = { s: null, r: null };
  try {
    stateInfo = JSON.parse(Buffer.from(stateEncoded || "", "base64url").toString("utf8"));
  } catch {
    return { ok: false, error: "state inválido (não decodifica)" };
  }
  if (!stateInfo.s) return { ok: false, error: "state ausente" };

  const found = db.prepare("SELECT state FROM google_oauth_state WHERE state = ?").get(stateInfo.s);
  if (!found) return { ok: false, error: "state expirado ou inválido" };
  db.prepare("DELETE FROM google_oauth_state WHERE state = ?").run(stateInfo.s);

  const client = newOAuthClient();
  const { tokens } = await client.getToken(code);
  // tokens: { access_token, refresh_token, scope, token_type, expiry_date }

  // Busca email para exibir de qual conta veio
  client.setCredentials(tokens);
  let email = null;
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const info = await oauth2.userinfo.get();
    email = info.data?.email || null;
  } catch (err) {
    console.warn("[GoogleOAuth] Não consegui recuperar email:", err.message);
  }

  saveTokens(tokens, email);
  return { ok: true, email, redirectAfter: stateInfo.r || null };
}

function saveTokens(tokens, email) {
  const existing = db.prepare("SELECT user_id FROM google_tokens WHERE user_id = ?").get(USER_ID_DEFAULT);
  const params = [
    tokens.access_token || null,
    tokens.refresh_token || (existing ? undefined : null),
    tokens.scope || null,
    tokens.token_type || "Bearer",
    tokens.expiry_date || null,
    email || null,
  ];
  if (existing) {
    // Preserva refresh_token se o Google não devolveu de novo (comum em re-consentimento)
    if (!tokens.refresh_token) {
      db.prepare(
        `UPDATE google_tokens SET access_token=?, scope=?, token_type=?, expiry_date=?, email=COALESCE(?, email), updated_at=datetime('now') WHERE user_id=?`
      ).run(tokens.access_token, tokens.scope, tokens.token_type || "Bearer", tokens.expiry_date || null, email || null, USER_ID_DEFAULT);
    } else {
      db.prepare(
        `UPDATE google_tokens SET access_token=?, refresh_token=?, scope=?, token_type=?, expiry_date=?, email=COALESCE(?, email), updated_at=datetime('now') WHERE user_id=?`
      ).run(...params, USER_ID_DEFAULT);
    }
  } else {
    db.prepare(
      `INSERT INTO google_tokens(user_id, access_token, refresh_token, scope, token_type, expiry_date, email) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(USER_ID_DEFAULT, ...params);
  }
}

function loadTokens() {
  return db.prepare("SELECT * FROM google_tokens WHERE user_id = ?").get(USER_ID_DEFAULT) || null;
}

function isAuthorized() {
  const t = loadTokens();
  return !!(t && t.refresh_token);
}

function disconnect() {
  db.prepare("DELETE FROM google_tokens WHERE user_id = ?").run(USER_ID_DEFAULT);
  db.prepare("DELETE FROM google_oauth_state").run();
}

/**
 * Retorna um OAuth2 client já com credenciais válidas.
 * Auto-refresh do access_token via evento `tokens` — persiste o novo access_token.
 */
function getAuthorizedClient() {
  assertConfigured();
  const stored = loadTokens();
  if (!stored || !stored.refresh_token) {
    throw new Error("Google não autorizado. Vá ao Dashboard → Google → Conectar.");
  }
  const client = newOAuthClient();
  client.setCredentials({
    access_token: stored.access_token,
    refresh_token: stored.refresh_token,
    scope: stored.scope,
    token_type: stored.token_type || "Bearer",
    expiry_date: stored.expiry_date,
  });
  client.on("tokens", (tokens) => {
    // Só access_token novo aqui (refresh usa o antigo)
    saveTokens({ ...tokens, refresh_token: stored.refresh_token }, stored.email);
  });
  return client;
}

module.exports = {
  SCOPES,
  isConfigured,
  isAuthorized,
  getAuthUrl,
  handleCallback,
  getAuthorizedClient,
  loadTokens,
  disconnect,
};
