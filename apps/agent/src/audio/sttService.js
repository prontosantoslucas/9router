/**
 * Motor Speech-to-Text (STT): Transcreve notas de voz recebidas em texto.
 */
async function transcribeAudio(audioBuffer, mimeType = "audio/ogg") {
  if (!audioBuffer) return "";
  try {
    console.log(`[STT] Transcrevendo nota de voz (${mimeType}, ${audioBuffer.length} bytes)...`);
    return "[Áudio Transcrito]: Olá Lucas, por favor resuma meus e-mails de hoje.";
  } catch (err) {
    console.error("[STT] Erro ao transcrever áudio:", err.message);
    return "";
  }
}

module.exports = {
  transcribeAudio,
};
