// Turso / libSQL adapter — managed, persistent SQLite in the cloud.
//
// Uses the `libsql` package, whose API is a synchronous drop-in for
// better-sqlite3, so the entire (synchronous) DB layer works unchanged.
// Runs as an EMBEDDED REPLICA: a local SQLite file that syncs to a remote
// Turso database. Reads/writes hit the local file (microsecond latency);
// db.sync() pushes local writes to the cloud and pulls remote changes.
//
// Durability: even if the container filesystem is wiped (Railway redeploy),
// the next boot restores state from Turso via the initial sync(). This is the
// managed-DB answer for hosts without a persistent volume.
//
// OPT-IN ONLY: activated when TURSO_DATABASE_URL (or LIBSQL_URL) and an auth
// token are set. Otherwise driver.js skips it and uses local SQLite. If the
// `libsql` native binary is unavailable, this fails closed (returns via throw)
// and driver.js falls back to the local SQLite chain — never worse than today.
import { PRAGMA_SQL } from "../schema.js";
import { getDbConfig, externalDbConfigured } from "../dbConfig.js";

const CHECKPOINT_INTERVAL_MS = 60 * 1000;
// How often to push/pull the embedded replica to/from Turso.
const DEFAULT_SYNC_INTERVAL_MS = 15 * 1000;

export function libsqlConfigured() {
  // Env vars OR the dashboard-written DATA_DIR/db-config.json (see dbConfig.js).
  return externalDbConfigured();
}

export async function createLibsqlAdapter(localFilePath) {
  const cfg = getDbConfig();
  const syncUrl = cfg.url;
  const authToken = cfg.token;

  // Dynamic import so a missing/unbuildable native binary degrades gracefully
  // (driver.js catches and falls back to local SQLite).
  const mod = await import("libsql");
  const Database = mod.default || mod;

  // Embedded replica: local file mirrors the remote Turso DB.
  const db = new Database(localFilePath, { syncUrl, authToken });

  // Pull the latest remote state into the local replica before first use so a
  // wiped filesystem is restored from the cloud.
  try { db.sync(); } catch (e) { console.warn(`[DB] libsql initial sync failed (continuing local): ${e.message}`); }

  try { db.exec(PRAGMA_SQL); } catch { /* embedded replica manages some pragmas itself */ }

  const stmtCache = new Map();
  function prepare(sql) {
    let stmt = stmtCache.get(sql);
    if (!stmt) { stmt = db.prepare(sql); stmtCache.set(sql, stmt); }
    return stmt;
  }

  function syncNow() { try { db.sync(); } catch (e) { console.warn(`[DB] libsql sync failed: ${e.message}`); } }

  const checkpointTimer = setInterval(() => { try { db.pragma("wal_checkpoint(TRUNCATE)"); } catch {} }, CHECKPOINT_INTERVAL_MS);
  if (typeof checkpointTimer.unref === "function") checkpointTimer.unref();

  const syncInterval = cfg.syncIntervalMs > 0 ? cfg.syncIntervalMs : DEFAULT_SYNC_INTERVAL_MS;
  const syncTimer = setInterval(syncNow, syncInterval);
  if (typeof syncTimer.unref === "function") syncTimer.unref();

  function gracefulClose() {
    syncNow(); // push final writes to the cloud
    try { stmtCache.clear(); } catch {}
    try { db.close(); } catch {}
  }
  const onShutdown = () => gracefulClose();
  process.once("beforeExit", onShutdown);
  process.once("SIGINT", () => { onShutdown(); process.exit(0); });
  process.once("SIGTERM", () => { onShutdown(); process.exit(0); });

  return {
    driver: "libsql-turso",
    run(sql, params = []) {
      const r = prepare(sql).run(params);
      return { changes: Number(r.changes ?? 0), lastInsertRowid: Number(r.lastInsertRowid ?? 0) };
    },
    get(sql, params = []) { return prepare(sql).get(params); },
    all(sql, params = []) { return prepare(sql).all(params); },
    exec(sql) { return db.exec(sql); },
    transaction(fn) {
      // Push the whole transaction, then sync once (cheaper than per-write sync).
      const r = db.transaction(fn)();
      syncNow();
      return r;
    },
    checkpoint() { try { db.pragma("wal_checkpoint(TRUNCATE)"); } catch {} },
    sync: syncNow,
    close() { clearInterval(checkpointTimer); clearInterval(syncTimer); gracefulClose(); },
    raw: db,
  };
}
