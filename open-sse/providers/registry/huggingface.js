export default {
  id: "huggingface",
  priority: 70,
  hasFree: true,
  hasOAuth: true,
  alias: "huggingface",
  // OAuth PKCE (authorization code): requires an OAuth app created at
  // https://huggingface.co/settings/applications — clientId/secret come from
  // env (HF_OAUTH_CLIENT_ID / HF_OAUTH_CLIENT_SECRET), injected in constants/oauth.js.
  oauth: {
    authorizeUrl: "https://huggingface.co/oauth/authorize",
    tokenUrl: "https://huggingface.co/oauth/token",
    userInfoUrl: "https://huggingface.co/oauth/userinfo",
    scopes: ["openid", "profile", "email", "inference-api"],
    codeChallengeMethod: "S256",
  },
  aliases: [
    "hf",
  ],
  uiAlias: "hf",
  display: {
    name: "HuggingFace",
    icon: "face",
    color: "#FFD21E",
    textIcon: "HF",
    website: "https://huggingface.co",
    notice: {
      apiKeyUrl: "https://huggingface.co/settings/tokens",
    },
  },
  category: "apikey",
  authType: "apikey",
  hiddenKinds: [
    "tts",
  ],
  transport: null,
  models: [
    { id: "black-forest-labs/FLUX.1-schnell", name: "FLUX.1 Schnell", params: [], kind: "image" },
    { id: "stabilityai/stable-diffusion-xl-base-1.0", name: "SDXL Base 1.0", params: [], kind: "image" },
    { id: "openai/whisper-large-v3", name: "Whisper Large v3 (HF)", params: ["language"], kind: "stt" },
    { id: "openai/whisper-small", name: "Whisper Small (HF)", params: ["language"], kind: "stt" },
  ],
  serviceKinds: ["image", "stt"],
  imageConfig: { baseUrl: "https://api-inference.huggingface.co/models" },
};
