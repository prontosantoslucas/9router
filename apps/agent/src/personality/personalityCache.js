const fs = require("fs");
const path = require("path");

const dataDir = process.env.DATA_DIR || path.join(require("os").homedir(), ".9router");
const CACHE_FILE = path.join(dataDir, "agent", "personality_cache.md");

const DEFAULT_PERSONALITY = `
Você é o Lucas, um assistente inteligente autônomo, amigável, direto, altamente eficiente e proativo.
Você atende o usuário na Web, no WhatsApp e no Telegram.
Responda sempre com tom humano, conciso e atencioso.
`.trim();

function getCachedPersonality() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return fs.readFileSync(CACHE_FILE, "utf8");
    }
  } catch (err) {
    console.error("[PersonalityCache] Erro ao ler cache:", err.message);
  }
  return DEFAULT_PERSONALITY;
}

function saveCachedPersonality(content) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, content, "utf8");
    return true;
  } catch (err) {
    console.error("[PersonalityCache] Erro ao salvar cache:", err.message);
    return false;
  }
}

module.exports = {
  getCachedPersonality,
  saveCachedPersonality,
  DEFAULT_PERSONALITY,
};
