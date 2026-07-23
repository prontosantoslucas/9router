const cfg = require("../../config");

/**
 * Conexão de instância + QR Code para pareamento do WhatsApp via Evolution API (v2).
 *
 * Fluxo correto da Evolution:
 *  1. A instância precisa EXISTIR. Tentamos criar (POST /instance/create); se já
 *     existir, a Evolution retorna erro que ignoramos.
 *  2. Buscamos o QR em GET /instance/connect/{instance}.
 *  3. Normalizamos a resposta para { base64, code, status } — o frontend rende
 *     `base64` (imagem data:) direto, ou codifica `code` (payload de pareamento).
 *
 * IMPORTANTE: o QR da Evolution/WhatsApp EXPIRA em ~40s e rotaciona. Se o usuário
 * demorar, precisa gerar de novo. Nunca retornamos QR falso — sem config real,
 * devolvemos erro claro para a UI não exibir um QR inválido.
 */

const INSTANCE = () => cfg.EVOLUTION_INSTANCE_NAME || "lucas";

function base() {
  const b = cfg.EVOLUTION_API_URL;
  return b ? b.replace(/\/$/, "") : null;
}

async function ensureInstance() {
  const url = `${base()}/instance/create`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg.EVOLUTION_API_KEY },
      body: JSON.stringify({
        instanceName: INSTANCE(),
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      }),
    });
    const data = await res.json().catch(() => ({}));
    // 201 = criada agora (já vem com qrcode). 403/409 = já existe (ok).
    if (res.ok) return data;
    return null;
  } catch (err) {
    console.warn("[EvolutionAPI] create instance:", err.message);
    return null;
  }
}

function normalize(data) {
  if (!data || typeof data !== "object") return { error: "resposta vazia da Evolution" };
  // Formatos possíveis: { base64, code }, { qrcode: { base64, code } }, { instance, qrcode }
  const qr = data.qrcode && typeof data.qrcode === "object" ? data.qrcode : data;
  const base64 = qr.base64 || (typeof data.base64 === "string" ? data.base64 : null);
  const code = qr.code || qr.pairingCode || data.code || data.pairingCode || null;
  const state = data.instance?.state || data.state || data.status || null;
  if (!base64 && !code) {
    return { error: data.error || data.message || "QR não retornado (instância pode já estar conectada)", state };
  }
  return { base64, code, status: state || "QRCODE" };
}

async function getQrCode() {
  const b = base();
  if (!b) {
    return { error: "EVOLUTION_API_URL não configurado. Configure o servidor Evolution API primeiro." };
  }

  // 1. Garante que a instância existe (create devolve QR se criada agora)
  const created = await ensureInstance();
  if (created) {
    const norm = normalize(created);
    if (norm.base64 || norm.code) return norm;
  }

  // 2. Conecta para obter/renovar o QR
  const url = `${b}/instance/connect/${INSTANCE()}`;
  try {
    const res = await fetch(url, { headers: { apikey: cfg.EVOLUTION_API_KEY } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: data.message || data.error || `Evolution HTTP ${res.status}` };
    }
    return normalize(data);
  } catch (err) {
    console.error("[EvolutionAPI] connect:", err.message);
    return { error: err.message };
  }
}

// Status da conexão (para o HealthDot / polling)
async function getConnectionState() {
  const b = base();
  if (!b) return { state: "not_configured" };
  try {
    const res = await fetch(`${b}/instance/connectionState/${INSTANCE()}`, {
      headers: { apikey: cfg.EVOLUTION_API_KEY },
    });
    const data = await res.json().catch(() => ({}));
    return { state: data.instance?.state || data.state || "unknown" };
  } catch (err) {
    return { state: "error", error: err.message };
  }
}

module.exports = { getQrCode, getConnectionState };
