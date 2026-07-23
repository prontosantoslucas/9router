// Cliente MTProto persistente (userbot = conta pessoal do usuário).
// Conecta com a session salva, escuta mensagens (privado + GRUPOS) e responde.
// Fail-open: qualquer erro loga e não derruba o agente.
const userbotAuth = require("./userbotAuth");

let client = null;
let running = false;
let messageHandler = null;

function lazyGramjs() {
  const { TelegramClient, Api } = require("telegram");
  const { StringSession } = require("telegram/sessions");
  const { NewMessage } = require("telegram/events");
  return { TelegramClient, Api, StringSession, NewMessage };
}

/**
 * Inicia o userbot se houver sessão + credenciais. `onMessage(ctx)` recebe:
 *   { chatId, text, senderName, isGroup, isPrivate, reply(fn) }
 */
async function start(onMessage) {
  messageHandler = onMessage;
  const session = userbotAuth.getSavedSession();
  const apiId = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;

  if (!session) {
    console.log("[Userbot] Sem sessão salva — pareie a conta em /dashboard2 (card Userbot).");
    return false;
  }
  if (!apiId || !apiHash) {
    console.log("[Userbot] TELEGRAM_API_ID/HASH ausentes — não é possível conectar o userbot.");
    return false;
  }

  try {
    const { TelegramClient, StringSession, NewMessage } = lazyGramjs();
    client = new TelegramClient(new StringSession(session), Number(apiId), String(apiHash), {
      connectionRetries: 5,
    });
    await client.connect();
    const me = await client.getMe().catch(() => null);
    console.log(`[Userbot] Conectado como conta pessoal${me?.username ? ` @${me.username}` : ""}.`);

    client.addEventHandler(async (event) => {
      try {
        const msg = event.message;
        if (!msg || msg.out) return; // ignora mensagens enviadas por nós
        const text = msg.message || "";
        if (!text.trim()) return;

        const chat = await msg.getChat().catch(() => null);
        const sender = await msg.getSender().catch(() => null);
        const isGroup = !!(chat && (chat.className === "Channel" || chat.className === "Chat"));
        const senderName =
          sender?.firstName || sender?.username || (sender?.title) || "Contato";
        const chatName = isGroup ? (chat?.title || "Grupo") : senderName;

        if (messageHandler) {
          await messageHandler({
            chatId: `tg-user:${msg.chatId}`,
            peer: msg.chatId,
            text,
            senderName,
            chatName,
            isGroup,
            isPrivate: !isGroup,
            reply: (responseText) => sendMessage(msg.chatId, responseText),
          });
        }
      } catch (err) {
        console.error("[Userbot] Erro no handler de mensagem:", err.message);
      }
    }, new NewMessage({}));

    running = true;
    return true;
  } catch (err) {
    console.error("[Userbot] Falha ao conectar:", err.message);
    running = false;
    return false;
  }
}

async function sendMessage(peer, text) {
  if (!client || !running) {
    console.warn("[Userbot] sendMessage chamado sem cliente conectado.");
    return { ok: false, error: "userbot não conectado" };
  }
  try {
    await client.sendMessage(peer, { message: text });
    return { ok: true };
  } catch (err) {
    console.error("[Userbot] Erro ao enviar:", err.message);
    return { ok: false, error: err.message };
  }
}

function status() {
  return { running, hasSession: !!userbotAuth.getSavedSession() };
}

async function stop() {
  if (client) {
    try { await client.disconnect(); } catch {}
    client = null;
  }
  running = false;
}

module.exports = { start, sendMessage, status, stop };
