const cfg = require("../config");

/**
 * Baixa documentos Markdown de personalidade do GitHub (públicos ou privados com PAT).
 */
async function fetchGithubPersonality(url, token = "") {
  if (!url) return null;

  const patToken = token || cfg.GITHUB_TOKEN;
  let rawUrl = url;

  // Converter URLs normais do GitHub para raw se necessário
  if (url.includes("github.com") && !url.includes("raw.githubusercontent.com")) {
    rawUrl = url
      .replace("github.com", "raw.githubusercontent.com")
      .replace("/blob/", "/");
  }

  const headers = {};
  if (patToken) {
    headers["Authorization"] = `token ${patToken}`;
  }

  try {
    const res = await fetch(rawUrl, { headers });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: Não foi possível baixar a personalidade do GitHub`);
    }

    const content = await res.text();
    return content;
  } catch (err) {
    console.error("[GitHubFetcher] Erro:", err.message);
    throw err;
  }
}

module.exports = {
  fetchGithubPersonality,
};
