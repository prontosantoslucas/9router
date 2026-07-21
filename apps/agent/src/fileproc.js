const fs = require("fs");
const path = require("path");
const { ROUTER_BASE_URL } = require("./config");
const keyrotator = require("./keyrotator");

const TEMP_DIR = path.join(__dirname, "..", "data", "uploads");
const MAX_TEXT_LEN = 10000;

try { fs.mkdirSync(TEMP_DIR, { recursive: true }); } catch {}

function tempPath(ext) {
  return path.join(TEMP_DIR, `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
}

function cleanup(filePath) {
  try { fs.unlinkSync(filePath); } catch {}
}

async function processFile(base64, mimeType, originalName) {
  const ext = path.extname(originalName).toLowerCase().replace(".", "") || "bin";
  const filePath = tempPath(ext);
  try {
    fs.writeFileSync(filePath, Buffer.from(base64, "base64"));

    if (mimeType && mimeType.startsWith("image/")) {
      return await processImage(filePath, mimeType, originalName);
    }
    if (ext === "pdf") return await processPdf(filePath);
    if (ext === "docx") return await processDocx(filePath);
    if (ext === "xlsx" || ext === "xls") return await processXlsx(filePath);
    if (mimeType?.startsWith("text/") || ["txt","md","csv","json","js","ts","py","html","css","xml","yaml","yml","log","ini","cfg","env","sh","bat","ps1"].includes(ext)) {
      return fs.readFileSync(filePath, "utf-8").slice(0, MAX_TEXT_LEN);
    }

    return `*Tipo não suportado:* \`${ext}\`\n\nFormatos aceitos: PDF, DOCX, XLSX, imagens, txt, md, csv, json, código.`;
  } finally {
    cleanup(filePath);
  }
}

// ── PDF ──
async function processPdf(filePath) {
  try {
    const pdfParse = require("pdf-parse");
    const buf = fs.readFileSync(filePath);
    const data = await pdfParse(buf);
    return data.text.slice(0, MAX_TEXT_LEN) || "(PDF vazio)";
  } catch (err) {
    return `Erro ao ler PDF: ${err.message}`;
  }
}

// ── DOCX ──
async function processDocx(filePath) {
  try {
    const mammoth = require("mammoth");
    const buf = fs.readFileSync(filePath);
    const r = await mammoth.extractRawText({ buffer: buf });
    return r.value.slice(0, MAX_TEXT_LEN) || "(DOCX vazio)";
  } catch (err) {
    return `Erro ao ler DOCX: ${err.message}`;
  }
}

// ── XLSX ──
async function processXlsx(filePath) {
  try {
    const XLSX = require("xlsx");
    const wb = XLSX.readFile(filePath);
    const lines = [];
    for (const name of wb.SheetNames) {
      const sheet = wb.Sheets[name];
      const html = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      lines.push(`--- ${name} ---\n${html}`);
    }
    return lines.join("\n\n").slice(0, MAX_TEXT_LEN) || "(XLSX vazio)";
  } catch (err) {
    return `Erro ao ler XLSX: ${err.message}`;
  }
}

// ── Imagens — usando modelo com visão via 9router ──
async function processImage(filePath, mimeType, originalName) {
  try {
    const base64 = fs.readFileSync(filePath, "base64");
    const dataUri = `data:${mimeType || "image/png"};base64,${base64}`;

    const url = `${ROUTER_BASE_URL.replace(/\/+$/, "")}/chat/completions`;
    const body = {
      model: "nvidia/deepseek-ai/deepseek-v4-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `Descreva detalhadamente esta imagem (${originalName})` },
            { type: "image_url", image_url: { url: dataUri } },
          ],
        },
      ],
      stream: false,
      max_tokens: 1000,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${keyrotator.getKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return `*Imagem:* ${originalName}\n\n(Não foi possível processar: HTTP ${res.status})`;
    }

    const data = await res.json();
    const desc = data.choices?.[0]?.message?.content || "(sem descrição)";
    return `*Imagem:* ${originalName}\n\n${desc}`;
  } catch (err) {
    return `*Imagem:* ${originalName}\n\n(Erro ao processar: ${err.message})`;
  }
}

module.exports = { processFile };
