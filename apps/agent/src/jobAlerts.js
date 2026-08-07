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
  CREATE TABLE IF NOT EXISTS job_alert_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    read INTEGER NOT NULL DEFAULT 0
  );
`);

const NOTIFICATION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
// Cleanup periódico — sem isso a tabela cresce sem limite (achado do audit:
// mesma classe de bug do extension_jobs, cada notificação de webchat nunca
// era removida mesmo depois de lida/expirada).
setInterval(() => {
  const cutoff = Math.floor((Date.now() - NOTIFICATION_MAX_AGE_MS) / 1000);
  db.prepare(`DELETE FROM job_alert_notifications WHERE created_at < ?`).run(cutoff);
}, 60 * 60 * 1000); // 1x por hora

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

  // runJobHunt agora devolve { text, job_ids, items } — job_id de fonte
  // externa (remoteok:123, arbeitnow:slug) não é numérico, então usamos a
  // lista estruturada em vez de extrair via regex do texto formatado.
  const foundIds = raw.job_ids;
  const newIds = foundIds.filter((id) => !seen.has(id));

  if (newIds.length > 0) {
    const newBlocks = raw.items
      .filter((it) => newIds.includes(it.job_id))
      .map((it) => it.block);
    const summary = [
      `🔔 *${alert.label}* — ${newIds.length} vaga(s) nova(s) esta semana`,
      "",
      newBlocks.join("\n\n"),
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
let runDueInFlight = false;
function start() {
  if (timer) return;
  timer = setInterval(() => {
    // Guarda de re-entrância: runOne() pode levar bem mais que 15min (rank
    // LLM + até 90s de timeout de extensão por alerta, com múltiplos alertas
    // due na mesma rodada + 30s de delay entre cada um). Sem essa guarda, o
    // próximo tick do setInterval re-seleciona o mesmo alerta ainda em voo
    // como "due" (last_run só é gravado quando runOne termina) e dispara
    // notificação duplicada pro usuário.
    if (runDueInFlight) {
      console.warn("[jobAlerts] tick ignorado — rodada anterior ainda em andamento");
      return;
    }
    runDueInFlight = true;
    runDue()
      .catch((e) => console.error("[jobAlerts] runDue error:", e.message))
      .finally(() => { runDueInFlight = false; });
  }, CHECK_INTERVAL_MS);
  // Não roda immediatamente no boot — evita fatigar sessão em cada restart do container
  console.log(`[jobAlerts] iniciado (check a cada ${CHECK_INTERVAL_MS / 60000} min)`);
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

module.exports = { createAlert, listAlerts, cancelAlert, runNow, runDue, start, stop };
