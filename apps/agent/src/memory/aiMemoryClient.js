const cfg = require("../config");

/**
 * Cliente HTTP/MCP para comunicação obrigatória com o servidor ai-memory.
 */
async function searchMemory(query, limit = 5) {
  const baseUrl = cfg.AI_MEMORY_URL || "http://127.0.0.1:8080";
  try {
    const res = await fetch(`${baseUrl}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit }),
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.error("[ai-memory] Erro ao buscar na memória:", err.message);
    return [];
  }
}

async function recordMemory(content, metadata = {}) {
  const baseUrl = cfg.AI_MEMORY_URL || "http://127.0.0.1:8080";
  try {
    const res = await fetch(`${baseUrl}/record`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, metadata, timestamp: Date.now() }),
    });

    return res.ok;
  } catch (err) {
    console.error("[ai-memory] Erro ao gravar memória:", err.message);
    return false;
  }
}

module.exports = {
  searchMemory,
  recordMemory,
};
