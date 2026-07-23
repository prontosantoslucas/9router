/**
 * Text-to-Speech real via gateway do maxrouter (endpoint OpenAI-compatível /audio/speech).
 * Depende de um provider de TTS configurado no gateway. Falha graciosamente (null).
 */
const { ROUTER_BASE_URL } = require("../config");
const keyrotator = require("../keyrotator");

const TTS_MODEL = process.env.TTS_MODEL || "tts-1";
const TTS_VOICE = process.env.TTS_VOICE || "alloy";

async function synthesizeSpeech(text, { voice, format = "mp3" } = {}) {
  if (!text || !text.trim()) return null;
  const base = (ROUTER_BASE_URL || "").replace(/\/+$/, "");
  if (!base) return null;
  try {
    const res = await fetch(`${base}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${keyrotator.getKey() || ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        input: text.slice(0, 4000),
        voice: voice || TTS_VOICE,
        response_format: format,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.warn(`[TTS] gateway ${res.status}: ${err.slice(0, 150)}`);
      return null;
    }
    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const mimeType = format === "mp3" ? "audio/mpeg" : `audio/${format}`;
    return { audioBuffer: buffer, mimeType, base64: buffer.toString("base64") };
  } catch (err) {
    console.error("[TTS] Erro ao sintetizar:", err.message);
    return null;
  }
}

module.exports = { synthesizeSpeech };
