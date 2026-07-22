const path = require("path");
const fs = require("fs");

const dataDir = process.env.DATA_DIR || path.join(require("os").homedir(), ".9router");
const DB_PATH = path.join(dataDir, "agent", "app.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let db;
try {
  const Database = require("better-sqlite3");
  db = new Database(DB_PATH);
} catch (err) {
  console.warn("[DB Agent] better-sqlite3 indisponível, utilizando driver nativo node:sqlite...");
  const { DatabaseSync } = require("node:sqlite");
  const sqliteDb = new DatabaseSync(DB_PATH);

  // Wrapper para simular API do better-sqlite3 (prepare, run, get, all, exec)
  db = {
    exec: (sql) => sqliteDb.exec(sql),
    pragma: (sql) => { try { sqliteDb.exec(`PRAGMA ${sql}`); } catch {} },
    prepare: (sql) => {
      const stmt = sqliteDb.prepare(sql);
      return {
        run: (...args) => stmt.run(...args),
        get: (...args) => stmt.get(...args),
        all: (...args) => stmt.all(...args),
      };
    },
    transaction: (fn) => (...args) => fn(...args),
  };
}

// WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Schema ──
db.exec(`
  CREATE TABLE IF NOT EXISTS histories (
    chat_id TEXT PRIMARY KEY,
    messages TEXT NOT NULL DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS corrections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    cron TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    meta TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS farejador_queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    interval_min INTEGER NOT NULL DEFAULT 60,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_run TEXT,
    seen_urls TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_farejador_chat ON farejador_queries(chat_id);
  CREATE INDEX IF NOT EXISTS idx_farejador_enabled ON farejador_queries(enabled);

  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    source TEXT DEFAULT 'agent',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_memories_text ON memories(text);

  CREATE TABLE IF NOT EXISTS copilot_drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    sender_name TEXT DEFAULT '',
    original_message TEXT NOT NULL,
    draft_response TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_copilot_status ON copilot_drafts(status);

  CREATE TABLE IF NOT EXISTS google_tokens (
    -- Um registro por identidade Google conectada (single-user por instância; scale-out fica em user_id futuro)
    user_id TEXT PRIMARY KEY DEFAULT 'default',
    access_token TEXT,
    refresh_token TEXT,
    scope TEXT,
    token_type TEXT,
    expiry_date INTEGER,
    email TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS google_oauth_state (
    -- state gerado no auth-url, consumido uma única vez no callback (proteção CSRF)
    state TEXT PRIMARY KEY,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

module.exports = db;
