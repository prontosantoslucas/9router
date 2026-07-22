require("dotenv").config();

const cfg = {
  AGENT_NAME: process.env.AGENT_NAME || "Lucas",
  BOT_TOKEN: process.env.BOT_TOKEN || "",
  ROUTER_BASE_URL: process.env.ROUTER_BASE_URL || "http://127.0.0.1:20128/v1",
  ROUTER_API_KEY: process.env.ROUTER_API_KEY || "",
  PORT: parseInt(process.env.AGENT_PORT) || 3717,
  MAX_HISTORY: parseInt(process.env.MAX_HISTORY) || 20,
  QUOTA_RETRY_SEC: parseInt(process.env.QUOTA_RETRY_SEC) || 120,
  MODEL_RANKING: (process.env.MODEL_RANKING || "opencode/gemini-2.5-flash,opencode/claude-3-5-haiku,opencode/gpt-4o-mini,mimo-free/mimo-v1,gemini-2.5-flash,gpt-4o-mini,gpt-4o,claude-3-5-sonnet,deepseek-chat")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean),
  SUPERBRAIN_B64: process.env.SUPERBRAIN_B64 || "",
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || "",
  GITHUB_PERSONALITY_URL: process.env.GITHUB_PERSONALITY_URL || "",
  AI_MEMORY_URL: process.env.AI_MEMORY_URL || "http://127.0.0.1:8080",
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
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || "",
  setBaseUrl(url) { cfg.ROUTER_BASE_URL = url; },
};

module.exports = cfg;
