import { config } from "../config.js";
import {
  upsertConversation,
  updateConversationStatus,
  logWorkerEvent,
  getEffectiveAgentMode,
  isAllowedForDemo,
} from "../db/db.js";
import { respondToMessage } from "../agent/llm.js";

// Palavras que sinalizam opt-out (LGPD Art. 18 — direito de oposição).
const OPT_OUT_KEYWORDS = /^(sair|parar|pare|cancelar|descadastrar|remover|stop|n[aã]o quero|me tira)/i;

// ============================================================
// Cliente Evolution API (WhatsApp Business unofficial gateway)
// Docs: https://doc.evolution-api.com/v2
// ============================================================
async function evoRequest(pathname, opts = {}) {
  const url = `${config.evolution.url.replace(/\/$/, "")}${pathname}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      apikey: config.evolution.token,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evolution ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function sendWhatsapp(chatId, text) {
  const number = chatId.replace(/^whatsapp:/, "").replace(/\D/g, "");
  return evoRequest(`/message/sendText/${config.evolution.instance}`, {
    method: "POST",
    body: JSON.stringify({
      number,
      text,
    }),
  });
}

// Obter estado de conexão e QR Code da instância configurada na Evolution API
export async function getPairingQr() {
  try {
    const data = await evoRequest(`/instance/connect/${config.evolution.instance}`);
    
    // Verifica se a instância já está conectada
    const isConnected = 
      data.connected === true ||
      data.status === "open" ||
      data.instance?.state === "open" ||
      data.state === "open";

    if (isConnected) {
      return { connected: true, base64: null, status: "open" };
    }

    // Extrai o QR code base64 ou o código bruto de pareamento
    const rawCode = data.code || data.qrcode?.code || data.pairingCode;
    let base64 = data.base64 || data.qrcode?.base64;

    if (!base64 && rawCode) {
      base64 = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(rawCode)}`;
    }

    if (base64 && !base64.startsWith("data:") && !base64.startsWith("http")) {
      base64 = `data:image/png;base64,${base64}`;
    }

    return {
      connected: false,
      status: data.status || "connecting",
      base64: base64 || null,
      rawCode: rawCode || null,
    };
  } catch (err) {
    console.warn(`[evolution] Erro ao consultar instância ${config.evolution.instance}: ${err.message}`);
    return {
      connected: false,
      status: "error",
      error: err.message,
      base64: null,
    };
  }
}

