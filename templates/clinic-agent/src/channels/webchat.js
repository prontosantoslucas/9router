import { randomUUID } from "node:crypto";
import { upsertConversation } from "../db/db.js";
import { respondToMessage } from "../agent/llm.js";

// Rate limiting simples por IP (20 requisições / 5 minutos)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (now > entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
  } else {
    entry.count++;
  }

  rateLimitMap.set(ip, entry);
  return entry.count <= MAX_REQUESTS_PER_WINDOW;
}

// ============================================================
// Chat web seguro — sessão forçada no namespace webchat:*
// POST /webchat { chatId?, message } → { chatId, reply }
// ============================================================
export async function handleWebchat(req, res) {
  try {
    const clientIp = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({ error: "Limite de requisições excedido. Aguarde alguns minutos." });
    }

    const { chatId: incoming, message, patientName } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message required" });
    }

    // ISOLAMENTO DE SEGURANÇA CRÍTICO:
    // NUNCA aceita chatId de telefone ou outro canal vindo do cliente.
    // Preserva estritamente o prefixo "webchat:".
    let chatId;
    if (incoming && typeof incoming === "string" && incoming.startsWith("webchat:")) {
      // Sanitiza para manter apenas o sufixo alfanumérico/hífen do UUID
      const cleanId = incoming.slice(8).replace(/[^a-zA-Z0-9-]/g, "");
      chatId = `webchat:${cleanId || randomUUID()}`;
    } else {
      chatId = `webchat:${randomUUID()}`;
    }

    upsertConversation({ chatId, channel: "webchat", patientName: patientName || null });

    const { reply, iterations, toolsUsed } = await respondToMessage(chatId, message.slice(0, 2000));
    res.json({ chatId, reply, iterations, toolsUsed });
  } catch (err) {
    console.error("[webchat] error:", err);
    res.status(500).json({ error: err.message || "internal error" });
  }
}
