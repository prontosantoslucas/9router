import { randomUUID } from "node:crypto";
import { upsertConversation } from "../db/db.js";
import { respondToMessage } from "../agent/llm.js";

// ============================================================
// Chat web — sessão por cookie/localStorage do lado cliente
// POST /webchat { chatId?, message } → { chatId, reply }
// ============================================================
export async function handleWebchat(req, res) {
  try {
    const { chatId: incoming, message, patientName } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message required" });
    }
    const chatId = incoming || `webchat:${randomUUID()}`;

    upsertConversation({ chatId, channel: "webchat", patientName: patientName || null });

    const { reply, iterations, toolsUsed } = await respondToMessage(chatId, message.slice(0, 2000));
    res.json({ chatId, reply, iterations, toolsUsed });
  } catch (err) {
    console.error("[webchat] error:", err);
    res.status(500).json({ error: err.message || "internal error" });
  }
}
