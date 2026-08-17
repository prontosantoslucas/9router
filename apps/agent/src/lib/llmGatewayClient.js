const cfg = require("../config");

// Status que significam "esse modelo não vai funcionar agora, tenta o próximo"
// em vez de "a requisição está errada":
//   429 cota/rate-limit · 402 sem saldo · 401/403 credencial inválida
//   404/410 modelo não existe mais no upstream · 5xx falha do provedor
// Um 400 normalmente é payload malformado — nesse caso trocar de modelo não
// resolve, então propagamos.
function shouldTryNextModel(status) {
  return status === 429 || status === 402 || status === 401 || status === 403
    || status === 404 || status === 410 || status >= 500;
}

/**
 * Cliente LLM unificado para o Agente Lucas realizar chamadas ao gateway 9Router.
 *
 * Percorre MODEL_RANKING em ordem até um modelo responder. Antes usava apenas
 * `MODEL_RANKING[0]`, então um único modelo morto no topo da lista derrubava
 * TODA chamada de LLM do agente — foi o que zerou a geração de pitch do
 * prospector quando a cota gratuita do Gemini (20 req/dia) esgotou, mesmo
 * havendo outros sete modelos saudáveis logo abaixo na lista.
 */
async function chatCompletion({ messages, model, temperature = 0.7, max_tokens = 4096, stream = false }) {
  const baseUrl = cfg.ROUTER_BASE_URL || "http://127.0.0.1:20128/v1";
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  const headers = { "Content-Type": "application/json" };
  if (cfg.ROUTER_API_KEY) {
    headers["Authorization"] = `Bearer ${cfg.ROUTER_API_KEY}`;
  }

  // Modelo explícito = intenção do chamador, não sobrescreve com fallback.
  const candidates = model
    ? [model]
    : (cfg.MODEL_RANKING?.length ? [...cfg.MODEL_RANKING] : ["auto"]);

  let lastErr = null;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const payload = { model: candidate, messages, temperature, max_tokens, stream };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        const err = new Error(`Erro na chamada ao gateway (${response.status}): ${errText}`);
        err.status = response.status;

        if (shouldTryNextModel(response.status) && i < candidates.length - 1) {
          console.warn(
            `[LLMGatewayClient] ${candidate} indisponível (${response.status}) — tentando ${candidates[i + 1]}`
          );
          lastErr = err;
          continue;
        }
        throw err;
      }

      if (i > 0) console.log(`[LLMGatewayClient] respondido por fallback: ${candidate}`);
      if (stream) return response.body;
      return await response.json();
    } catch (err) {
      // Erro de rede (sem status): também vale tentar o próximo da lista.
      if (!err.status && i < candidates.length - 1) {
        console.warn(`[LLMGatewayClient] ${candidate} falhou (${err.message}) — tentando ${candidates[i + 1]}`);
        lastErr = err;
        continue;
      }
      console.error("[LLMGatewayClient] Erro ao comunicar com gateway 9Router:", err.message);
      throw err;
    }
  }

  throw lastErr || new Error("[LLMGatewayClient] nenhum modelo disponível no MODEL_RANKING");
}

module.exports = {
  chatCompletion,
};
