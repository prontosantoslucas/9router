const { ROUTER_BASE_URL } = require("./config");
const keyrotator = require("./keyrotator");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MODELS = [
  { id: "cf/@cf/stabilityai/stable-diffusion-xl-base-1.0", name: "Stable Diffusion XL", provider: "Cloudflare" },
  { id: "cf/@cf/black-forest-labs/flux-1-schnell", name: "FLUX.1 Schnell", provider: "Cloudflare" },
];

const IMAGES_DIR = path.join(__dirname, "..", "temp", "images");

function ensureDir() {
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

const imageStore = new Map(); // id -> { filename, mime }

async function generate(prompt, modelId) {
  const model = modelId || MODELS[0].id;
  const url = `${ROUTER_BASE_URL.replace(/\/v1$/, "")}/v1/images/generations`;

  const body = { model, prompt, n: 1 };

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${keyrotator.getKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const imageData = data.data?.[0];
  if (!imageData) throw new Error("Sem dados de imagem na resposta");

  const b64 = imageData.b64_json || null;
  const directUrl = imageData.url || null;

  // Se tem base64, salva em disco e retorna URL interna
  let internalUrl = directUrl;
  if (b64) {
    const id = crypto.randomBytes(8).toString("hex");
    const mime = "image/png";
    const ext = "png";
    const filename = `${id}.${ext}`;
    ensureDir();
    const filePath = path.join(IMAGES_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(b64, "base64"));
    imageStore.set(id, { filename, mime });
    internalUrl = `/api/image/${id}`;
  }

  return {
    b64_json: null,
    url: internalUrl,
    revised_prompt: imageData.revised_prompt || prompt,
    model: data.model || model,
  };
}

function serveImage(id, req, res) {
  const meta = imageStore.get(id);
  if (!meta) return res.status(404).json({ error: "imagem não encontrada" });
  const filePath = path.join(IMAGES_DIR, meta.filename);
  if (!fs.existsSync(filePath)) {
    imageStore.delete(id);
    return res.status(404).json({ error: "imagem expirou" });
  }
  res.setHeader("Content-Type", meta.mime);
  res.setHeader("Cache-Control", "public, max-age=86400");
  fs.createReadStream(filePath).pipe(res);
}

// Limpa imagens com mais de 1h a cada 10min
setInterval(() => {
  const now = Date.now();
  for (const [id] of imageStore) {
    const filePath = path.join(IMAGES_DIR, id + ".png");
    try {
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > 3600000) {
        fs.unlinkSync(filePath);
        imageStore.delete(id);
      }
    } catch {}
  }
}, 600000);

function listModels() {
  return MODELS.map((m) => ({ id: m.id, name: m.name, provider: m.provider }));
}

module.exports = { generate, listModels, serveImage };
