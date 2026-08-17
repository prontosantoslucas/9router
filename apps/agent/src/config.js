require("dotenv").config();

const cfg = {
  AGENT_NAME: process.env.AGENT_NAME || "Lucas",
  BOT_TOKEN: process.env.BOT_TOKEN || "",
  ROUTER_BASE_URL: process.env.ROUTER_BASE_URL || "http://127.0.0.1:20128/v1",
  ROUTER_API_KEY: process.env.ROUTER_API_KEY || "",
  PORT: parseInt(process.env.AGENT_PORT) || 3717,
  MAX_HISTORY: parseInt(process.env.MAX_HISTORY) || 20,
  QUOTA_RETRY_SEC: parseInt(process.env.QUOTA_RETRY_SEC) || 120,
  // Ordem verificada por teste real contra o gateway em 2026-08-17: 60+ modelos
  // chamados com 5 tokens cada, latência medida. O default anterior listava
  // modelos inexistentes neste gateway (`gpt-4o-mini`, `claude-3-5-sonnet`,
  // `deepseek-chat`, `opencode/*`) — sem MODEL_RANKING no env, NADA funcionava.
  //
  // Critérios da ordem:
  //  1. Kiro primeiro: 34/34 modelos com cota, e é onde o Claude está vivo.
  //  2. Diversidade de provedor entre as primeiras posições — se a conta de um
  //     provedor cair (foi o que aconteceu com Gemini e Antigravity), o
  //     fallback não cai junto.
  //  3. Gemini por ÚLTIMO: funciona, mas o free tier corta em 20 req/dia por
  //     modelo. Como líder ele esgota a cota e derruba o agente no meio do dia.
  //
  // Fora da lista, verificados sem cota/credencial nesta conta:
  //   ag/antigravity 429 em TODOS (conta esgotada, inclusive os Claude)
  //   cc 401 · gh 403 sem licença Copilot · cl 402 · kc 402 · ds 402 sem saldo
  //   groq 404 (modelos descontinuados) · ollama 410 · gc 404 · nvidia/deepseek-* 410
  MODEL_RANKING: (process.env.MODEL_RANKING || [
    "kr/claude-haiku-4.5",                  // ~1.8s · Claude, rápido — cavalo de batalha
    "nvidia/minimaxai/minimax-m3",          // ~0.8s · outro provedor (diversidade)
    "kimchi/deepseek-v4-flash",             // ~1.2s · outro provedor
    "kr/claude-sonnet-4.5",                 // ~3.7s · melhor qualidade disponível
    "kr/glm-5",                             // ~1.0s
    "kr/deepseek-3.2",                      // ~1.2s
    "kimchi/kimi-k2.7",                     // ~1.7s
    "oc/auto",                              // ~2.0s
    "gemini/gemini-3.1-flash-lite-preview", // último: free tier, 20 req/dia
  ].join(","))
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean),
  SUPERBRAIN_B64: process.env.SUPERBRAIN_B64 || "",
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || "",
  GITHUB_PERSONALITY_URL: process.env.GITHUB_PERSONALITY_URL || "",
  AI_MEMORY_URL: process.env.AI_MEMORY_URL || "http://127.0.0.1:8080",
  AI_MEMORY_TOKEN: process.env.AI_MEMORY_TOKEN || "",
  LINKEDIN_MCP_URL: process.env.LINKEDIN_MCP_URL || "",
  LINKEDIN_MCP_TOKEN: process.env.LINKEDIN_MCP_TOKEN || "",
  EXTENSION_TOKEN: process.env.EXTENSION_TOKEN || "",
  EVOLUTION_API_URL: process.env.EVOLUTION_API_URL || "",
  EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY || "",
  EVOLUTION_INSTANCE_NAME: process.env.EVOLUTION_INSTANCE_NAME || "lucas",
  TELEGRAM_API_ID: process.env.TELEGRAM_API_ID || "",
  TELEGRAM_API_HASH: process.env.TELEGRAM_API_HASH || "",
  AUTONOMOUS_INTERACTIONS_ENABLED: process.env.AUTONOMOUS_INTERACTIONS_ENABLED === "true",
  AGENT_INTERNAL_SECRET: process.env.AGENT_INTERNAL_SECRET || "default_internal_secret",
  PHONE_AGENT_URL: process.env.PHONE_AGENT_URL || "",
  PHONE_TOKEN: process.env.PHONE_TOKEN || "",
  NOTION_TOKEN: process.env.NOTION_TOKEN || "",
  NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID || "",
  NOTION_SECOND_DATABASE_ID: process.env.NOTION_SECOND_DATABASE_ID || "",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || "",
  setBaseUrl(url) { cfg.ROUTER_BASE_URL = url; },
};

module.exports = cfg;
