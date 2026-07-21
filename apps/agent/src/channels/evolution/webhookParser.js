/**
 * Parser de webhooks recebidos da Evolution API (messages.upsert).
 */
function parseWebhook(payload) {
  if (!payload || !payload.data) return null;
  const data = payload.data;
  const key = data.key || {};

  // Ignorar mensagens enviadas pela própria instância (salvo se auto-responder ativado)
  if (key.fromMe) return null;

  const senderNumber = key.remoteJid ? key.remoteJid.replace("@s.whatsapp.net", "") : null;
  const messageText = data.message?.conversation || data.message?.extendedTextMessage?.text || "";

  if (!senderNumber || !messageText) return null;

  return {
    senderNumber,
    messageText,
    pushName: payload.pushName || senderNumber,
    messageId: key.id,
  };
}

module.exports = {
  parseWebhook,
};
