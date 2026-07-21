const { searchMemory } = require("../memory/aiMemoryClient");

/**
 * Gera uma mensagem de saudação proativa contextualizada quando o usuário inicia o chat.
 */
async function generateGreeting(userName = "Você") {
  const recentMemories = await searchMemory("últimas conversas tarefas pendentes", 2);

  let memoryHint = "";
  if (recentMemories && recentMemories.length > 0) {
    memoryHint = `\n(Dica de contexto recente: ${recentMemories[0].content})`;
  }

  return `Olá, ${userName}! Eu sou o Lucas. Como posso te ajudar hoje?${memoryHint}`;
}

module.exports = {
  generateGreeting,
};
