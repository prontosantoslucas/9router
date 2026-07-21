const cfg = require("../config");

/**
 * Cliente LLM unificado para o Agente Lucas realizar chamadas ao gateway 9Router.
 */
async function chatCompletion({ messages, model, temperature = 0.7, max_tokens = 4096, stream = false }) {
  const baseUrl = cfg.ROUTER_BASE_URL || "http://127.0.0.1:20128/v1";
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  const headers = {
    "Content-Type": "application/json",
  };

  if (cfg.ROUTER_API_KEY) {
    headers["Authorization"] = `Bearer ${cfg.ROUTER_API_KEY}`;
  }

  const payload = {
    model: model || cfg.MODEL_RANKING[0] || "kr/auto-thinking",
    messages,
    temperature,
    max_tokens,
    stream,
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro na chamada ao gateway (${response.status}): ${errText}`);
    }

    if (stream) {
      return response.body;
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error("[LLMGatewayClient] Erro ao comunicar com gateway 9Router:", err.message);
    throw err;
  }
}

module.exports = {
  chatCompletion,
};
