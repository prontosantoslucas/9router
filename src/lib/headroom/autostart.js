// Headroom-by-default: install (pip) and start the local Headroom proxy at
// boot so every installation gets the token saver without manual setup.
// Everything here is fail-open — any error is logged and the app boots
// normally; the chat path already degrades gracefully when the proxy is
// unreachable (open-sse/rtk/headroom.js, 3s timeout).
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { DATA_DIR } from "@/lib/dataDir.js";
import {
  findHeadroomBinary,
  findPython310,
  isLoopbackHeadroomUrl,
  DEFAULT_HEADROOM_URL,
} from "./detect.js";
import { startHeadroomProxy, getManagedPid } from "./process.js";

const HEADROOM_DIR = path.join(DATA_DIR, "headroom");
const INSTALL_LOG_FILE = path.join(HEADROOM_DIR, "install.log");

function parsePortFromUrl(url) {
  try {
    const p = parseInt(new URL(url).port, 10);
    if (p > 0 && p < 65536) return p;
  } catch { /* fall through */ }
  return null;
}

// Base install: pip install headroom-ai[proxy]. Extras (code/ml) stay
// opt-in via the Token Saver UI (installHeadroomExtras).
function installHeadroomBase(py) {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(HEADROOM_DIR)) fs.mkdirSync(HEADROOM_DIR, { recursive: true });
      const outFd = fs.openSync(INSTALL_LOG_FILE, "w");
      const child = spawn(py, ["-m", "pip", "install", "--upgrade", "headroom-ai[proxy,code]"], {
        stdio: ["ignore", outFd, outFd],
        windowsHide: true,
        env: { ...process.env },
      });
      child.once("error", (e) => { try { fs.closeSync(outFd); } catch {} reject(e); });
      child.once("exit", (code) => {
        try { fs.closeSync(outFd); } catch {}
        if (code === 0) resolve(true);
        else reject(new Error(`pip install headroom-ai[proxy,code] exited with code=${code}`));
      });
    } catch (e) {
      reject(e);
    }
  });
}

let autostartPromise = null;

// Called once from initDb(). Never throws; never blocks boot (callers use
// `void ensureHeadroomAtBoot(...)`).
export function ensureHeadroomAtBoot(settings = {}) {
  if (autostartPromise) return autostartPromise;
  autostartPromise = (async () => {
    try {
      if (settings.headroomEnabled === false) return { skipped: "disabled" };
      const url = settings.headroomUrl || DEFAULT_HEADROOM_URL;
      // External proxies are managed outside 9Router.
      if (!isLoopbackHeadroomUrl(url)) return { skipped: "external" };

      let binary = findHeadroomBinary();
      if (!binary) {
        const py = findPython310();
        if (!py) {
          console.log("[headroom] autostart skipped: Python >= 3.10 not found");
          return { skipped: "no_python" };
        }
        console.log("[headroom] installing headroom-ai[proxy] (first boot)…");
        await installHeadroomBase(py);
        binary = findHeadroomBinary();
        if (!binary) return { skipped: "install_failed" };
      }

      if (getManagedPid()) return { started: false, alreadyRunning: true };
      const port = parsePortFromUrl(url) || 8787;
      await startHeadroomProxy({
        port,
        codeAware: settings.headroomCodeAware === true,
        kompress: settings.headroomKompress !== false,
      });
      console.log(`[headroom] proxy started on :${port}`);
      return { started: true, port };
    } catch (error) {
      // Fail-open: log and keep booting.
      console.log("[headroom] autostart failed (non-fatal):", error?.message || error);
      return { error: error?.message || String(error) };
    }
  })();
  return autostartPromise;
}
