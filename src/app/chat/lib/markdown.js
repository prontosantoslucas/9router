import { marked } from "marked";

/**
 * Markdown → HTML para as bolhas do chat.
 */

// Markdown trata 4+ espaços de indentação como BLOCO DE CÓDIGO. Uma linha
// indentada que é só uma URL virava <pre><code>: não clicável, monoespaçada e
// cortada na largura da bolha. Como o texto vem de tools e do próprio modelo,
// que indentam para alinhar visualmente sem saber dessa regra, o normal é isso
// acontecer — então a correção fica aqui, não na esperança de todo mundo lembrar.
//
// Só desindenta linha cujo conteúdo é EXCLUSIVAMENTE uma URL (ou um link
// markdown). Bloco de código de verdade — que tem texto junto — fica intacto.
const LINHA_SO_URL = /^[ \t]{2,}((?:https?:\/\/\S+|\[[^\]]+\]\(https?:\/\/[^)]+\)))[ \t]*$/;

function desindentarUrls(text) {
  return String(text)
    .split("\n")
    .map((linha) => {
      const m = linha.match(LINHA_SO_URL);
      // Mantém 1 espaço: preserva o aninhamento visual em lista sem virar código.
      return m ? " " + m[1] : linha;
    })
    .join("\n");
}

// URL nua com query longa nem sempre é autolinkada, e quando é, exibe a URL
// inteira e estoura a bolha. Converte em link markdown com rótulo curto.
const URL_NUA_LONGA = /(^|[\s(])((https?:\/\/[^\s<>()]{60,}))(?=$|[\s).,;])/g;

function encurtarUrlsLongas(text) {
  return String(text).replace(URL_NUA_LONGA, (full, antes, url) => {
    try {
      const u = new URL(url);
      const rotulo = u.hostname.replace(/^www\./, "") + (u.pathname !== "/" ? u.pathname.slice(0, 24) : "");
      return `${antes}[${rotulo}…](${url})`;
    } catch {
      return full;
    }
  });
}

export function renderMarkdown(text) {
  if (!text) return "";
  try {
    const preparado = encurtarUrlsLongas(desindentarUrls(text));
    return marked.parse(preparado);
  } catch (err) {
    console.error("[Markdown Error]", err);
    return text;
  }
}

export const __test__ = { desindentarUrls, encurtarUrlsLongas };
