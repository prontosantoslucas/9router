const db = require("./db");

/**
 * Higieniza e normaliza um texto removendo acentos, pontuação e espaços múltiplos.
 */
function normalizeText(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Converte um texto normalizado num Set de palavras únicas.
 */
function getTokens(text) {
  const words = normalizeText(text).split(" ").filter(w => w.length > 1);
  return new Set(words);
}

/**
 * Calcula a similaridade de Jaccard entre dois conjuntos de tokens.
 */
function calcJaccardSimilarity(tokens1, tokens2) {
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  let intersection = 0;
  for (const token of tokens1) {
    if (tokens2.has(token)) intersection++;
  }
  const union = tokens1.size + tokens2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Busca uma resposta no cache semântico com similaridade acima do limiar (default 0.90).
 */
function get(promptText, threshold = 0.90) {
  const normPrompt = normalizeText(promptText);
  if (!normPrompt || normPrompt.length < 5) return null;

  const targetTokens = getTokens(promptText);

  // Buscar candidatas recentes no SQLite (máximo 200 entradas mais recentes)
  const candidates = db
    .prepare("SELECT id, prompt_norm, prompt_raw, response, model, hit_count FROM semantic_cache ORDER BY id DESC LIMIT 200")
    .all();

  let bestMatch = null;
  let maxScore = 0;

  for (const row of candidates) {
    // Match exato instantâneo
    if (row.prompt_norm === normPrompt) {
      bestMatch = row;
      maxScore = 1.0;
      break;
    }

    const candidateTokens = getTokens(row.prompt_raw);
    const score = calcJaccardSimilarity(targetTokens, candidateTokens);

    if (score > maxScore && score >= threshold) {
      maxScore = score;
      bestMatch = row;
    }
  }

  if (bestMatch) {
    try {
      db.prepare(
        "UPDATE semantic_cache SET hit_count = hit_count + 1, updated_at = datetime('now') WHERE id = ?"
      ).run(bestMatch.id);
    } catch {}

    return {
      response: bestMatch.response,
      model: bestMatch.model,
      similarity: maxScore,
      hitCount: bestMatch.hit_count + 1,
    };
  }

  return null;
}

/**
 * Armazena um par (prompt, resposta) no cache semântico.
 */
function set(promptText, responseText, model = "cache") {
  const normPrompt = normalizeText(promptText);
  if (!normPrompt || normPrompt.length < 5 || !responseText) return;

  try {
    const existing = db
      .prepare("SELECT id FROM semantic_cache WHERE prompt_norm = ?")
      .get(normPrompt);

    if (existing) {
      db.prepare(
        "UPDATE semantic_cache SET response = ?, model = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(responseText, model, existing.id);
    } else {
      db.prepare(
        "INSERT INTO semantic_cache (prompt_norm, prompt_raw, response, model) VALUES (?, ?, ?, ?)"
      ).run(normPrompt, promptText, responseText, model);
    }
  } catch (err) {
    console.warn("[SemanticCache] Erro ao gravar cache:", err.message);
  }
}

/**
 * Limpa o cache semântico.
 */
function clear() {
  try {
    db.prepare("DELETE FROM semantic_cache").run();
  } catch {}
}

module.exports = {
  normalizeText,
  getTokens,
  calcJaccardSimilarity,
  get,
  set,
  clear,
};
