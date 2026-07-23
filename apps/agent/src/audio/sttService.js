/**
 * Speech-to-Text real via Groq Whisper (whisper-large-v3-turbo).
 * Usa GROQ_API_KEY (já presente no ambiente). Fallback: string vazia se não configurado.
 */
const GROQ_STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = process.env.STT_MODEL || "whisper-large-v3-turbo";

async function transcribeAudio(audioBuffer, mimeType = "audio/webm", filename = "audio.webm") {
  if (!audioBuffer || audioBuffer.length === 0) return "";
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn("[STT] GROQ_API_KEY não configurado — transcrição indisponível");
    return "";
  }

  try {
    const form = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    form.append("file", blob, filename);
    form.append("model", MODEL);
    form.append("response_format", "json");
    form.append("temperature", "0");
    // Whisper detecta o idioma automaticamente; forçamos pt para melhor precisão.
    form.append("language", process.env.STT_LANGUAGE || "pt");

    const res = await fetch(GROQ_STT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[STT] Groq ${res.status}: ${errText.slice(0, 200)}`);
      throw new Error(`STT falhou (HTTP ${res.status})`);
    }

    const data = await res.json();
    return (data.text || "").trim();
  } catch (err) {
    console.error("[STT] Erro ao transcrever:", err.message);
    throw err;
  }
}

module.exports = { transcribeAudio };
