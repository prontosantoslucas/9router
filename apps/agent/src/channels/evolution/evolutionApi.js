const cfg = require("../../config");

/**
 * Cliente REST de integração com a Evolution API (evolution-go).
 */
async function sendTextMessage(number, text) {
  const baseUrl = cfg.EVOLUTION_API_URL;
  if (!baseUrl) {
    console.log("[EvolutionAPI] EVOLUTION_API_URL não configurado. Simulação de envio.");
    return { ok: true, simulated: true };
  }

  const instance = cfg.EVOLUTION_INSTANCE_NAME || "lucas";
  const url = `${baseUrl.replace(/\/$/, "")}/message/sendText/${instance}`;

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
