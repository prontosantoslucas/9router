import { config } from "../config.js";
import { upsertConversation, updateConversationStatus, logWorkerEvent } from "../db/db.js";
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

// Iniciar/pareamento (retorna QR code base64)
export async function getPairingQr() {
  return evoRequest(`/instance/connect/${config.evolution.instance}`);
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
      if (config.agent.mode === "prod") {
        await sendWhatsapp(chatId, "Tudo bem! Não vou mais te enviar mensagens automáticas. Se precisar da gente, é só chamar. 💚");
      }
      return res.json({ ok: true, optedOut: true });
    }

    // Modo test: NÃO responde direto. Salva a msg e espera humano confirmar.
    // Modo prod: agente responde.
    if (config.agent.mode === "test") {
      console.log(`[test] msg de ${chatId}: ${text.slice(0, 80)} — aguardando revisão manual`);
      return res.json({ mode: "test", chatId, text });
    }

    const { reply } = await respondToMessage(chatId, text);
    await sendWhatsapp(chatId, reply);

    res.json({ ok: true });
  } catch (err) {
    console.error("[evolution webhook] error:", err);
    res.status(500).json({ error: err.message });
  }
}
