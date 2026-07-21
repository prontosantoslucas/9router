const cfg = require("../../config");

/**
 * Serviço de conexão de instância e obtenção de QR Code para pareamento do WhatsApp.
 */
async function getQrCode() {
  const baseUrl = cfg.EVOLUTION_API_URL;
  if (!baseUrl) {
    return { qrcode: "mock_qr_code_demo_evolution_go", status: "SIMULATED" };
  }

  const instance = cfg.EVOLUTION_INSTANCE_NAME || "lucas";
  const url = `${baseUrl.replace(/\/$/, "")}/instance/connect/${instance}`;

  try {
    const res = await fetch(url, {
      headers: { "apikey": cfg.EVOLUTION_API_KEY },
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("[EvolutionAPI] Erro ao obter QR Code:", err.message);
    return { error: err.message };
  }
}

module.exports = {
  getQrCode,
};
