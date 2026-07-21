const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { SIDECAR_PORT, SIDECAR_HOST } = require("./config");

let proc = null;
let ready = false;
let url = null;

const HEALTH_URL = `http://${SIDECAR_HOST}:${SIDECAR_PORT}/health`;

function getUrl() { return url; }
function isReady() { return ready; }

async function waitForHealth(timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(3000) });
      if (res.ok) { ready = true; url = `http://${SIDECAR_HOST}:${SIDECAR_PORT}/v1`; console.log(`[Sidecar] 9Router pronto em ${url}`); return true; }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error(`[Sidecar] Timeout (${timeoutMs}ms)`);
  return false;
}

async function start() {
  const forkCli = path.join(process.cwd(), "9router", "cli", "cli.js");
  const forkApp = path.join(process.cwd(), "9router", "cli", "app", "server.js");
  const forkBuilt = fs.existsSync(forkApp);

  let binPath, args, useFork = false;

  if (fs.existsSync(forkCli) && forkBuilt) {
    // Fork local com build pronto
    binPath = process.execPath;
    args = [forkCli, "--port", String(SIDECAR_PORT), "--host", SIDECAR_HOST, "--no-browser", "--log"];
    useFork = true;
    console.log(`[Sidecar] Usando fork local: ${forkCli}`);
  } else if (fs.existsSync(forkCli) && !forkBuilt) {
    console.log(`[Sidecar] Fork local encontrado mas sem build. Execute: cd 9router && npm install && npm run build`);
    console.log(`[Sidecar] Usando fallback npx...`);
    binPath = "npx";
    args = ["--yes", "9router", "--port", String(SIDECAR_PORT), "--host", SIDECAR_HOST, "--no-browser", "--log"];
  } else {
    console.log(`[Sidecar] Fork local não encontrado. Usando npx...`);
    binPath = "npx";
    args = ["--yes", "9router", "--port", String(SIDECAR_PORT), "--host", SIDECAR_HOST, "--no-browser", "--log"];
  }

  console.log(`[Sidecar] Iniciando 9Router (porta ${SIDECAR_PORT})...`);

  try {
    const env = { ...process.env };
    if (useFork) {
      env.DATA_DIR = path.join(process.cwd(), "data", "sidecar");
    }

    proc = spawn(binPath, args, { stdio: ["ignore", "pipe", "pipe"], env, detached: false });

    proc.stdout.on("data", (d) => { const l = d.toString().trim(); if (l) console.log(`[9Router] ${l}`); });
    proc.stderr.on("data", (d) => { const l = d.toString().trim(); if (l && !l.includes("ExperimentalWarning")) console.log(`[9Router] ${l}`); });
    proc.on("exit", (code, signal) => { console.log(`[Sidecar] 9Router encerrado (${code}, ${signal})`); ready = false; proc = null; });
    proc.on("error", (err) => { console.error(`[Sidecar] Erro: ${err.message}`); ready = false; proc = null; });

    const ok = await waitForHealth();
    if (!ok && proc) { proc.kill(); proc = null; }
    return ok;
  } catch (err) {
    console.error(`[Sidecar] Falha: ${err.message}`);
    return false;
  }
}

function stop() {
  if (proc) { proc.kill("SIGTERM"); setTimeout(() => { if (proc) proc.kill("SIGKILL"); }, 5000); proc = null; }
  ready = false;
}

module.exports = { start, stop, getUrl, isReady };
