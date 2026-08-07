// Roteador de mensagens outbound (agent → user) que detecta canal pelo chatId.
//
// Regras de detecção:
//   - Só dígitos (com/sem '-') → Telegram (bot API preferido, userbot fallback)
//   - Contém '@c.us' ou '@s.whatsapp.net' → WhatsApp Evolution
//   - "webchat:<id>" ou UUID → webchat (grava em job_alert_notifications)
//   - Fallback: webchat
//
// Todas as funções são fail-soft: log de erro + retorna { ok:false }, nunca throw.

const db = require("./db");

function detectChannel(chatId) {
  if (!chatId) return "unknown";
  const s = String(chatId).trim();
  if (/@c\.us$|@s\.whatsapp\.net$/i.test(s)) return "whatsapp";
  if (/^[\d-]+$/.test(s)) return "telegram";
  if (/^webchat:/i.test(s)) return "webchat";
  return "webchat"; // default seguro
}

async function sendTelegram(chatId, text) {
  // Prefere bot API (Telegraf); fallback pro userbot
  try {
    const botManager = require("./botManager");
    const bot = botManager?.getBot?.();
    if (bot?.telegram?.sendMessage) {
      await bot.telegram.sendMessage(chatId, text, { parse_mode: "Markdown" }).catch(() => {
        // 2ª tentativa sem markdown (evita erro de parse por caracteres especiais)
        return bot.telegram.sendMessage(chatId, text);
      });
      return { ok: true, via: "tg-bot" };
    }
  } catch (e) { /* fallthrough userbot */ }

  try {
    const userbot = require("./channels/telegram/userbotClient");
    if (userbot?.sendMessage) {
      await userbot.sendMessage(chatId, text);
      return { ok: true, via: "tg-userbot" };
    }
  } catch (e) { /* fallthrough */ }

  return { ok: false, error: "nenhum client Telegram disponível (bot=null, userbot=null)" };
}

async function sendWhatsApp(chatId, text) {
  try {
    const evo = require("./channels/evolution/evolutionApi");
    if (evo?.sendTextMessage) {
      await evo.sendTextMessage(chatId, text);
      return { ok: true, via: "whatsapp-evolution" };
    }
  } catch (e) {
    return { ok: false, error: `evolution: ${e.message}` };
  }
  return { ok: false, error: "evolution não configurada" };
}

function sendWebchat(chatId, text) {
  // Persiste em tabela que o frontend polla. Reusa a mesma que jobAlerts.
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS job_alert_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      read INTEGER NOT NULL DEFAULT 0
    )`);
    db.prepare("INSERT INTO job_alert_notifications (chat_id, body) VALUES (?, ?)")
      .run(String(chatId), text);
    return { ok: true, via: "webchat-db" };
  } catch (e) {
    return { ok: false, error: `webchat: ${e.message}` };
  }
}

// API pública — usada por scheduler, jobAlerts, proactiveNotifier, automation
async function send(chatId, text, { channel } = {}) {
  if (!chatId) return { ok: false, error: "chatId ausente" };
  if (!text) return { ok: false, error: "text ausente" };

  const detected = channel || detectChannel(chatId);
  let result;
  if (detected === "telegram") result = await sendTelegram(chatId, text);
  else if (detected === "whatsapp") result = await sendWhatsApp(chatId, text);
  else result = sendWebchat(chatId, text);

  if (!result.ok) {
    console.warn(`[channelSender] falha ${detected} chat=${chatId}: ${result.error}`);
    // Fallback: sempre grava em webchat se canal primário falhou (não perde msg)
    if (detected !== "webchat") {
      const fb = sendWebchat(chatId, text);
      if (fb.ok) return { ok: true, via: "webchat-fallback", primary_error: result.error };
    }
  }
  return result;
}

module.exports = { send, detectChannel };
