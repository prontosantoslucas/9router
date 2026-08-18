// Cofre da sessão do WhatsApp (Baileys).
//
// O problema: useMultiFileAuthState espalha a sessão em dezenas de arquivos
// JSON dentro do volume. Isso sobrevive a redeploy, mas NÃO a volume recriado,
// mudança de DATA_DIR ou escrita parcial — e perder a sessão significa pegar o
// celular e escanear QR de novo, com o robô fora do ar até isso acontecer.
//
// Duas camadas, protegendo coisas diferentes:
//
//   1. Snapshot no SQLite (automático). A sessão passa a existir também como
//      UMA linha, cifrada. Protege contra arquivo corrompido/parcial e contra
//      o diretório ser limpo. Mora no mesmo volume, então não salva de perda
//      de volume.
//
//   2. Blob exportável (manual, uma vez). O mesmo conteúdo cifrado em texto
//      que você guarda FORA do Railway. É o único jeito real de sobreviver a
//      volume recriado sem tocar no celular.
//
// A cifra é AES-256-GCM com chave derivada de um segredo de ambiente. O blob
// sozinho não serve pra nada: sem o segredo, não abre.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const db = require("../../db");

const dataDir = process.env.DATA_DIR || path.join(os.homedir(), ".9router");
const AUTH_DIR = path.join(dataDir, "agent", "whatsapp-session");

db.exec(`
  CREATE TABLE IF NOT EXISTS wa_session_backup (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload TEXT NOT NULL,
    file_count INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

// Deriva a chave de um segredo que JÁ existe e é estável entre deploys.
// Nunca gera aleatória: chave nova a cada boot tornaria o backup ilegível.
function encryptionKey() {
  const secret =
    process.env.SESSION_BACKUP_KEY ||
    process.env.AGENT_INTERNAL_SECRET ||
    process.env.JWT_SECRET;
  if (!secret) return null;
  return crypto.scryptSync(secret, "wa-session-vault", 32);
}

function encrypt(plaintext) {
  const key = encryptionKey();
  if (!key) throw new Error("sem segredo para cifrar (defina SESSION_BACKUP_KEY ou AGENT_INTERNAL_SECRET)");
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}

function decrypt(blob) {
  const key = encryptionKey();
  if (!key) throw new Error("sem segredo para decifrar");
  const [ver, ivB, tagB, dataB] = String(blob).split(".");
  if (ver !== "v1" || !ivB || !tagB || !dataB) throw new Error("blob inválido ou de outra versão");
  const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB, "base64url"));
  d.setAuthTag(Buffer.from(tagB, "base64url"));
  return Buffer.concat([d.update(Buffer.from(dataB, "base64url")), d.final()]).toString("utf8");
}

function readSessionFiles() {
  if (!fs.existsSync(AUTH_DIR)) return null;
  const files = fs.readdirSync(AUTH_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) return null;
  const out = {};
  for (const f of files) {
    try { out[f] = fs.readFileSync(path.join(AUTH_DIR, f), "utf8"); } catch {}
  }
  // creds.json é o coração da sessão. Sem ele o resto não reconecta.
  if (!out["creds.json"]) return null;
  return out;
}

// Grava o snapshot cifrado. Chamado (com debounce) a cada creds.update.
function snapshot() {
  try {
    const files = readSessionFiles();
    if (!files) return { ok: false, reason: "sem sessão local para salvar" };
    const blob = encrypt(JSON.stringify(files));
    db.prepare(
      `INSERT INTO wa_session_backup (id, payload, file_count, updated_at)
       VALUES (1, ?, ?, unixepoch())
       ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, file_count=excluded.file_count, updated_at=unixepoch()`
    ).run(blob, Object.keys(files).length);
    return { ok: true, files: Object.keys(files).length };
  } catch (err) {
    console.warn("[waVault] snapshot falhou:", err.message);
    return { ok: false, error: err.message };
  }
}

function writeFiles(files) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  let written = 0;
  for (const [name, content] of Object.entries(files)) {
    // nome vem do próprio snapshot, mas normaliza pra não escrever fora do dir
    const safe = path.basename(String(name));
    if (!safe.endsWith(".json")) continue;
    fs.writeFileSync(path.join(AUTH_DIR, safe), content, "utf8");
    written++;
  }
  return written;
}

// Restaura do SQLite se o diretório local estiver vazio/ausente.
// Chamado no start() ANTES de useMultiFileAuthState, senão o Baileys já teria
// criado credenciais novas e o QR apareceria mesmo havendo backup.
function restoreIfMissing() {
  try {
    if (readSessionFiles()) return { ok: true, skipped: "sessão local já existe" };
    const row = db.prepare("SELECT payload, file_count, updated_at FROM wa_session_backup WHERE id = 1").get();
    if (!row) return { ok: false, reason: "sem backup no banco" };
    const files = JSON.parse(decrypt(row.payload));
    const written = writeFiles(files);
    console.log(`[waVault] sessão restaurada do banco (${written} arquivos, backup de ${new Date(row.updated_at * 1000).toISOString()})`);
    return { ok: true, restored: written };
  } catch (err) {
    console.warn("[waVault] restauração falhou:", err.message);
    return { ok: false, error: err.message };
  }
}

// Blob para guardar FORA do Railway. É o único caminho de recuperação se o
// volume for recriado.
function exportBlob() {
  const row = db.prepare("SELECT payload, file_count, updated_at FROM wa_session_backup WHERE id = 1").get();
  if (row) return { ok: true, blob: row.payload, files: row.file_count, updatedAt: row.updated_at, from: "banco" };
  const files = readSessionFiles();
  if (!files) return { ok: false, error: "não há sessão nem backup — pareie o WhatsApp primeiro" };
  return { ok: true, blob: encrypt(JSON.stringify(files)), files: Object.keys(files).length, from: "disco" };
}

// Importa um blob salvo antes e já escreve os arquivos, para reconectar sem QR.
function importBlob(blob) {
  try {
    const files = JSON.parse(decrypt(String(blob).trim()));
    if (!files["creds.json"]) return { ok: false, error: "blob sem creds.json — não é uma sessão válida" };
    const written = writeFiles(files);
    db.prepare(
      `INSERT INTO wa_session_backup (id, payload, file_count, updated_at)
       VALUES (1, ?, ?, unixepoch())
       ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, file_count=excluded.file_count, updated_at=unixepoch()`
    ).run(String(blob).trim(), written);
    return { ok: true, restored: written };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function status() {
  const row = db.prepare("SELECT file_count, updated_at FROM wa_session_backup WHERE id = 1").get();
  const local = readSessionFiles();
  return {
    hasSecret: !!encryptionKey(),
    localFiles: local ? Object.keys(local).length : 0,
    backupFiles: row?.file_count || 0,
    backupAt: row?.updated_at ? new Date(row.updated_at * 1000).toISOString() : null,
    authDir: AUTH_DIR,
  };
}

// Debounce: creds.update dispara muitas vezes seguidas durante o handshake.
let timer = null;
function snapshotSoon(delayMs = 3000) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; snapshot(); }, delayMs);
}

module.exports = { snapshot, snapshotSoon, restoreIfMissing, exportBlob, importBlob, status, AUTH_DIR };
