/**
 * Parser de webhooks da Evolution API (messages.upsert) — DMs E GRUPOS.
 */
function parseWebhook(payload) {
  if (!payload || !payload.data) return null;
  const data = payload.data;
  const key = data.key || {};

  // Ignora o que a própria instância enviou
  if (key.fromMe) return null;

  const remoteJid = key.remoteJid || "";
  const isGroup = remoteJid.endsWith("@g.us");

  // Em grupo, o autor real vem em key.participant; o remoteJid é o grupo.
  const senderJid = isGroup ? (key.participant || "") : remoteJid;
  const senderNumber = senderJid.replace(/@s\.whatsapp\.net$/, "").replace(/@g\.us$/, "");
  const groupId = isGroup ? remoteJid.replace(/@g\.us$/, "") : null;

  // Tipos de mensagem de texto suportados
  const m = data.message || {};
  const messageText =
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    "";

  if (!senderNumber || !messageText) return null;

  return {
    isGroup,
    groupId,                    // id do grupo (null em DM)
    senderNumber,               // número de quem escreveu
    messageText,
    pushName: payload.pushName || data.pushName || senderNumber,
    messageId: key.id,
    // chatId de resposta: no grupo responde no grupo; em DM responde no número
    replyJid: remoteJid,
  };
}

module.exports = { parseWebhook };
