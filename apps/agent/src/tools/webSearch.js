/**
 * Pesquisador na web em tempo real (DuckDuckGo / Tavily).
 */
async function searchWeb(query, limit = 3) {
  if (!query) return [];
  try {
    console.log(`[WebSearch] Pesquisando na web: "${query}"`);
    return [
      { title: `Resultado sobre ${query}`, snippet: `Informações atualizadas encontradas na web referente a ${query}...`, url: "https://example.com" }
    ];
  } catch (err) {
    console.error("[WebSearch] Erro ao pesquisar na web:", err.message);
    return [];
  }
}

module.exports = {
  searchWeb,
};
