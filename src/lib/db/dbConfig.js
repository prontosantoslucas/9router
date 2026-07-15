// Bootstrap DB-connection config — read BEFORE the database opens, so it can
// NOT live in the database itself. Two sources, in priority order:
//   1. Environment variables (best for cloud/Railway): TURSO_DATABASE_URL +
//      TURSO_AUTH_TOKEN (or LIBSQL_URL / LIBSQL_AUTH_TOKEN).
//   2. A small JSON file at DATA_DIR/db-config.json, written by the dashboard
//      (Settings > External Database). Lets non-env users point at Turso from
//      the UI. Applied on the NEXT restart.
// When neither provides a URL, MaxRouter uses the local SQLite file (the
// default, best out-of-the-box config after install).
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/lib/dataDir.js";

export const DB_CONFIG_FILE = path.join(DATA_DIR, "db-config.json");

function readFileConfig() {
  try {
    const raw = fs.readFileSync(DB_CONFIG_FILE, "utf8");
    const j = JSON.parse(raw);
    return {
      url: (j.tursoUrl || j.url || "").trim(),
      token: (j.tursoToken || j.token || "").trim(),
      syncIntervalMs: Number(j.syncIntervalMs) || 0,
    };
  } catch {
    return { url: "", token: "", syncIntervalMs: 0 };
  }
}

// Returns the resolved external-DB config. `source` is "env", "file", or "none".
export function getDbConfig() {
  const envUrl = (process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || "").trim();
  const envToken = (process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN || "").trim();
  const envInterval = Number(process.env.TURSO_SYNC_INTERVAL_MS) || 0;
  if (envUrl) {
    return { url: envUrl, token: envToken, syncIntervalMs: envInterval, source: "env" };
  }
  const f = readFileConfig();
  if (f.url) {
    return { ...f, source: "file" };
  }
  return { url: "", token: "", syncIntervalMs: 0, source: "none" };
}

// True when an external (Turso/libSQL) DB is configured. A remote URL requires
// a token; a local file:// URL does not.
export function externalDbConfigured() {
  const { url, token } = getDbConfig();
  if (!url) return false;
  const isRemote = /^libsql:\/\/|^https:\/\/|^wss:\/\//i.test(url);
  return !isRemote || Boolean(token);
}

// Persist UI-provided config to DATA_DIR/db-config.json. Empty url clears it
// (reverts to local SQLite on next restart). Never throws to callers that wrap.
export function writeFileConfig({ url = "", token = "", syncIntervalMs = 0 } = {}) {
  const clean = { tursoUrl: String(url || "").trim(), tursoToken: String(token || "").trim(), syncIntervalMs: Number(syncIntervalMs) || 0 };
  if (!clean.tursoUrl) {
    try { fs.rmSync(DB_CONFIG_FILE, { force: true }); } catch { /* ignore */ }
    return { cleared: true };
  }
  fs.mkdirSync(path.dirname(DB_CONFIG_FILE), { recursive: true });
  fs.writeFileSync(DB_CONFIG_FILE, JSON.stringify(clean, null, 2));
  return { cleared: false };
}
