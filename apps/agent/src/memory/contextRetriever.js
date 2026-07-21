const { searchMemory } = require("./aiMemoryClient");

/**
 * Recupera o contexto histórico e preferências relevantes no ai-memory para injeção no prompt do Lucas.
 */
async function retrieveContext(userQuery, chatId) {
  if (!userQuery) return "";

  const results = await searchMemory(userQuery, 3);
  if (!results || results.length === 0) return "";

  const contextBlocks = results.map((r, i) => `[Memória ${i + 1}]: ${r.content}`).join("\n");
  return `\n--- Contexto Recuperado da Memória (ai-memory) ---\n${contextBlocks}\n-------------------------------------------------\n`;
}

module.exports = {
  retrieveContext,
};
