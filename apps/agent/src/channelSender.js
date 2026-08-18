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

// Um envio só conta como enviado se o client confirmar. Os dois clients
// sinalizam falha de formas diferentes — o userbot devolve { ok:false } em vez
// de lançar — e ignorar isso fazia TODA notificação parecer entregue: o log
// dizia "sem cliente conectado" e a função devolvia ok:true na linha seguinte.
// Era por isso que a notificação no celular nunca chegava sem acusar erro.
async function sendTelegram(chatId, text) {
  const falhas = [];

  // Preferido: bot API (Telegraf).
  try {
    const botManager = require("./botManager");
    const bot = botManager?.getBot?.();
    if (bot?.telegram?.sendMessage) {
      try {
        await bot.telegram.sendMessage(chatId, text, { parse_mode: "Markdown" });
      } catch (e1) {
        // 2ª tentativa sem Markdown: caractere especial no texto derruba o parse.
        await bot.telegram.sendMessage(chatId, text);
      }
      return { ok: true, via: "tg-bot" };
    }
    falhas.push("bot Telegraf nao inicializado");
  } catch (e) {
    falhas.push(`bot: ${e.message}`);
  }

  // Fallback: userbot (MTProto).
  try {
    const userbot = require("./channels/telegram/userbotClient");
    if (userbot?.sendMessage) {
      const r = await userbot.sendMessage(chatId, text);
      if (r && r.ok === false) falhas.push(`userbot: ${r.error || "falhou"}`);
      else return { ok: true, via: "tg-userbot" };
    } else {
      falhas.push("userbot sem sendMessage");
    }
  } catch (e) {
    falhas.push(`userbot: ${e.message}`);
  }

  return { ok: false, error: `Telegram nao enviou — ${falhas.join("; ")}` };
}

// O client nativo (Baileys) devolve { ok:false } quando o WhatsApp não está
// pareado, em vez de lançar. Mesmo problema do Telegram: era descartado.
async function sendWhatsApp(chatId, text) {
  try {
    const evo = require("./channels/evolution/evolutionApi");
    if (!evo?.sendTextMessage) return { ok: false, error: "evolution nao configurada" };
    const r = await evo.sendTextMessage(chatId, text);
    if (r && r.ok === false) return { ok: false, error: `whatsapp: ${r.error || "falhou"}` };
    return { ok: true, via: "whatsapp-evolution" };
  } catch (e) {
    return { ok: false, error: `evolution: ${e.message}` };
  }
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
