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

    const data = await res.json().catch(() => null);

    // Antes era `return data` sem olhar o status: 401 (apikey errada), 404
    // (instância inexistente) e 400 voltavam como resposta NORMAL, sem
    // exceção. Quem chamava concluía que enviou. No prospector isso marcava
    // o lead como 'sent' sem uma única mensagem entregue.
    if (!res.ok) {
      const detail = data?.message || data?.error || `HTTP ${res.status}`;
      const err = new Error(`Evolution recusou o envio (${res.status}): ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 200)}`);
      err.status = res.status;
      throw err;
    }
    return data;
  } catch (err) {
    console.error("[EvolutionAPI] Erro ao enviar mensagem WhatsApp:", err.message);
    throw err;
  }
}

module.exports = {
  sendTextMessage,
};
