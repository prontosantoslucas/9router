export default {
  id: "zenmux",
  priority: 70,
  alias: "zenmux",
  display: {
    name: "ZenMux",
    icon: "hub",
    color: "#10B981",
    textIcon: "ZM",
    website: "https://zenmux.ai",
    notice: {
      text: "Unified gateway for 100+ models (GLM, Claude, GPT, Gemini). Subscription keys: sk-ss-v1-*, pay-as-you-go: sk-ai-v1-*.",
      apiKeyUrl: "https://zenmux.ai/settings/keys",
    },
  },
  category: "apikey",
  authType: "apikey",
  transport: {
    baseUrl: "https://zenmux.ai/api/v1/chat/completions",
    validateUrl: "https://zenmux.ai/api/v1/models",
    thinkingFormat: "openai",
  },
  models: [
    { id: "z-ai/glm-5.2", name: "GLM 5.2 (via ZenMux)" },
  ],
  serviceKinds: ["llm"],
};
