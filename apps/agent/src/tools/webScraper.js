/**
 * Extrator e raspador web sob demanda para URLs enviadas pelo usuário.
 */
async function scrapeUrl(targetUrl) {
  if (!targetUrl) return null;
  try {
    console.log(`[WebScraper] Raspando conteúdo de: ${targetUrl}`);
    const res = await fetch(targetUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MaxRouter/1.0" },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    // Extração simplificada de texto sem tags
    const cleanText = html.replace(/<script\b[^<]*>([\s\S]*?)<\/script>/gi, "")
                          .replace(/<style\b[^<]*>([\s\S]*?)<\/style>/gi, "")
                          .replace(/<[^>]+>/g, " ")
                          .replace(/\s+/g, " ")
                          .trim();

    return {
      url: targetUrl,
      title: "Página Raspada",
      content: cleanText.substring(0, 10000), // Limite de 10k caracteres
    };
  } catch (err) {
    console.error("[WebScraper] Erro ao raspar página:", err.message);
    throw err;
  }
}

module.exports = {
  scrapeUrl,
};
