// Vozes Edge TTS (Microsoft) — mesma lista que aparece no
// /dashboard/media-providers/tts (open-sse/config/ttsModels.js).
// Duplicação intencional: frontend evita round-trip pra listar vozes.
// Se atualizar aqui, atualiza lá também.

export const EDGE_TTS_VOICES = [
  // Português BR
  { id: "pt-BR-FranciscaNeural", label: "Francisca", desc: "feminina, madura, calma", locale: "pt-BR", gender: "F", tag: "recomendado" },
  { id: "pt-BR-AntonioNeural",   label: "Antonio",   desc: "masculino, maduro",       locale: "pt-BR", gender: "M" },
  { id: "pt-BR-BrendaNeural",    label: "Brenda",    desc: "feminina, jovem",         locale: "pt-BR", gender: "F" },
  { id: "pt-BR-DonatoNeural",    label: "Donato",    desc: "masculino",               locale: "pt-BR", gender: "M" },
  { id: "pt-BR-ElzaNeural",      label: "Elza",      desc: "feminina",                locale: "pt-BR", gender: "F" },
  { id: "pt-BR-FabioNeural",     label: "Fabio",     desc: "masculino",               locale: "pt-BR", gender: "M" },
  { id: "pt-BR-GiovannaNeural",  label: "Giovanna",  desc: "feminina, expressiva",    locale: "pt-BR", gender: "F" },
  { id: "pt-BR-HumbertoNeural",  label: "Humberto",  desc: "masculino, grave",        locale: "pt-BR", gender: "M" },
  { id: "pt-BR-JulioNeural",     label: "Julio",     desc: "masculino",               locale: "pt-BR", gender: "M" },
  { id: "pt-BR-LeilaNeural",     label: "Leila",     desc: "feminina, natural",       locale: "pt-BR", gender: "F" },
  { id: "pt-BR-LeticiaNeural",   label: "Leticia",   desc: "feminina",                locale: "pt-BR", gender: "F" },
  { id: "pt-BR-ManuelaNeural",   label: "Manuela",   desc: "feminina",                locale: "pt-BR", gender: "F" },
  { id: "pt-BR-NicolauNeural",   label: "Nicolau",   desc: "masculino",               locale: "pt-BR", gender: "M" },
  { id: "pt-BR-ThalitaNeural",   label: "Thalita",   desc: "feminina",                locale: "pt-BR", gender: "F" },
  { id: "pt-BR-ValerioNeural",   label: "Valerio",   desc: "masculino",               locale: "pt-BR", gender: "M" },
  { id: "pt-BR-YaraNeural",      label: "Yara",      desc: "feminina, jovem",         locale: "pt-BR", gender: "F" },

  // Português PT
  { id: "pt-PT-DuarteNeural",    label: "Duarte",    desc: "Portugal, masculino",     locale: "pt-PT", gender: "M" },
  { id: "pt-PT-RaquelNeural",    label: "Raquel",    desc: "Portugal, feminina",      locale: "pt-PT", gender: "F" },

  // Inglês
  { id: "en-US-AriaNeural",      label: "Aria",      desc: "US, feminina",            locale: "en-US", gender: "F" },
  { id: "en-US-GuyNeural",       label: "Guy",       desc: "US, masculino",           locale: "en-US", gender: "M" },
  { id: "en-US-JennyNeural",     label: "Jenny",     desc: "US, feminina",            locale: "en-US", gender: "F" },
  { id: "en-US-RogerNeural",     label: "Roger",     desc: "US, masculino",           locale: "en-US", gender: "M" },
  { id: "en-GB-SoniaNeural",     label: "Sonia",     desc: "UK, feminina",            locale: "en-GB", gender: "F" },
  { id: "en-GB-RyanNeural",      label: "Ryan",      desc: "UK, masculino",           locale: "en-GB", gender: "M" },

  // Espanhol
  { id: "es-ES-ElviraNeural",    label: "Elvira",    desc: "Espanha, feminina",       locale: "es-ES", gender: "F" },
  { id: "es-MX-JorgeNeural",     label: "Jorge",     desc: "México, masculino",       locale: "es-MX", gender: "M" },

  // Outros idiomas
  { id: "fr-FR-DeniseNeural",    label: "Denise",    desc: "francês",                 locale: "fr-FR", gender: "F" },
  { id: "de-DE-KatjaNeural",     label: "Katja",     desc: "alemão",                  locale: "de-DE", gender: "F" },
  { id: "it-IT-ElsaNeural",      label: "Elsa",      desc: "italiano",                locale: "it-IT", gender: "F" },
  { id: "ja-JP-NanamiNeural",    label: "Nanami",    desc: "japonês",                 locale: "ja-JP", gender: "F" },
  { id: "ko-KR-SunHiNeural",     label: "SunHi",     desc: "coreano",                 locale: "ko-KR", gender: "F" },
  { id: "zh-CN-XiaoxiaoNeural",  label: "Xiaoxiao",  desc: "chinês mandarim",         locale: "zh-CN", gender: "F" },
];

export const DEFAULT_VOICE = "pt-BR-FranciscaNeural";
export const VOICE_STORAGE_KEY = "maxrouter_tts_voice";

// Helper — leitura segura (SSR safe)
export function getSelectedVoice() {
  if (typeof window === "undefined") return DEFAULT_VOICE;
  try {
    return window.localStorage.getItem(VOICE_STORAGE_KEY) || DEFAULT_VOICE;
  } catch { return DEFAULT_VOICE; }
}

export function setSelectedVoice(voiceId) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(VOICE_STORAGE_KEY, voiceId); } catch {}
}
