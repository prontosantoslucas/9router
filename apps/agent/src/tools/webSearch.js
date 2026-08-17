/**
 * Motor de Busca Web com Resiliência Multi-Buscador (DuckDuckGo + Bing BR) via Jina Reader.
 * Utiliza o gateway MAXROUTER (/v1/web/fetch) com fallback direto para r.jina.ai.
 */

const { ROUTER_BASE_URL } = require("../config");
const keyrotator = require("../keyrotator");

function cleanTitle(s) {
  return String(s || "")
    .replace(/\*\*/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;/g, "")
    .replace(/^\[|\]$/g, "")
    .trim();
}

// Decodifica URLs de redirecionamento do DuckDuckGo e Bing
function decodeRedirectUrl(href) {
  try {
    const u = new URL(href);
    // DuckDuckGo redirect
    if (u.hostname.includes("duckduckgo.com") && u.searchParams.has("uddg")) {
      const target = decodeURIComponent(u.searchParams.get("uddg"));
      if (/^https?:\/\//i.test(target)) return target;
    }
    // Bing redirect
    if (u.hostname.includes("bing.com") && u.searchParams.has("u")) {
      const b64 = (u.searchParams.get("u") || "").replace(/-/g, "+").replace(/_/g, "/");
      if (b64.startsWith("a1")) {
        const real = Buffer.from(b64.slice(2), "base64").toString("utf8");
        if (/^https?:\/\//i.test(real)) return real;
      }
    }
    return href;
  } catch {
    return href;
  }
}

// Parser resiliente de Markdown de busca (DuckDuckGo Lite, Bing, HTML)
function parseSearchMarkdown(text, limit = 5) {
  const out = [];
  const lines = String(text || "").split("\n");

  // Padrões aceitos:
  // 1. DuckDuckGo Lite: "1.[Título](url)" ou "1. [Título](url)"
  // 2. Bing: "1.   ## [Título](url)"
  // 3. Padrão genérico: "## [Título](url)" ou "[Título](url)"
  const linkRegex = /(?:^\s*\d+\.?\s*(?:##\s*)?\[|^\s*##\s*\[)(.*?)\]\((https?:\/\/[^\s)]+)\)/;

  let cur = null;
  for (const line of lines) {
    const m = line.match(linkRegex);
    if (m) {
      const title = cleanTitle(m[1]);
      const rawUrl = decodeRedirectUrl(m[2]);

      // Ignora links internos de infraestrutura dos buscadores
      if (
        rawUrl.includes("duckduckgo.com") ||
        rawUrl.includes("bing.com") ||
        rawUrl.includes("google.com/search") ||
        rawUrl.includes("microsoft.com") ||
        rawUrl.includes("yahoo.com")
      ) {
        continue;
      }

      if (cur && (cur.title || cur.url)) out.push(cur);
      if (out.length >= limit) break;
      cur = { title, url: rawUrl, snippet: "" };
      continue;
    }

    if (cur) {
      const t = line.trim();
      if (t && !/^#{1,3}\s/.test(t) && !/^-{3,}/.test(t) && !/^\[/.test(t)) {
        cur.snippet = cur.snippet ? `${cur.snippet} ${t}` : t;
        if (cur.snippet.length > 400) cur.snippet = cur.snippet.slice(0, 400);
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
  const cleanQuery = String(query).replace(/["+]/g, " ").replace(/\s+/g, " ").trim();

  // Ordem de busca com fallback geolocalizado para o Brasil
  const engineUrls = [
    `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(cleanQuery)}`,
    `https://www.bing.com/search?q=${encodeURIComponent(cleanQuery)}&setlang=pt-br&cc=BR&count=${n}`,
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}&kl=br-pt`
  ];

  console.log(`[WebSearch] Buscando: "${cleanQuery}" (${n} resultados)`);

  for (const engineUrl of engineUrls) {
    try {
      // 1. Tenta via gateway MaxRouter
      const base = (ROUTER_BASE_URL || "").replace(/\/v1$/, "").replace(/\/+$/, "");
      let rawText = "";

      try {
        const res = await fetch(`${base}/v1/web/fetch`, {
          method: "POST",
          headers: { Authorization: `Bearer ${keyrotator.getKey()}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "jina-reader", url: engineUrl, format: "markdown", max_characters: 25000 }),
          signal: AbortSignal.timeout(20000),
        });
        if (res.ok) {
          const data = await res.json();
          rawText = data.content?.text || "";
        }
      } catch {}

      // 2. Fallback direto se o gateway local/remoto não responder
      if (!rawText) {
        const directRes = await fetch(`https://r.jina.ai/${engineUrl}`, {
          signal: AbortSignal.timeout(15000)
        });
        if (directRes.ok) {
          rawText = await directRes.text();
        }
      }

      if (rawText) {
        const results = parseSearchMarkdown(rawText, n);
        if (results.length > 0) {
          return results;
        }
      }
    } catch (err) {
      console.warn(`[WebSearch] Aviso no motor ${engineUrl.slice(0, 40)}:`, err.message);
    }
  }

  return [];
}

module.exports = { searchWeb, parseSearchMarkdown, decodeRedirectUrl };
