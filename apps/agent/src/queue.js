const db = require("./db");

const handlers = new Map();
let workerInterval = null;

/**
 * Enfileira uma tarefa assíncrona no SQLite.
 */
function enqueue(taskType, payload = {}, runAt = null) {
  try {
    const payloadStr = JSON.stringify(payload);
    const runAtTime = runAt ? new Date(runAt).toISOString() : new Date().toISOString();
    const stmt = db.prepare(
      "INSERT INTO queue_jobs (task_type, payload, status, run_at) VALUES (?, ?, 'PENDING', ?)"
    );
    const info = stmt.run(taskType, payloadStr, runAtTime);
    return info.lastInsertRowid;
  } catch (err) {
    console.error(`[Queue] Erro ao enfileirar tarefa ${taskType}:`, err.message);
    throw err;
  }
}

/**
 * Registra um manipulador de tarefa assíncrona.
 */
function registerHandler(taskType, handlerFn) {
  handlers.set(taskType, handlerFn);
}

/**
 * Processa um lote de tarefas pendentes.
 */
async function processNextJobs(limit = 5) {
  const now = new Date().toISOString();

  let jobs = [];
  try {
    jobs = db
      .prepare(
        "SELECT id, task_type, payload FROM queue_jobs WHERE status = 'PENDING' AND run_at <= ? ORDER BY id ASC LIMIT ?"
      )
      .all(now, limit);
  } catch (err) {
    console.error("[Queue] Erro ao buscar tarefas pendentes:", err.message);
    return 0;
  }

  if (jobs.length === 0) return 0;

  for (const job of jobs) {
    try {
      db.prepare("UPDATE queue_jobs SET status = 'PROCESSING' WHERE id = ?").run(job.id);
    } catch {
      continue;
    }

    const handler = handlers.get(job.task_type);
    if (!handler) {
      db.prepare(
        "UPDATE queue_jobs SET status = 'FAILED', error_msg = ? WHERE id = ?"
      ).run(`Manipulador não registrado para task_type=${job.task_type}`, job.id);
      continue;
    }

    try {
      const parsedPayload = JSON.parse(job.payload || "{}");
      await handler(parsedPayload);
      db.prepare(
        "UPDATE queue_jobs SET status = 'COMPLETED', completed_at = datetime('now') WHERE id = ?"
      ).run(job.id);
    } catch (err) {
      console.error(`[Queue] Falha ao processar job #${job.id} (${job.task_type}):`, err.message);
      db.prepare(
        "UPDATE queue_jobs SET status = 'FAILED', error_msg = ? WHERE id = ?"
      ).run(err.message, job.id);
    }
  }

  return jobs.length;
}

/**
 * Inicia o worker em segundo plano.
 */
function startWorker(intervalMs = 3000) {
  if (workerInterval) return;
  workerInterval = setInterval(async () => {
    try {
      await processNextJobs(5);
    } catch (err) {
      console.error("[Queue Worker] Erro no ciclo do worker:", err.message);
    }
  }, intervalMs);
  if (workerInterval.unref) workerInterval.unref();
  console.log(`[Queue Worker] Worker assíncrono iniciado com intervalo de ${intervalMs}ms`);
}

/**
 * Para o worker em segundo plano.
 */
function stopWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}

/**
 * Retorna estatísticas da fila de tarefas.
 */
function getStats() {
  try {
    const rows = db
      .prepare("SELECT status, COUNT(*) as count FROM queue_jobs GROUP BY status")
      .all();
    const stats = { PENDING: 0, PROCESSING: 0, COMPLETED: 0, FAILED: 0 };
    for (const r of rows) {
      stats[r.status] = r.count;
    }
    return stats;
  } catch {
    return { PENDING: 0, PROCESSING: 0, COMPLETED: 0, FAILED: 0 };
  }
}

module.exports = {
  enqueue,
  registerHandler,
  processNextJobs,
  startWorker,
  stopWorker,
  getStats,
};
