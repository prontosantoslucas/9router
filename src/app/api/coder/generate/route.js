import { handleChat } from "@/sse/handlers/chat.js";
import { initTranslators } from "open-sse/translator/index.js";

/**
 * Geração de código do Coder (primeira parte, autenticada por sessão).
 *
 * O Coder roda no navegador, e chamar /api/v1/chat/completions de lá só
 * funciona em loopback: o gateway público aceita apenas requisição local,
 * CLI token ou API key, então em deploy remoto (Railway) a chamada voltava
 * 401 "API key required for remote API access".
 *
 * Esta rota cai no bloco deny-by-default de /api/* do dashboardGuard, ou seja,
 * exige a sessão do dashboard — e delega para o mesmo handleChat do gateway,
 * devolvendo o stream SSE intacto. Assim o navegador não precisa carregar uma
 * API key e o /v1 público continua exigindo chave para clientes externos.
 */

let initialized = false;

async function ensureInitialized() {
  if (!initialized) {
    await initTranslators();
    initialized = true;
  }
}

export async function POST(request) {
  await ensureInitialized();
  return await handleChat(request);
}
