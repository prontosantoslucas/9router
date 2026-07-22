const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const { getSavedCredentials } = require("./userbotAuth");
const { processMessage } = require("../../orchestrator");

// ────────────────────────────────────────────────────────────────
// Ouvinte de mensagens em tempo real via Telegram Userbot (MTProto)
// Mantém um TelegramClient de longa duração rodando em background.
// Filtra estritamente para DMs 1:1 privadas (incoming, isPrivate).
// ────────────────────────────────────────────────────────────────

let activeClient = null;
let isListening = false;

/**
 * Retorna o client GramJS ativo (usado pelo userbotSender para enviar mensagens).
 */
function getActiveClient() {
  return activeClient;
}

/**
 * Define o client ativo externamente (após completeAuth bem-sucedido).
 */
function setActiveClient(client) {
  activeClient = client;
}

/**
 * Inicializa o listener de mensagens usando credenciais salvas em disco.
 * Chamado no boot do agente e após autenticação bem-sucedida.
 */
async function initUserbotListener() {
  // Se já está escutando, não duplica
  if (isListening && activeClient?.connected) {
    console.log("[Userbot] Listener já ativo, ignorando re-init.");
    return true;
  }

  // Se não tem client injetado, tenta reconectar com credenciais salvas
  if (!activeClient) {
    const creds = getSavedCredentials();
    if (!creds || !creds.sessionString || !creds.apiId || !creds.apiHash) {
      console.log("[Userbot] Nenhuma sessão salva do Telegram Userbot. Aguardando autenticação no /dashboard2.");
      return false;
    }

    try {
      const session = new StringSession(creds.sessionString);
      const client = new TelegramClient(session, creds.apiId, creds.apiHash, {
        connectionRetries: 5,
        deviceModel: "9Router Agent",
        systemVersion: "1.0",
        appVersion: "1.0",
      });

      await client.connect();

      if (!await client.checkAuthorization()) {
        console.warn("[Userbot] Sessão salva expirada ou inválida. Necessário re-autenticar.");
        return false;
      }

      activeClient = client;
      console.log("[Userbot] Reconectado com sessão salva em disco.");
    } catch (err) {
      console.error("[Userbot] Falha ao reconectar com sessão salva:", err.message);
      return false;
    }
  }

  // Registra o handler de mensagens
  registerMessageHandler(activeClient);
  isListening = true;

  console.log("[Userbot] ✅ Listener MTProto ativo — escutando DMs 1:1 privadas.");
  return true;
}

/**
 * Registra o event handler de NewMessage no client GramJS.
 * Filtra para incoming + isPrivate (DMs 1:1 apenas).
 */
function registerMessageHandler(client) {
  client.addEventHandler(async (event) => {
    try {
      const message = event.message;
      if (!message || message.out) return; // Ignora mensagens enviadas por nós

      // Verifica se é DM privada (não grupo, não canal)
      const chat = await message.getChat();
      if (!chat) return;

      // className === "User" para DMs 1:1
      const isPrivateChat = chat.className === "User";
      if (!isPrivateChat) return;

      const senderId = message.senderId?.toString() || chat.id?.toString() || "unknown";
      const senderName =
        [chat.firstName, chat.lastName].filter(Boolean).join(" ") ||
        chat.username ||
        senderId;
      const text = message.text || "";

      if (!text.trim()) return; // Ignora mensagens vazias (stickers, mídia sem legenda, etc.)

      const chatId = `tg-userbot:${senderId}`;

      console.log(`[Userbot] DM de ${senderName} (${senderId}): ${text.substring(0, 80)}...`);

      // Processa a mensagem pelo orquestrador do Lucas (mesmo pipeline do WhatsApp/Web/Bot)
      const result = await processMessage(chatId, text, senderName, {
        channel: "telegram-userbot",
      });

      // Envia a resposta de volta pela conta pessoal do usuário
      if (result?.content) {
        await client.sendMessage(chat.id, { message: result.content });
        console.log(`[Userbot] Resposta enviada para ${senderName}: ${result.content.substring(0, 80)}...`);
      }
    } catch (err) {
      console.error("[Userbot] Erro ao processar mensagem:", err.message);
    }
  }, new NewMessage({ incoming: true }));
}

/**
 * Desconecta o listener ativo.
 */
async function stopUserbotListener() {
  if (activeClient) {
    try {
      await activeClient.disconnect();
    } catch {}
    activeClient = null;
  }
  isListening = false;
  console.log("[Userbot] Listener desconectado.");
}

module.exports = {
  initUserbotListener,
  stopUserbotListener,
  getActiveClient,
  setActiveClient,
};
