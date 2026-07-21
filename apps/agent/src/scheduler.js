const db = require("./db");
const CHECK_INTERVAL = 30 * 1000;

let tasks = [];
let timer = null;
let onTrigger = null;

// Carregar tarefas do SQLite
tasks = db.prepare("SELECT * FROM tasks WHERE enabled = 1 ORDER BY created_at").all().map((t) => ({
  id: t.id,
  label: t.label,
  meta: JSON.parse(t.meta || "{}"),
  dueAt: parseInt(t.id.split("-")[0]) || Date.now(),
  created: Date.now(),
}));

function persist() {
  const upsert = db.prepare(
    `INSERT INTO tasks (id, label, cron, enabled, meta) VALUES (?, ?, '', 1, ?)
     ON CONFLICT(id) DO UPDATE SET label = excluded.label, meta = excluded.meta`
  );
  const txn = db.transaction((ts) => {
    for (const t of ts) upsert.run(t.id, t.label, JSON.stringify(t.meta || {}));
  });
  try { txn(tasks); } catch {}
}

function add(delaySec, label, meta = {}) {
  const id = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
  const task = { id, dueAt: Date.now() + delaySec * 1000, label, meta, created: Date.now() };
  tasks.push(task);
  db.prepare("INSERT OR REPLACE INTO tasks (id, label, cron, enabled, meta) VALUES (?, ?, '', 1, ?)").run(id, label, JSON.stringify(meta));
  return id;
}

function remove(id) {
  tasks = tasks.filter((t) => t.id !== id);
  db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
}

function list() {
  return tasks.map((t) => ({
    ...t,
    remaining: Math.max(0, Math.round((t.dueAt - Date.now()) / 1000)),
  }));
}

async function tick() {
  const now = Date.now();
  const due = tasks.filter((t) => t.dueAt <= now);
  if (due.length === 0) return;
  tasks = tasks.filter((t) => t.dueAt > now);
  for (const t of due) db.prepare("DELETE FROM tasks WHERE id = ?").run(t.id);
  for (const task of due) {
    try { if (onTrigger) await onTrigger(task); } catch {}
  }
}

function start(callback) {
  onTrigger = callback;
  if (timer) clearInterval(timer);
  timer = setInterval(tick, CHECK_INTERVAL);
  tick();
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

module.exports = { add, remove, list, start, stop, tick };
