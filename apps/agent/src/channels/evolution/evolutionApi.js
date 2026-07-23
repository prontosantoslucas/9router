const cfg = require("../../config");

/**
 * Cliente REST de integração com a Evolution API (evolution-go).
 */
// `to` pode ser um número (DM) ou um JID completo de grupo (xxx@g.us).
async function sendTextMessage(to, text) {
  const baseUrl = cfg.EVOLUTION_API_URL;
  if (!baseUrl) {
    const nativeClient = require("../whatsapp/nativeClient");
    return nativeClient.sendTextMessage(to, text);
  }

  const instance = cfg.EVOLUTION_INSTANCE_NAME || "lucas";
  const url = `${baseUrl.replace(/\/$/, "")}/message/sendText/${instance}`;
  // Evolution aceita o JID do grupo (…@g.us) ou o número puro no campo `number`.
  const number = String(to);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": cfg.EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number,
        text,
      }),
    });

    const data = await res.json();
    return data;
  } catch (err) {
    console.error("[EvolutionAPI] Erro ao enviar mensagem WhatsApp:", err.message);
    throw err;
  }
}

module.exports = {
  sendTextMessage,
};
