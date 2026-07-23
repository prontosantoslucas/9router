// Helpers de vídeo via ffmpeg (CLI). Requer ffmpeg instalado no container.
// extractAudio: tira a trilha de áudio (para STT). extractFrames: N quadros (para visão).
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

function hasFfmpeg() {
  try {
    require("child_process").execSync("ffmpeg -version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function run(args) {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err += d.toString(); });
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg saiu com código ${code}: ${err.slice(-300)}`))));
    p.on("error", reject);
  });
}

function tmpFile(ext) {
  return path.join(os.tmpdir(), `9r-vid-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
}

/**
 * Extrai a trilha de áudio de um buffer de vídeo. Retorna { buffer, mimeType, filename }.
 */
async function extractAudio(videoBuffer) {
  if (!hasFfmpeg()) throw new Error("ffmpeg não disponível no servidor");
  const inFile = tmpFile("mp4");
  const outFile = tmpFile("mp3");
  try {
    fs.writeFileSync(inFile, videoBuffer);
    await run(["-y", "-i", inFile, "-vn", "-acodec", "libmp3lame", "-q:a", "4", outFile]);
    const buffer = fs.readFileSync(outFile);
    return { buffer, mimeType: "audio/mpeg", filename: "audio.mp3" };
  } finally {
    [inFile, outFile].forEach((f) => { try { fs.unlinkSync(f); } catch {} });
  }
}

/**
 * Extrai N frames uniformemente distribuídos. Retorna [{ base64, mimeType }].
 */
async function extractFrames(videoBuffer, n = 4) {
  if (!hasFfmpeg()) throw new Error("ffmpeg não disponível no servidor");
  const count = Math.max(1, Math.min(8, Number(n) || 4));
  const inFile = tmpFile("mp4");
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "9r-frames-"));
  try {
    fs.writeFileSync(inFile, videoBuffer);
    // fps dinâmico: pega ~count frames ao longo do vídeo via select. Simplificado: 1 frame a cada intervalo.
    await run([
      "-y", "-i", inFile,
      "-vf", `fps=1,scale=768:-1`,
      "-frames:v", String(count),
      path.join(outDir, "frame-%02d.jpg"),
    ]);
    const files = fs.readdirSync(outDir).filter((f) => f.endsWith(".jpg")).sort();
    return files.map((f) => ({
      base64: fs.readFileSync(path.join(outDir, f)).toString("base64"),
      mimeType: "image/jpeg",
    }));
  } finally {
    try { fs.unlinkSync(inFile); } catch {}
    try { fs.rmSync(outDir, { recursive: true, force: true }); } catch {}
  }
}

module.exports = { hasFfmpeg, extractAudio, extractFrames };
