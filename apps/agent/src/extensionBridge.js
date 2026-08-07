// Ponte agent ↔ extensão Chrome do usuário.
//
// Fluxo:
//   1. Tool no agent → enqueueJob({type, params}) → salva em SQLite → retorna Promise
//   2. Extensão fica em polling: GET /api/extension/next-job
//   3. Extensão executa no browser real → POST /api/extension/job-result
//   4. Promise do passo 1 resolve com o resultado
//
// Auth: header `Authorization: Bearer $EXTENSION_TOKEN`.

const crypto = require("node:crypto");
const db = require("./db");

// Pior caso real do lado da extensão: até 30s de latência de pickup (piso do
// chrome.alarms) + até 60s de execução (REQUEST_TIMEOUT_MS no background.js)
// = 90s. 90_000 aqui batia exatamente nesse limite, sem margem — qualquer
// variação fazia o agent desistir antes da extensão terminar. 120s dá folga.
const JOB_TIMEOUT_MS = 120_000;
const JOB_MAX_AGE_MS = 5 * 60_000;

// Setup schema
db.exec(`
  CREATE TABLE IF NOT EXISTS extension_jobs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    params TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    result TEXT,
    error TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    picked_at INTEGER,
    completed_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS extension_jobs_status ON extension_jobs (status, created_at);
`);

// Waiters: { jobId: {resolve, reject, timer} }
const waiters = new Map();

// Cleanup periódico de jobs velhos — sem filtro de status: um job travado em
// 'picked' (extensão morreu no meio) ou 'timeout' nunca deveria ficar pra
// sempre na tabela só porque o status dele não estava na lista. Se passou de
// JOB_MAX_AGE_MS, tá obsoleto de qualquer forma — inclusive 'pending'/'picked'
// órfão de um restart do processo (o Map `waiters` é em memória; um restart
// do container mata o timer de timeout, mas não a linha no SQLite).
setInterval(() => {
  const cutoff = Date.now() - JOB_MAX_AGE_MS;
  db.prepare("DELETE FROM extension_jobs WHERE created_at * 1000 < ?").run(cutoff);
}, 60_000);

function enqueue({ type, params = {} }) {
  const id = enqueueNow({ type, params });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters.delete(id);
      db.prepare("UPDATE extension_jobs SET status='timeout' WHERE id=?").run(id);
      reject(new Error(`Timeout aguardando extensão para job ${type} (${JOB_TIMEOUT_MS}ms)`));
    }, JOB_TIMEOUT_MS);
    waiters.set(id, { resolve, reject, timer });
  });
}

// Sincrono: insere e devolve o id (usado pelo endpoint de teste E2E).
function enqueueNow({ type, params = {} }) {
  if (!type) throw new Error("type obrigatório");
  const id = crypto.randomBytes(8).toString("hex");
  db.prepare(
    "INSERT INTO extension_jobs (id, type, params) VALUES (?, ?, ?)"
  ).run(id, type, JSON.stringify(params || {}));
  return id;
}

// Endpoint GET /api/extension/next-job
function pickNextJob() {
  const row = db.prepare(
    "SELECT id, type, params FROM extension_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1"
  ).get();
  if (!row) return null;
  db.prepare(
    "UPDATE extension_jobs SET status='picked', picked_at=(unixepoch()) WHERE id=?"
  ).run(row.id);
  return {
    id: row.id,
    type: row.type,
    params: JSON.parse(row.params || "{}"),
  };
}

// Endpoint POST /api/extension/job-result
function completeJob({ job_id, result, error }) {
  if (!job_id) throw new Error("job_id obrigatório");
  const row = db.prepare("SELECT status FROM extension_jobs WHERE id=?").get(job_id);
  if (!row) return { ok: false, reason: "not-found" };

  db.prepare(
    "UPDATE extension_jobs SET status=?, result=?, error=?, completed_at=(unixepoch()) WHERE id=?"
  ).run(
    error ? "error" : "done",
    result ? JSON.stringify(result) : null,
    error || null,
    job_id
  );

  const w = waiters.get(job_id);
  if (w) {
    clearTimeout(w.timer);
    waiters.delete(job_id);
    if (error) w.reject(new Error(error));
    else w.resolve(result);
  }
  return { ok: true };
}

function stats() {
  const rows = db.prepare("SELECT status, COUNT(*) as n FROM extension_jobs GROUP BY status").all();
  return {
    by_status: Object.fromEntries(rows.map((r) => [r.status, r.n])),
    waiters: waiters.size,
  };
}

module.exports = { enqueue, enqueueNow, pickNextJob, completeJob, stats };
