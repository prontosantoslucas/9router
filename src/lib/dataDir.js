import fs from "node:fs";
import path from "path";
import os from "os";

const APP_NAME = "maxrouter";

function defaultDir() {
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), APP_NAME);
  }
  return path.join(os.homedir(), `.${APP_NAME}`);
}

export function getDataDir() {
  // Railway injeta RAILWAY_VOLUME_MOUNT_PATH quando um Volume esta anexado ao
  // servico. Ele tem prioridade sobre DATA_DIR porque a imagem ja traz
  // `ENV DATA_DIR=/app/data` embutido, e /app/data mora na camada efemera do
  // container: sem isso, todo redeploy (todo push) recria o container e apaga
  // o SQLite junto com as conexoes, providers e chaves. Se o volume estiver
  // montado justamente em /app/data, o valor e o mesmo e nada muda.
  const railwayVolume = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  if (railwayVolume) {
    try {
      fs.mkdirSync(railwayVolume, { recursive: true });
      return railwayVolume;
    } catch (e) {
      console.warn(`[DATA_DIR] volume Railway '${railwayVolume}' indisponivel (${e?.code}) → segue para DATA_DIR`);
    }
  }

  const configured = process.env.DATA_DIR;
  if (!configured) return defaultDir();

  // On Windows, ignore Unix-style absolute paths (e.g. /var/lib/...) that come
  // from a Linux-targeted .env or Docker config — they are not valid here.
  if (process.platform === "win32" && /^\//.test(configured)) {
    console.warn(`[DATA_DIR] '${configured}' is a Unix path on Windows → fallback to default`);
    return defaultDir();
  }

  try {
    fs.mkdirSync(configured, { recursive: true });
    return configured;
  } catch (e) {
    if (e?.code === "EACCES" || e?.code === "EPERM") {
      console.warn(`[DATA_DIR] '${configured}' not writable → fallback ~/.${APP_NAME}`);
      return defaultDir();
    }
    throw e;
  }
}

export const DATA_DIR = getDataDir();
