const db = require("./db");
const { ROUTER_BASE_URL } = require("./config");
const keyrotator = require("./keyrotator");

const CHECK_INTERVAL = 60_000;
const MAX_RESULTS = 10;

let farejadores = [];
let timer = null;
let onNotify = null;

// Carregar do SQLite
try {
  const rows = db.prepare("SELECT * FROM farejador_queries WHERE enabled = 1").all();
  farejadores = rows.map((r) => ({
    id: String(r.id),
    chatId: r.chat_id,
    query: r.query,
    intervalSec: r.interval_min * 60,
    paused: !r.enabled,
    seen: JSON.parse(r.seen_urls || "[]"),
    lastCheck: r.last_run ? new Date(r.last_run).getTime() : 0,
    created: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  }));
} catch {}

function persist() {
  const upsert = db.prepare(
    `INSERT INTO farejador_queries (id, query, chat_id, interval_min, enabled, seen_urls, last_run)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET seen_urls = excluded.seen_urls, last_run = excluded.last_run`
  );
  const txn = db.transaction((ff) => {
    for (const f of ff) {
      if (f._persistedId) upsert.run(f._persistedId, f.query, f.chatId, Math.round(f.intervalSec / 60), f.paused ? 0 : 1, JSON.stringify(f.seen));
    }
  });
  try { txn(farejadores); } catch (e) { console.error("[Farejador] Erro ao persistir:", e.message); }
}

function add(chatId, query, intervalSec) {
  const info = db.prepare(
    "INSERT INTO farejador_queries (query, chat_id, interval_min) VALUES (?, ?, ?)"
  ).run(query, String(chatId), Math.round(intervalSec / 60));
  const f = {
    id: String(info.lastInsertRowid),
    _persistedId: info.lastInsertRowid,
    chatId: String(chatId),
    query,
    intervalSec: intervalSec || 3600,
    paused: false,
    seen: [],
    created: Date.now(),
    lastCheck: 0,
  };
  farejadores.push(f);
  return f;
}

function remove(id) {
  farejadores = farejadores.filter((f) => f.id !== id);
  db.prepare("DELETE FROM farejador_queries WHERE id = ?").run(parseInt(id));
}

function pause(id) {
  const f = farejadores.find((f) => f.id === id);
  if (f) { f.paused = true; db.prepare("UPDATE farejador_queries SET enabled = 0 WHERE id = ?").run(parseInt(id)); }
  return !!f;
}

function resume(id) {
  const f = farejadores.find((f) => f.id === id);
  if (f) { f.paused = false; db.prepare("UPDATE farejador_queries SET enabled = 1 WHERE id = ?").run(parseInt(id)); }
  return !!f;
}

function list(chatId) {
  return farejadores
    .filter((f) => f.chatId === String(chatId))
    .map((f) => ({ ...f, seen: f.seen.length }));
}

function get(id) {
  return farejadores.find((f) => f.id === id) || null;
}

async function searchWeb(query) {
  const url = `${ROUTER_BASE_URL.replace(/\/v1$/, "")}/v1/search`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${keyrotator.getKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "tavily", query, max_results: MAX_RESULTS }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((r) => ({ title: r.title || "", url: r.url || "", snippet: r.snippet || "" }));
  } catch {
    return [];
  }
}

async function tick() {
  const now = Date.now();
  const due = farejadores.filter((f) => !f.paused && f.lastCheck + f.intervalSec * 1000 <= now);
  if (due.length === 0) return;

  for (const f of due) {
    const results = await searchWeb(f.query);
    if (results.length === 0) continue;

    const seenUrls = new Set(f.seen);
    const novos = results.filter((r) => !seenUrls.has(r.url));

    if (novos.length > 0) {
      const urlsNovas = novos.map((r) => r.url);
      f.seen.push(...urlsNovas);
      if (f.seen.length > 200) f.seen = f.seen.slice(-100);

      const msg = `\u{1F43E} *Farejador:* ${f.query}\n\n${novos.slice(0, 5).map((r) =>
        `\u{2022} [${r.title}](${r.url})\n  _${r.snippet || ""}_`
      ).join("\n\n")}\n\n_${novos.length} novo(s) resultado(s)_`;

      if (onNotify) {
        try { await onNotify(f.chatId, msg); } catch {}
      }
    }

    f.lastCheck = now;
    if (f._persistedId) {
      db.prepare("UPDATE farejador_queries SET seen_urls = ?, last_run = datetime('now') WHERE id = ?")
        .run(JSON.stringify(f.seen), f._persistedId);
    }
  }
}

function start(notifyCallback) {
  onNotify = notifyCallback;
  if (timer) clearInterval(timer);
  timer = setInterval(tick, CHECK_INTERVAL);
  tick();
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

module.exports = { add, remove, pause, resume, list, get, start, stop, tick };
