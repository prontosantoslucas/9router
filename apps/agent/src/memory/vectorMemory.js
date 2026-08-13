const db = require("../db");

/**
 * Tokeniza e limpa um texto em termos relevantes.
 */
function tokenize(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/**
 * Calcula a pontuação de similaridade baseada em sobreposição de termos e TF (Term Frequency).
 */
function computeSemanticSimilarity(queryTokens, documentText) {
  const docTokens = tokenize(documentText);
  if (docTokens.length === 0 || queryTokens.length === 0) return 0;

  const docFreq = {};
  for (const t of docTokens) {
    docFreq[t] = (docFreq[t] || 0) + 1;
  }

  let matchScore = 0;
  for (const qTerm of queryTokens) {
    if (docFreq[qTerm]) {
      matchScore += 1 + Math.log(docFreq[qTerm]);
    }
  }

  // Normalização por comprimento do documento (evita penalizar respostas concisas)
  const normFactor = Math.sqrt(docTokens.length);
  return matchScore / (normFactor || 1);
}

/**
 * Executa busca semântica em memórias locais salvas no SQLite.
 */
function searchMemorySemantic(query = "", topK = 5) {
  try {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const rows = db.prepare("SELECT id, text, tags, source, created_at FROM memories").all();

    const scored = rows.map((row) => {
      const score = computeSemanticSimilarity(queryTokens, row.text);
      return {
        id: row.id,
        text: row.text,
        tags: JSON.parse(row.tags || "[]"),
        source: row.source,
        created_at: row.created_at,
        score
      };
    });

    return scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  } catch (err) {
    console.error("[VectorMemory] Erro na busca semântica:", err.message);
    return [];
  }
}

module.exports = {
  tokenize,
  computeSemanticSimilarity,
  searchMemorySemantic
};
