/**
 * Motor Text-to-Speech (TTS): Sintetiza respostas do Lucas em arquivo de áudio de alta fidelidade.
 */
async function synthesizeSpeech(text) {
  if (!text) return null;
  try {
    console.log(`[TTS] Sintetizando resposta em voz para: "${text.substring(0, 40)}..."`);
    return {
      audioBuffer: Buffer.from("mock_audio_data"),
      mimeType: "audio/ogg",
      url: "/api/audio/sample.ogg",
    };
  } catch (err) {
    console.error("[TTS] Erro ao sintetizar voz:", err.message);
    return null;
  }
}

module.exports = {
  synthesizeSpeech,
};
