const { sendTextMessage } = require("./evolutionApi");
const { parseWebhook } = require("./webhookParser");

/**
 * Responde mensagens recebidas via WhatsApp através da pipeline do Agente Lucas.
 */
async function handleWhatsAppWebhook(payload, processMessageFn) {
  const parsed = parseWebhook(payload);
  if (!parsed) return { processed: false };

  console.log(`[WhatsApp] Mensagem recebida de ${parsed.pushName} (${parsed.senderNumber}): ${parsed.messageText}`);

  try {
    // Processar através da pipeline do Lucas
    const result = await processMessageFn(`wa:${parsed.senderNumber}`, parsed.messageText, parsed.pushName, { channel: "whatsapp" });
    const replyText = result.reply || result.content || "Entendido!";

    // Responder via WhatsApp usando Evolution API
    await sendTextMessage(parsed.senderNumber, replyText);

    return { processed: true, replyText };
  } catch (err) {
    console.error("[WhatsApp] Erro no atendimento autônomo:", err.message);
    throw err;
  }
}

module.exports = {
  handleWhatsAppWebhook,
};
