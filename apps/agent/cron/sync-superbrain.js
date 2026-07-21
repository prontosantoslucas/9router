const https = require("https");

const GITHUB_RAW = "https://raw.githubusercontent.com/nortelucas/meueulucas/main/Superbrain-Lucas.md";
const TARGET_URL = process.env.SELF_URL || "https://9router-agent-production.up.railway.app";

async function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, (r2) => {
          r2.on("data", (c) => (data += c));
          r2.on("end", () => resolve(data));
        }).on("error", reject);
        return;
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

async function main() {
  console.log("[Cron] Sync Superbrain...");
  const body = await fetch(GITHUB_RAW);
  const b64 = Buffer.from(body, "utf-8").toString("base64");
  console.log(`[Cron] Baixado: ${body.length} chars`);

  await new Promise((resolve, reject) => {
    const data = JSON.stringify({ superbrain: b64, source: GITHUB_RAW });
    const req = https.request(`${TARGET_URL}/sync-superbrain`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": data.length },
    }, (res) => {
      let r = "";
      res.on("data", (c) => (r += c));
      res.on("end", () => { console.log("[Cron] Resposta:", r); resolve(); });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

main().catch((err) => {
  console.error("[Cron] Erro:", err.message);
  process.exit(1);
});
