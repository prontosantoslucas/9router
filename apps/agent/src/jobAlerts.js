// Sistema de alertas de vagas — cria/agenda buscas recorrentes no LinkedIn
// e envia deltas (só vagas novas desde última execução) via canal escolhido.
//
// Ciclo:
//   1. setInterval(15 min) verifica alerts com (last_run + interval) <= now
//   2. Chama runJobHunt(criteria) — mesma pipeline do tool linkedin_job_hunt
//   3. Dedup vs last_seen_ids (últimos 200 job_ids salvos por alert)
//   4. Se tem vagas novas: monta resumo + envia via channel (webchat/telegram/whatsapp)
//
// Tabela SQLite: job_alerts

const crypto = require("node:crypto");
const db = require("./db");
const { runJobHunt } = require("./tools/linkedinJobHunt");

const CHECK_INTERVAL_MS = 15 * 60 * 1000;   // check a cada 15 min
const MAX_SEEN_HISTORY = 200;                // memória de job_ids por alerta
const SENT_JOB_ID_RE = /(?:job_id["'\s:]*|jobs\/view\/)(\d{8,})/g;

// Setup schema (idempotente)
db.exec(`
  CREATE TABLE IF NOT EXISTS job_alerts (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'webchat',
    label TEXT NOT NULL DEFAULT '',
    criteria TEXT NOT NULL,
    interval_hours INTEGER NOT NULL DEFAULT 168,
    last_run INTEGER NOT NULL DEFAULT 0,
    last_seen_ids TEXT NOT NULL DEFAULT '[]',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

function createAlert({ chatId, criteria, intervalHours = 168, channel = "webchat", label = "" }) {
  if (!chatId) throw new Error("chatId obrigatório");
  if (!criteria) throw new Error("criteria obrigatório");
  const id = crypto.randomBytes(6).toString("hex");
  db.prepare(
    `INSERT INTO job_alerts (id, chat_id, channel, label, criteria, interval_hours)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    String(chatId),
    channel,
    label || (criteria.keywords_override ? String(criteria.keywords_override).slice(0, 40) : "vagas"),
    JSON.stringify(criteria),
    Math.max(1, parseInt(intervalHours) || 168)
  );
  return { id, chatId, criteria, intervalHours, channel, label };
}

function listAlerts(chatId) {
  const rows = db.prepare(
    `SELECT id, label, channel, criteria, interval_hours, last_run, enabled, created_at
     FROM job_alerts WHERE chat_id = ? ORDER BY created_at DESC`
  ).all(String(chatId));
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    channel: r.channel,
    interval_hours: r.interval_hours,
    last_run: r.last_run ? new Date(r.last_run).toISOString() : null,
    criteria: JSON.parse(r.criteria),
    enabled: !!r.enabled,
  }));
}

function cancelAlert(id) {
  const res = db.prepare(`UPDATE job_alerts SET enabled = 0 WHERE id = ?`).run(id);
  return res.changes > 0;
}

function extractJobIds(text) {
  const ids = new Set();
  for (const m of String(text).matchAll(SENT_JOB_ID_RE)) ids.add(m[1]);
  return [...ids];
}

async function sendVia(channel, chatId, message) {
  if (channel === "telegram") {
    try {
      const tg = require("./telegram");
      if (tg.sendMessage) await tg.sendMessage(chatId, message);
    } catch (e) { console.warn("[jobAlerts] telegram send falhou:", e.message); }
    return;
  }
  if (channel === "whatsapp") {
    try {
      const evo = require("./channels/whatsapp");
      if (evo?.sendMessage) await evo.sendMessage(chatId, message);
    } catch (e) { console.warn("[jobAlerts] whatsapp send falhou:", e.message); }
    return;
  }
  // Default: webchat — grava como notificação no DB. Frontend pode puxar.
  db.exec(`CREATE TABLE IF NOT EXISTS job_alert_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    read INTEGER NOT NULL DEFAULT 0
  )`);
  db.prepare(`INSERT INTO job_alert_notifications (chat_id, body) VALUES (?, ?)`)
    .run(String(chatId), message);
}

async function runOne(alert) {
  const crit = JSON.parse(alert.criteria);
  const seen = new Set(JSON.parse(alert.last_seen_ids || "[]"));
  const now = Date.now();

  console.log(`[jobAlerts] executando ${alert.id} (${alert.label}) para chat ${alert.chat_id}`);

  let raw;
  try {
    raw = await runJobHunt(crit);
  } catch (err) {
    console.error(`[jobAlerts] ${alert.id}: runJobHunt lançou:`, err.message);
    db.prepare(`UPDATE job_alerts SET last_run = ? WHERE id = ?`).run(now, alert.id);
    return { alert: alert.id, error: err.message };
  }

  // runJobHunt retorna string formatada — extrai job_ids via regex
  const foundIds = extractJobIds(raw);
  const newIds = foundIds.filter((id) => !seen.has(id));

  if (newIds.length > 0) {
    // Extrai as sections das vagas novas do texto (regex por bloco numerado)
    const summary = [
      `🔔 *${alert.label}* — ${newIds.length} vaga(s) nova(s) esta semana`,
      "",
      raw.split(/\n(?=\d+\. \*\*)/).filter((block) => newIds.some((id) => block.includes(id))).join("\n\n"),
    ].join("\n");
    await sendVia(alert.channel, alert.chat_id, summary);
  } else {
    console.log(`[jobAlerts] ${alert.id}: sem vagas novas`);
  }

  // Atualiza state (mantém últimos MAX_SEEN_HISTORY)
  const allSeen = [...seen, ...foundIds].slice(-MAX_SEEN_HISTORY);
  db.prepare(`UPDATE job_alerts SET last_run = ?, last_seen_ids = ? WHERE id = ?`)
    .run(now, JSON.stringify(allSeen), alert.id);

  return { alert: alert.id, found: foundIds.length, new: newIds.length };
}

async function runDue() {
  const now = Date.now();
  const due = db.prepare(
    `SELECT * FROM job_alerts
     WHERE enabled = 1
       AND (last_run + interval_hours * 3600 * 1000) <= ?`
  ).all(now);
  const results = [];
  for (const alert of due) {
    try { results.push(await runOne(alert)); }
    catch (e) { console.error("[jobAlerts] erro em", alert.id, e.message); }
    // Delay entre alerts pra não fatigar sessão LinkedIn
    await new Promise((r) => setTimeout(r, 30_000));
  }
  return results;
}

// Executa manualmente (usado por tool run_scheduled_hunt_now)
async function runNow(id) {
  const row = db.prepare(`SELECT * FROM job_alerts WHERE id = ? AND enabled = 1`).get(id);
  if (!row) throw new Error(`alert ${id} não encontrado ou desabilitado`);
  return runOne(row);
}

let timer = null;
function start() {
  if (timer) return;
  timer = setInterval(() => {
    runDue().catch((e) => console.error("[jobAlerts] runDue error:", e.message));
  }, CHECK_INTERVAL_MS);
  // Não roda immediatamente no boot — evita fatigar sessão em cada restart do container
  console.log(`[jobAlerts] iniciado (check a cada ${CHECK_INTERVAL_MS / 60000} min)`);
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

module.exports = { createAlert, listAlerts, cancelAlert, runNow, runDue, start, stop };
