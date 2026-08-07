/**
 * Busca na web gratuita: Jina Reader (r.jina.ai, sem API key) sobre o Bing.
 * A requisição passa pelo gateway MAXROUTER (/v1/web/fetch) para não expor
 * o IP do datacenter nem depender de credenciais de provedores de busca.
 */

const { ROUTER_BASE_URL } = require("../config");
const keyrotator = require("../keyrotator");

function cleanTitle(s) {
  return String(s || "")
    .replace(/\*\*/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;/g, "")
    .trim();
}

// URLs do Bing vêm como redirecionamento (/ck/a?...&u=a1<base64>); o destino
// real está decodificado no parâmetro `u`.
function decodeBingUrl(href) {
  try {
    const u = new URL(href);
    if (u.hostname.includes("bing.com")) {
      const b64 = (u.searchParams.get("u") || "").replace(/-/g, "+").replace(/_/g, "/");
      if (b64.startsWith("a1")) {
        const real = Buffer.from(b64.slice(2), "base64").toString("utf8");
        if (/^https?:\/\//.test(real)) return real;
      }
    }
    return href;
  } catch {
    return href;
  }
}

function parseBingMarkdown(text, limit) {
  const out = [];
  const lines = String(text || "").split("\n");
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^\s*\d+\.\s+##\s+\[(.*?)\]\((.*?)\)\s*$/);
    if (m) {
      if (cur && (cur.title || cur.url)) out.push(cur);
      if (out.length >= limit) break;
      cur = { title: cleanTitle(m[1]), url: decodeBingUrl(m[2]), snippet: "" };
      continue;
    }
    if (cur) {
      const t = line.trim();
      if (t && !/^#{1,3}\s/.test(t) && !/^-{3,}/.test(t)) {
        cur.snippet = cur.snippet ? `${cur.snippet} ${t}` : t;
        if (cur.snippet.length > 300) cur.snippet = cur.snippet.slice(0, 300);
      }
    }
  }
  if (cur && (cur.title || cur.url)) out.push(cur);
  return out.slice(0, limit);
}

/**
 * @param {string} query
 * @param {number} [limit=5] 1–10
 * @returns {Promise<Array<{title: string, url: string, snippet: string}>>}
 */
async function searchWeb(query, limit = 5) {
  if (!query) return [];
  const n = Math.max(1, Math.min(Number(limit) || 5, 10));
  try {
    const base = (ROUTER_BASE_URL || "").replace(/\/v1$/, "").replace(/\/+$/, "");
    const target = `https://www.bing.com/search?q=${encodeURIComponent(String(query))}&count=${n}`;
    console.log(`[WebSearch] Buscando: "${query}" (${n} resultados)`);
    const res = await fetch(`${base}/v1/web/fetch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${keyrotator.getKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "jina-reader", url: target, format: "markdown", max_characters: 20000 }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error(`[WebSearch] Gateway falhou: ${res.status}`);
      return [];
    }
    const data = await res.json();
    return parseBingMarkdown(data.content?.text || "", n);
  } catch (err) {
    console.error("[WebSearch] Erro:", err.message);
    return [];
  }
}

module.exports = { searchWeb };
