const https = require("https");
const { SUPERBRAIN_B64, GITHUB_TOKEN } = require("./config");

const GITHUB_RAW = "https://raw.githubusercontent.com/nortelucas/meueulucas/main/Superbrain-Lucas.md";
const GITHUB_API = "https://api.github.com/repos/nortelucas/meueulucas/contents/Superbrain-Lucas.md";

let currentBase64 = SUPERBRAIN_B64 || "";
let currentDecoded = currentBase64
  ? Buffer.from(currentBase64, "base64").toString("utf-8")
  : "";

function getContent() {
  return currentDecoded;
}

function fetchWithAuth(url, accept) {
  return new Promise((resolve, reject) => {
    const opts = { headers: { "User-Agent": "9router-agent" } };
    if (accept) opts.headers.Accept = accept;
    if (GITHUB_TOKEN) opts.headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
    https.get(url, opts, (res) => {
      let data = "";
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchWithAuth(res.headers.location, accept).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

async function refreshFromGitHub() {
  try {
    // Tenta raw CDN primeiro, depois API autenticada
    let content;
    try {
      content = await fetchWithAuth(GITHUB_RAW);
    } catch {
      const json = await fetchWithAuth(GITHUB_API, "application/vnd.github.v3.raw");
      content = json;
    }
    currentBase64 = Buffer.from(content, "utf-8").toString("base64");
    currentDecoded = content;
    const firstLine = content.split("\n")[0].replace("# ", "").trim();
    console.log(`[Superbrain] Sincronizado: "${firstLine}" (${content.length} chars)`);
    return true;
  } catch (err) {
    console.error("[Superbrain] Erro no sync:", err.message);
    return false;
  }
}

function refreshFromEnv() {
  if (SUPERBRAIN_B64) {
    currentBase64 = SUPERBRAIN_B64;
    currentDecoded = Buffer.from(SUPERBRAIN_B64, "base64").toString("utf-8");
    return true;
  }
  return false;
}

async function appendMemory(text) {
  if (!GITHUB_TOKEN) return { ok: false, error: "GITHUB_TOKEN não configurado" };

  try {
    // 1. Pega conteúdo atual + SHA
    const meta = await new Promise((resolve, reject) => {
      const opts = {
        hostname: "api.github.com",
        path: "/repos/nortelucas/meueulucas/contents/Superbrain-Lucas.md",
        method: "GET",
        headers: { "User-Agent": "9router-agent", Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" },
      };
      https.get(opts, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
      }).on("error", reject);
    });

    const sha = meta.sha;
    const existing = Buffer.from(meta.content, "base64").toString("utf-8");
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    const newContent = existing + `\n\n---\n_(Salvo em ${timestamp})_\n${text}`;
    const newBase64 = Buffer.from(newContent, "utf-8").toString("base64");

    // 2. Faz PUT com novo conteúdo
    await new Promise((resolve, reject) => {
      const body = JSON.stringify({ message: `Memória: ${text.slice(0, 60).trim()}`, content: newBase64, sha });
      const opts = {
        hostname: "api.github.com",
        path: "/repos/nortelucas/meueulucas/contents/Superbrain-Lucas.md",
        method: "PUT",
        headers: { "User-Agent": "9router-agent", Authorization: `Bearer ${GITHUB_TOKEN}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      };
      const req = https.request(opts, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode === 200 || res.statusCode === 201) resolve();
          else reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        });
      });
      req.write(body);
      req.end();
    });

    // Atualiza cache local
    currentDecoded = newContent;
    currentBase64 = newBase64;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { getContent, refreshFromGitHub, refreshFromEnv, appendMemory };
