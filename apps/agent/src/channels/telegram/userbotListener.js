const { getSavedSession } = require("./userbotAuth");
const { sendUserbotMessage } = require("./userbotSender");

/**
 * Event Listener para mensagens privadas recebidas no Telegram Userbot.
 */
function initUserbotListener(processMessageFn) {
  const session = getSavedSession();
  if (!session) {
    console.log("[Userbot] Nenhuma sessão salva do Telegram Userbot. Aguardando autenticação no /dashboard2.");
    return false;
  }

  console.log("[Userbot] Inicializando listener MTProto do Telegram Userbot...");
  return true;
}

module.exports = {
  initUserbotListener,
};
