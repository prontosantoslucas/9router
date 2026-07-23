// Emissor de respostas via Telegram Userbot (conta pessoal) — delega ao cliente MTProto.
const userbotClient = require("./userbotClient");

async function sendUserbotMessage(chatId, messageText) {
  // chatId pode vir como "tg-user:<peer>" ou o peer cru
  const peer = String(chatId).startsWith("tg-user:") ? String(chatId).slice("tg-user:".length) : chatId;
  return userbotClient.sendMessage(peer, messageText);
}

module.exports = { sendUserbotMessage };
