// Roteador de mensagens outbound (agent → user) que detecta canal pelo chatId.
//
// Regras de detecção:
//   - Só dígitos (com/sem '-') → Telegram (bot API preferido, userbot fallback)
//   - Contém '@c.us' ou '@s.whatsapp.net' → WhatsApp Evolution
//   - "webchat:<id>" ou UUID → webchat (grava em job_alert_notifications)
//   - "push" → push dedicado no celular (ntfy/Pushover), sem chat nenhum
//   - Fallback: webchat
//
// Todas as funções são fail-soft: log de erro + retorna { ok:false }, nunca throw.

const db = require("./db");

function detectChannel(chatId) {
  if (!chatId) return "unknown";
  const s = String(chatId).trim();
  if (/@c\.us$|@s\.whatsapp\.net$/i.test(s)) return "whatsapp";
  if (/^push$/i.test(s)) return "push";
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

// Push dedicado: alerta no celular com título próprio, fora das conversas.
// O texto pode vir com "*Título*\n..." (formato que a tool notify monta para o
// Telegram); aqui isso é separado, porque push tem campo de título de verdade.
async function sendPush(text, { title = null, priority = 3, url = null } = {}) {
  try {
    const push = require("./channels/push/pushSender");
    let t = title;
    let corpo = String(text);
    if (!t) {
      const m = corpo.match(/^\*([^*\n]{1,80})\*\n([\s\S]+)$/);
      if (m) { t = m[1]; corpo = m[2]; }
    }
    return await push.send({ title: t, text: corpo, priority, url });
  } catch (e) {
    return { ok: false, error: `push: ${e.message}` };
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
async function send(chatId, text, { channel, title = null, priority = 3, url = null } = {}) {
  if (!chatId) return { ok: false, error: "chatId ausente" };
  if (!text) return { ok: false, error: "text ausente" };

  const detected = channel || detectChannel(chatId);
  let result;
  if (detected === "telegram") result = await sendTelegram(chatId, text);
  else if (detected === "whatsapp") result = await sendWhatsApp(chatId, text);
  else if (detected === "push") result = await sendPush(text, { title, priority, url });
  else result = sendWebchat(chatId, text);

  if (!result.ok) {
    console.warn(`[channelSender] falha ${detected} chat=${chatId}: ${result.error}`);
    // Fallback: sempre grava em webchat se canal primário falhou (não perde msg).
    // Não vale para 'push', cujo chatId não identifica sessão nenhuma — a linha
    // ficaria órfã no banco e ninguém veria.
    if (detected !== "webchat" && detected !== "push") {
      const fb = sendWebchat(chatId, text);
      if (fb.ok) return { ok: true, via: "webchat-fallback", primary_error: result.error };
    }
  }
  return result;
}

// O chat do dono, na ordem em que o resto do código já procurava.
function ownerChatId() {
  return process.env.OWNER_CHAT_ID || process.env.SCANNER_NOTIFY_TELEGRAM_CHAT_ID || null;
}

// "Me avise no celular": push dedicado primeiro, chat do dono depois.
//
// A ordem é essa porque push é o que o usuário pediu — alerta separado, não
// mensagem perdida entre conversas — mas o chat continua valendo como rede de
// segurança, para o aviso não sumir se o provedor de push estiver fora.
// Devolve `tentativas` para quem chama poder registrar o que realmente ocorreu,
// em vez de assumir entrega.
async function sendOwner(text, { title = null, priority = 3, url = null, fallbackChatId = null } = {}) {
  if (!text) return { ok: false, error: "text ausente" };
  const tentativas = [];

  let push = null;
  try {
    push = require("./channels/push/pushSender");
  } catch (e) {
    tentativas.push(`push indisponivel: ${e.message}`);
  }

  if (push?.isConfigured?.()) {
    const r = await sendPush(text, { title, priority, url });
    if (r.ok) return { ...r, tentativas };
    tentativas.push(r.error);
  } else if (push) {
    tentativas.push("push nao configurado");
  }

  const destino = fallbackChatId || ownerChatId();
  if (!destino) {
    return { ok: false, error: `sem push e sem chat do dono — ${tentativas.join("; ")}`, tentativas };
  }

  const r = await send(destino, title ? `*${title}*\n${text}` : text);
  return { ...r, tentativas, fallback_para: detectChannel(destino) };
}

module.exports = { send, sendOwner, sendPush, detectChannel, ownerChatId };
