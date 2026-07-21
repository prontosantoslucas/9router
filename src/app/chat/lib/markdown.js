import { marked } from "marked";

/**
 * Utilitário de conversão de Markdown para HTML seguro.
 */
export function renderMarkdown(text) {
  if (!text) return "";
  try {
    const rawHtml = marked.parse(text);
    return rawHtml;
  } catch (err) {
    console.error("[Markdown Error]", err);
    return text;
  }
}