export function generateDemoQrSvg(instanceName = "zenda-clinic") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 250" width="220" height="220">
    <rect width="250" height="250" fill="#ffffff" rx="16"/>
    <!-- Finder Pattern 1 (Top Left) -->
    <rect x="20" y="20" width="60" height="60" fill="#0f172a" rx="8"/>
    <rect x="30" y="30" width="40" height="40" fill="#ffffff" rx="4"/>
    <rect x="40" y="40" width="20" height="20" fill="#10b981" rx="2"/>

    <!-- Finder Pattern 2 (Top Right) -->
    <rect x="170" y="20" width="60" height="60" fill="#0f172a" rx="8"/>
    <rect x="180" y="30" width="40" height="40" fill="#ffffff" rx="4"/>
    <rect x="190" y="40" width="20" height="20" fill="#10b981" rx="2"/>

    <!-- Finder Pattern 3 (Bottom Left) -->
    <rect x="20" y="170" width="60" height="60" fill="#0f172a" rx="8"/>
    <rect x="30" y="180" width="40" height="40" fill="#ffffff" rx="4"/>
    <rect x="40" y="190" width="20" height="20" fill="#10b981" rx="2"/>

    <!-- Data Matrix simulation pixels -->
    <rect x="90" y="20" width="12" height="12" fill="#0f172a"/>
    <rect x="110" y="20" width="24" height="12" fill="#0f172a"/>
    <rect x="145" y="20" width="12" height="12" fill="#0f172a"/>

    <rect x="90" y="40" width="24" height="12" fill="#0f172a"/>
    <rect x="125" y="40" width="12" height="12" fill="#10b981"/>
    <rect x="145" y="40" width="12" height="12" fill="#0f172a"/>

    <rect x="90" y="60" width="12" height="12" fill="#0f172a"/>
    <rect x="110" y="60" width="12" height="12" fill="#0f172a"/>
    <rect x="135" y="60" width="22" height="12" fill="#0f172a"/>

    <rect x="20" y="90" width="12" height="24" fill="#0f172a"/>
    <rect x="40" y="90" width="24" height="12" fill="#0f172a"/>
    <rect x="75" y="90" width="12" height="24" fill="#0f172a"/>
    <rect x="95" y="90" width="30" height="12" fill="#10b981"/>
    <rect x="135" y="90" width="12" height="24" fill="#0f172a"/>
    <rect x="155" y="90" width="24" height="12" fill="#0f172a"/>
    <rect x="190" y="90" width="12" height="24" fill="#0f172a"/>
    <rect x="215" y="90" width="15" height="12" fill="#0f172a"/>

    <rect x="20" y="125" width="24" height="12" fill="#0f172a"/>
    <rect x="55" y="125" width="12" height="24" fill="#10b981"/>
    <rect x="75" y="125" width="24" height="12" fill="#0f172a"/>
    <rect x="110" y="125" width="12" height="12" fill="#0f172a"/>
    <rect x="135" y="125" width="24" height="12" fill="#0f172a"/>
    <rect x="170" y="125" width="12" height="24" fill="#0f172a"/>
    <rect x="195" y="125" width="35" height="12" fill="#0f172a"/>

    <rect x="20" y="145" width="12" height="12" fill="#0f172a"/>
    <rect x="40" y="145" width="24" height="12" fill="#0f172a"/>
    <rect x="95" y="145" width="12" height="12" fill="#0f172a"/>
    <rect x="115" y="145" width="24" height="12" fill="#10b981"/>
    <rect x="155" y="145" width="12" height="12" fill="#0f172a"/>
    <rect x="180" y="145" width="24" height="12" fill="#0f172a"/>
    <rect x="215" y="145" width="15" height="12" fill="#0f172a"/>

    <rect x="90" y="170" width="24" height="12" fill="#0f172a"/>
    <rect x="125" y="170" width="12" height="24" fill="#0f172a"/>
    <rect x="145" y="170" width="24" height="12" fill="#10b981"/>
    <rect x="180" y="170" width="50" height="12" fill="#0f172a"/>

    <rect x="90" y="195" width="12" height="24" fill="#0f172a"/>
    <rect x="110" y="195" width="24" height="12" fill="#0f172a"/>
    <rect x="145" y="195" width="12" height="24" fill="#0f172a"/>
    <rect x="170" y="195" width="24" height="12" fill="#0f172a"/>
    <rect x="205" y="195" width="25" height="12" fill="#0f172a"/>

    <rect x="90" y="225" width="35" height="10" fill="#0f172a"/>
    <rect x="135" y="225" width="20" height="10" fill="#10b981"/>
    <rect x="165" y="225" width="65" height="10" fill="#0f172a"/>
  </svg>`;
}

// ============================================================
// Handler do webhook — Evolution posta aqui quando chega msg
// ============================================================
export async function handleEvolutionWebhook(req, res) {
  try {
    const event = req.body;
    // Evolution manda várias events: messages.upsert é o principal
    if (event.event !== "messages.upsert") {
      return res.json({ ignored: event.event });
    }
    const data = event.data;
    if (!data || data.key?.fromMe) {
      return res.json({ ignored: "fromMe or empty" });
    }
    const remoteJid = data.key.remoteJid;
    const text = data.message?.conversation
      || data.message?.extendedTextMessage?.text
      || "";
    if (!text) return res.json({ ignored: "no text" });

    // Normaliza chatId: whatsapp:5511987654321
    const phone = remoteJid.split("@")[0];
    const chatId = `whatsapp:${phone}`;

    upsertConversation({ chatId, channel: "whatsapp", patientName: data.pushName || null });

    // Opt-out (LGPD): paciente pediu pra parar → marca e confirma, sem passar pelo LLM.
    if (OPT_OUT_KEYWORDS.test(text.trim())) {
      updateConversationStatus(chatId, "opted_out");
      logWorkerEvent({ kind: "reengagement", chatId, status: "skipped", payload: { reason: "opted_out" } });
      if (getEffectiveAgentMode() === "prod") {
        await sendWhatsapp(chatId, "Tudo bem! Não vou mais te enviar mensagens automáticas. Se precisar da gente, é só chamar. 💚");
      }
      return res.json({ ok: true, optedOut: true });
    }

    // Modo test: NÃO responde direto. Salva a msg e espera humano confirmar.
    // Modo prod: agente responde. O modo vem do painel (runtime_config) com
    // fallback pra env var — antes lia só a env e o seletor do painel não valia.
    if (getEffectiveAgentMode() !== "prod") {
      console.log(`[test] msg de ${chatId}: ${text.slice(0, 80)} — aguardando revisão manual`);
      return res.json({ mode: "test", chatId, text });
    }

    // Allowlist de demonstração: rodando no número pessoal/comercial, só
    // responde a quem está na lista. Sem isso, ligar o modo prod pra fazer uma
    // demo faria o agente responder a TODO contato que chamasse — prospect,
    // cliente real, familiar — como se fossem pacientes da clínica fictícia.
    if (!isAllowedForDemo(chatId)) {
      console.log(`[demo] msg de ${chatId} ignorada — fora da allowlist`);
      return res.json({ ignored: "not-in-demo-allowlist", chatId });
    }

    const { reply } = await respondToMessage(chatId, text);
    await sendWhatsapp(chatId, reply);

    res.json({ ok: true });
  } catch (err) {
    console.error("[evolution webhook] error:", err);
    res.status(500).json({ error: err.message });
  }
}
