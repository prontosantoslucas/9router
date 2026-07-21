const fs = require("fs");
const path = require("path");

const dataDir = process.env.DATA_DIR || path.join(require("os").homedir(), ".9router");
const SESSION_FILE = path.join(dataDir, "agent", "telegram_userbot.session");

let userbotSession = "";

function getSavedSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      return fs.readFileSync(SESSION_FILE, "utf8").trim();
    }
  } catch (err) {
    console.error("[UserbotAuth] Erro ao ler sessão:", err.message);
  }
  return "";
}

function saveSession(sessionString) {
  try {
    fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
    fs.writeFileSync(SESSION_FILE, sessionString, "utf8");
    userbotSession = sessionString;
    return true;
  } catch (err) {
    console.error("[UserbotAuth] Erro ao salvar sessão:", err.message);
    return false;
  }
}

module.exports = {
  getSavedSession,
  saveSession,
};
