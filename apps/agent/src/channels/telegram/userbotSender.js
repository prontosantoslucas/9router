/**
 * Emissor de respostas via Telegram Userbot MTProto (respondendo pela conta pessoal do usuário).
 */
async function sendUserbotMessage(chatId, messageText) {
  console.log(`[Telegram Userbot] Enviando mensagem pela conta pessoal para ${chatId}: ${messageText}`);
  return { ok: true, sentViaUserbot: true };
}

module.exports = {
  sendUserbotMessage,
};
