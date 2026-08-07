/**
 * Extrator e raspador web sob demanda para URLs enviadas pelo usuário.
 * Usa Jina Reader (r.jina.ai — gratuito, sem API key) através do gateway
 * MAXROUTER; cai para fetch direto se o gateway falhar.
 */

const { ROUTER_BASE_URL } = require("../config");
const keyrotator = require("../keyrotator");

async function scrapeUrl(targetUrl) {
  if (!targetUrl) return null;
  try {
    console.log(`[WebScraper] Raspando conteúdo de: ${targetUrl}`);
    const base = (ROUTER_BASE_URL || "").replace(/\/v1$/, "").replace(/\/+$/, "");
    const res = await fetch(`${base}/v1/web/fetch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${keyrotator.getKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "jina-reader", url: targetUrl, format: "markdown", max_characters: 10000 }),
      signal: AbortSignal.timeout(35000),
    });
    if (!res.ok) throw new Error(`Gateway HTTP ${res.status}`);
    const data = await res.json();
    const text = (data.content?.text || "").trim();
    if (!text) throw new Error("Jina Reader retornou conteúdo vazio");
    return {
      url: targetUrl,
      title: data.title || "Página",
      content: text.substring(0, 10000),
    };
  } catch (err) {
    console.warn(`[WebScraper] Jina falhou (${err.message}), tentando fetch direto...`);
    const res = await fetch(targetUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MaxRouter/1.0" },
      signal: AbortSignal.timeout(15000),
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
  }
}

module.exports = {
  scrapeUrl,
};
