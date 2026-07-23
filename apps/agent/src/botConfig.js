// Persistência do token do Telegram Bot (BotFather) configurado pela UI.
// Prioridade: env BOT_TOKEN → arquivo $DATA_DIR/agent/bot-config.json.
const fs = require("fs");
const path = require("path");
const os = require("os");

const dataDir = process.env.DATA_DIR || path.join(os.homedir(), ".9router");
const FILE = path.join(dataDir, "agent", "bot-config.json");

function getToken() {
  if (process.env.BOT_TOKEN) return process.env.BOT_TOKEN;
  try {
    if (fs.existsSync(FILE)) {
      const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
      return data.botToken || null;
    }
  } catch (err) {
    console.warn("[botConfig] Erro ao ler token:", err.message);
  }
  return null;
}

function saveToken(token) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({ botToken: token }), { mode: 0o600 });
  return true;
}

function clearToken() {
  try {
    if (fs.existsSync(FILE)) fs.unlinkSync(FILE);
  } catch (err) {
    console.warn("[botConfig] Erro ao limpar token:", err.message);
  }
}

// Fonte do token (pra UI mostrar de onde vem)
function source() {
  if (process.env.BOT_TOKEN) return "env";
  try {
    if (fs.existsSync(FILE) && JSON.parse(fs.readFileSync(FILE, "utf8")).botToken) return "file";
  } catch {}
  return "none";
}

module.exports = { getToken, saveToken, clearToken, source, FILE };
