const aiMemoryClient = require("./aiMemoryClient");

/**
 * Recupera o contexto histórico, handoff de sessões e preferências relevantes no ai-memory.
 */
async function retrieveContext(userQuery, chatId, options = {}) {
  const isFirstTurn = typeof options === "boolean" ? options : !!options?.isFirstTurn;
  let handoffText = "";

  if (isFirstTurn) {
    try {
      const handoff = await aiMemoryClient.getSessionHandoff({ chatId });
      if (handoff) {
        handoffText = `[Handoff da Sessão Anterior]:\n${handoff}\n\n`;
      }
    } catch (err) {
      console.warn(`[contextRetriever] Erro no handoff: ${err.message}`);
    }
  }

  if (!userQuery && !handoffText) return "";

  const results = userQuery ? await aiMemoryClient.searchMemory(userQuery, 3) : [];
  if ((!results || results.length === 0) && !handoffText) return "";

  const contextBlocks = results.map((r, i) => `[Memória ${i + 1}]: ${r.content || r.text}`).join("\n");
  const content = `${handoffText}${contextBlocks}`.trim();

  return `\n--- Contexto Recuperado da Memória (ai-memory) ---\n${content}\n-------------------------------------------------\n`;
}

module.exports = {
  retrieveContext,
};
