const { recordMemory } = require("./aiMemoryClient");

/**
 * Grava o resumo de uma interação concluída de volta na wiki do ai-memory.
 */
async function recordInteraction(chatId, userMessage, agentReply, channel = "web") {
  if (!userMessage || !agentReply) return;

  const content = `[Canal: ${channel}] [ChatID: ${chatId}]\nUsuário: ${userMessage}\nLucas: ${agentReply}`;
  await recordMemory(content, { channel, chatId });
}

module.exports = {
  recordInteraction,
};
