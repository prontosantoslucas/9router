// Gerencia o ciclo de vida do Telegram Bot em runtime (start/stop/relaunch),
// para poder configurar o token pela UI sem reiniciar o container.
const { createBot } = require("./telegram");
const botConfig = require("./botConfig");

let currentBot = null;
let running = false;

function getBot() {
  return currentBot;
}

// Sobe o bot com o token dado (ou o persistido). Para o anterior se houver.
function launch(tokenOverride) {
  const token = tokenOverride || botConfig.getToken();
  stop();
  if (!token) {
    console.log("[BotManager] Sem token — bot não iniciado.");
    return { ok: false, running: false, configured: false };
  }
  const bot = createBot(token);
  if (!bot) return { ok: false, running: false, configured: !!token };
  // telegraf: launch() resolve só quando o bot PARA — não dar await.
  bot.launch()
    .then(() => { running = false; })
    .catch((err) => {
      running = false;
      console.error("[BotManager] launch falhou:", err.message);
    });
  currentBot = bot;
  running = true;
  console.log("[BotManager] Bot do Telegram iniciado.");
  return { ok: true, running: true, configured: true };
}

function stop() {
  if (currentBot) {
    try { currentBot.stop("relaunch"); } catch {}
    currentBot = null;
  }
  running = false;
}

// Salva o token novo e reinicia o bot com ele.
function saveAndLaunch(token) {
  if (!token || typeof token !== "string" || token.length < 20) {
    return { ok: false, error: "Token inválido" };
  }
  botConfig.saveToken(token.trim());
  return launch(token.trim());
}

function disconnect() {
  stop();
  botConfig.clearToken();
  return { ok: true, running: false, configured: false };
}

function status() {
  return {
    configured: !!botConfig.getToken(),
    running,
    source: botConfig.source(),
  };
}

module.exports = { getBot, launch, stop, saveAndLaunch, disconnect, status };
