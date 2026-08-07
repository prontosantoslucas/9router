// Scheduler de tarefas com suporte a recorrência.
//
// Nova semântica do meta:
//   { chatId, action, repeat_seconds? }
//
//   - Sem `repeat_seconds` → one-shot (comportamento original).
//   - Com `repeat_seconds` → depois de disparar, re-agenda o próximo dueAt
//     em (now + repeat_seconds). Tarefa NUNCA é deletada — só quando cancelada.
//
// Ex: "toda segunda 9h" vira repeat_seconds=604800 (7 dias) com dueAt inicial
// na próxima segunda 9h. Simples e sem parser de cron.

const db = require("./db");
const CHECK_INTERVAL = 30 * 1000;

let tasks = [];
let timer = null;
let onTrigger = null;

// Carregar tarefas do SQLite. Preserva `nextDueAt` do meta se existir (tarefas
// recorrentes salvam last_due lá — id não muda).
tasks = db.prepare("SELECT * FROM tasks WHERE enabled = 1 ORDER BY created_at").all().map((t) => {
  const meta = JSON.parse(t.meta || "{}");
  const idBasedDue = parseInt(t.id.split("-")[0], 36);
  return {
    id: t.id,
    label: t.label,
    meta,
    dueAt: meta.nextDueAt || (Number.isFinite(idBasedDue) ? idBasedDue : Date.now()),
    created: Date.now(),
  };
});

function upsert(task) {
  db.prepare(
    `INSERT INTO tasks (id, label, cron, enabled, meta) VALUES (?, ?, '', 1, ?)
     ON CONFLICT(id) DO UPDATE SET label = excluded.label, meta = excluded.meta`
  ).run(task.id, task.label, JSON.stringify({ ...task.meta, nextDueAt: task.dueAt }));
}

function add(delaySec, label, meta = {}) {
  const id = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
  const task = { id, dueAt: Date.now() + delaySec * 1000, label, meta, created: Date.now() };
  tasks.push(task);
  upsert(task);
  return id;
}

// Atalho pra tarefas recorrentes — meta.repeat_seconds = intervalo em segundos.
function addRecurring(firstDelaySec, repeatSec, label, meta = {}) {
  return add(firstDelaySec, label, { ...meta, repeat_seconds: repeatSec });
}

function remove(id) {
  tasks = tasks.filter((t) => t.id !== id);
  db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
}

function list() {
  return tasks.map((t) => ({
    ...t,
    remaining: Math.max(0, Math.round((t.dueAt - Date.now()) / 1000)),
    recurring: !!t.meta?.repeat_seconds,
  }));
}

async function tick() {
  const now = Date.now();
  const due = tasks.filter((t) => t.dueAt <= now);
  if (due.length === 0) return;

  for (const task of due) {
    // Executa
    try { if (onTrigger) await onTrigger(task); }
    catch (e) { console.warn(`[Scheduler] onTrigger error em ${task.id}:`, e.message); }

    const rep = parseInt(task.meta?.repeat_seconds) || 0;
    if (rep > 0) {
      // Recorrente: recalcula próximo dueAt (avança em blocos de rep pra não drift)
      let next = task.dueAt + rep * 1000;
      while (next <= now) next += rep * 1000;
      task.dueAt = next;
      upsert(task);
    } else {
      // One-shot: remove da fila E do DB
      tasks = tasks.filter((t) => t.id !== task.id);
      db.prepare("DELETE FROM tasks WHERE id = ?").run(task.id);
    }
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

module.exports = { add, addRecurring, remove, list, start, stop, tick };
