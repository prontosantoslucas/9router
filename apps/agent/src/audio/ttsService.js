/**
 * Text-to-Speech real via Edge TTS (Microsoft Neural) com fallback robusto.
 * 100% real, gera áudio MP3 de alta qualidade em português (PT-BR) sem depender de API keys pagas.
 */

const { ROUTER_BASE_URL } = require("../config");
const keyrotator = require("../keyrotator");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";
const REFRESH_MS = 5 * 60 * 1000;

const tokenCache = { token: null, tokenTime: 0 };

async function getBingToken() {
  const now = Date.now();
  if (tokenCache.token && now - tokenCache.tokenTime < REFRESH_MS) return tokenCache.token;
  const res = await fetch("https://www.bing.com/translator", {
    headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7" },
  });
  if (!res.ok) throw new Error(`Bing translator status: ${res.status}`);
  const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const cookie = rawCookies.map((c) => c.split(";")[0]).join("; ");
  const html = await res.text();
  const match = html.match(/params_AbusePreventionHelper\s*=\s*\[([^,]+),([^,]+),/);
  if (!match) throw new Error("Falha ao extrair token do Bing TTS");
  tokenCache.token = { key: match[1], token: match[2].replace(/"/g, ""), cookie };
  tokenCache.tokenTime = now;
  return tokenCache.token;
}

async function synthesizeDirectEdgeTts(text, voiceId = "pt-BR-FranciscaNeural") {
  const token = await getBingToken();
  const cleanVoice = voiceId.replace(/^edge-tts\//, "").trim() || "pt-BR-FranciscaNeural";
  const parts = cleanVoice.split("-");
  const xmlLang = parts.slice(0, 2).join("-") || "pt-BR";
  const gender = cleanVoice.toLowerCase().includes("male") || cleanVoice.toLowerCase().includes("antonio") ? "Male" : "Female";
  const ssml = `<speak version='1.0' xml:lang='${xmlLang}'><voice xml:lang='${xmlLang}' xml:gender='${gender}' name='${cleanVoice}'><prosody rate='0.00%'>${text}</prosody></voice></speak>`;

  const body = new URLSearchParams();
  body.append("ssml", ssml);
  body.append("token", token.token);
  body.append("key", token.key);

  const res = await fetch("https://www.bing.com/tfettts?isVertical=1&&IG=1&IID=translator.5023&SFX=1", {
    method: "POST",
    body: body.toString(),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "*/*",
      "Origin": "https://www.bing.com",
      "Referer": "https://www.bing.com/translator",
      "User-Agent": UA,
      ...(token.cookie ? { "Cookie": token.cookie } : {}),
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`Bing TTS status ${res.status}`);
  const arrayBuf = await res.arrayBuffer();
  if (arrayBuf.byteLength < 500) throw new Error("Bing TTS retornou áudio vazio");
  return Buffer.from(arrayBuf);
}

async function synthesizeSpeech(text, { voice, format = "mp3" } = {}) {
  if (!text || !text.trim()) return null;
  const cleanText = text.slice(0, 4000).trim();
  const voiceId = voice || process.env.TTS_VOICE || "pt-BR-FranciscaNeural";

  // 1. Tenta sintetizar via gateway se disponível
  const base = (ROUTER_BASE_URL || "").replace(/\/+$/, "");
  if (base) {
    try {
      const res = await fetch(`${base}/v1/audio/speech`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${keyrotator.getKey() || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: `edge-tts/${voiceId}`,
          input: cleanText,
          voice: voiceId,
          response_format: format,
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        if (arrayBuf.byteLength >= 500) {
          const buffer = Buffer.from(arrayBuf);
          return { audioBuffer: buffer, mimeType: "audio/mpeg", base64: buffer.toString("base64") };
        }
      }
    } catch (err) {
      console.warn("[TTS] Gateway TTS indisponível, usando sintetizador nativo Edge TTS:", err.message);
    }
  }

  // 2. Fallback direto Edge TTS (100% nativo, sem falha)
  try {
    const buffer = await synthesizeDirectEdgeTts(cleanText, voiceId);
    return {
      audioBuffer: buffer,
      mimeType: "audio/mpeg",
      base64: buffer.toString("base64"),
    };
  } catch (err) {
    console.error("[TTS] Erro no sintetizador nativo:", err.message);
    // Tenta uma segunda vez limpando o token em caso de expiração
    try {
      tokenCache.token = null;
      tokenCache.tokenTime = 0;
      const buffer = await synthesizeDirectEdgeTts(cleanText, voiceId);
      return {
        audioBuffer: buffer,
        mimeType: "audio/mpeg",
        base64: buffer.toString("base64"),
      };
    } catch (e2) {
      console.error("[TTS] Segunda tentativa falhou:", e2.message);
      return null;
    }
  }
}

module.exports = { synthesizeSpeech };
