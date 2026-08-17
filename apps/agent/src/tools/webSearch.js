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

// Rótulo curto por engine — evita que cada linha de log carregue a URL inteira.
function engineLabel(url) {
  if (url.includes("lite.duckduckgo")) return "ddg-lite";
  if (url.includes("html.duckduckgo")) return "ddg-html";
  if (url.includes("bing.com")) return "bing";
  try {
    return new URL(url).hostname;
  } catch {
    return "desconhecido";
  }
}

/**
 * @param {string} query
 * @param {number} [limit=5] 1–10
 * @returns {Promise<Array<{title: string, url: string, snippet: string}>>}
 */
// Última falha da camada de fetch, para quem chama poder distinguir
// "busquei e não achei nada" de "não consegui buscar". Sem isso, o prospector
// reportava `discovered: 0` nos dois casos e o LLM narrava "filtros exaustos"
// — mandando o usuário trocar de nicho quando o problema era o gateway morto.
let lastFetchFailure = null;

function getLastFetchFailure() {
  return lastFetchFailure;
}

async function searchWeb(query, limit = 5) {
  if (!query) return [];
  const n = Math.max(1, Math.min(Number(limit) || 5, 10));
  // zera por chamada — só interessa a falha desta busca
  lastFetchFailure = null;
  let fetchLayerReached = false;
  const cleanQuery = String(query).replace(/["+]/g, " ").replace(/\s+/g, " ").trim();

  // Ordem de busca com fallback geolocalizado para o Brasil
  const engineUrls = [
    `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(cleanQuery)}`,
    `https://www.bing.com/search?q=${encodeURIComponent(cleanQuery)}&setlang=pt-br&cc=BR&count=${n}`,
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}&kl=br-pt`
  ];

  console.log(`[WebSearch] Buscando: "${cleanQuery}" (${n} resultados)`);

  for (const engineUrl of engineUrls) {
    const engine = engineLabel(engineUrl);
    try {
      // 1. Tenta via gateway MaxRouter
      const base = (ROUTER_BASE_URL || "").replace(/\/v1$/, "").replace(/\/+$/, "");
      let rawText = "";
      let via = "";

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
          via = "gateway";
          if (!rawText) console.warn(`[WebSearch] ${engine}: gateway respondeu 200 com conteúdo VAZIO (provider jina-reader configurado?)`);
        } else {
          console.warn(`[WebSearch] ${engine}: gateway HTTP ${res.status} — caindo para r.jina.ai direto`);
        }
      } catch (err) {
        console.warn(`[WebSearch] ${engine}: gateway inacessível (${err.message}) — caindo para r.jina.ai direto`);
      }

      // 2. Fallback direto se o gateway local/remoto não responder
      if (!rawText) {
        try {
          const directRes = await fetch(`https://r.jina.ai/${engineUrl}`, {
            signal: AbortSignal.timeout(15000)
          });
          if (directRes.ok) {
            rawText = await directRes.text();
            via = "r.jina.ai";
          } else {
            const hint = directRes.status === 429 ? " (rate-limit do uso anônimo — precisa de JINA_API_KEY)"
              : directRes.status === 403 ? " (bloqueio/consentimento)"
              : "";
            console.warn(`[WebSearch] ${engine}: r.jina.ai HTTP ${directRes.status}${hint}`);
          }
        } catch (err) {
          console.warn(`[WebSearch] ${engine}: r.jina.ai falhou (${err.message})`);
        }
      }

      if (!rawText) continue;
      // Chegou HTML/markdown de algum engine: a infra de fetch está de pé.
      // Se der 0 resultados daqui pra frente, é parser/consulta, não infra.
      fetchLayerReached = true;

      const results = parseSearchMarkdown(rawText, n);
      console.log(`[WebSearch] ${engine}: ${rawText.length} chars via ${via} → ${results.length} resultado(s)`);
      if (results.length > 0) {
        return results;
      }

      // Chegou markdown mas o parser não extraiu nada. Quase sempre é página de
      // consentimento/captcha ou mudança de layout do buscador — e a amostra é o
      // único jeito de distinguir os dois casos sem adivinhar.
      console.warn(`[WebSearch] ${engine}: markdown recebido mas o parser não extraiu NADA. Amostra: ${rawText.slice(0, 300).replace(/\s+/g, " ")}`);
    } catch (err) {
      console.warn(`[WebSearch] ${engine}: erro inesperado — ${err.message}`);
    }
  }

  // Antes esta saída era muda: zero resultados e nenhuma linha de log, o que
  // tornava impossível saber em qual camada a busca morreu.
  if (!fetchLayerReached) {
    // Nenhum dos engines devolveu UM byte: não é "não achei", é "não consegui
    // buscar". Praticamente sempre gateway fora do ar ou r.jina.ai em 429.
    lastFetchFailure =
      `nenhum dos ${engineUrls.length} engines retornou conteúdo — ` +
      `verifique se ROUTER_BASE_URL aponta para um gateway vivo e se o provider ` +
      `jina-reader está configurado (o fallback anônimo r.jina.ai é rate-limitado)`;
    console.error(`[WebSearch] FALHA DE INFRAESTRUTURA: ${lastFetchFailure}`);
  } else {
    console.warn(`[WebSearch] NENHUM resultado para "${cleanQuery}" após tentar ${engineUrls.length} engines.`);
  }
  return [];
}

module.exports = { searchWeb, parseSearchMarkdown, decodeRedirectUrl, getLastFetchFailure };
