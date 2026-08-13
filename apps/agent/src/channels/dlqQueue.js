const db = require("../db");

// Garantir a tabela de mensagens da Dead-Letter Queue (DLQ)
try {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS channel_dlq_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel TEXT NOT NULL,
      recipient TEXT NOT NULL,
      payload TEXT NOT NULL,
      error_reason TEXT,
      retry_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      next_retry_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
} catch (err) {
  console.error("[DLQ] Erro ao criar tabela channel_dlq_events:", err.message);
}

/**
 * Adiciona uma mensagem com falha à fila DLQ para retentativa posterior.
 */
function enqueueFailedMessage(channel, recipient, payload, errorReason = "") {
  try {
    const stmt = db.prepare(`
      INSERT INTO channel_dlq_events (channel, recipient, payload, error_reason)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(
      channel,
      recipient,
      typeof payload === "string" ? payload : JSON.stringify(payload),
      errorReason
    );
    console.log(`[DLQ] Mensagem ${result.lastInsertRowid} enfileirada no canal ${channel} para ${recipient}`);
    return result.lastInsertRowid;
  } catch (err) {
    console.error("[DLQ] Erro ao enfileirar mensagem falha:", err.message);
    return null;
  }
}

/**
 * Busca e re-tenta mensagens pendentes na DLQ com backoff exponencial.
 */
async function retryPendingMessages(sendHandler) {
  try {
    const pending = db.prepare(`
      SELECT * FROM channel_dlq_events
      WHERE status = 'pending' AND retry_count < 5 AND next_retry_at <= datetime('now')
      LIMIT 10
    `).all();

    if (pending.length === 0) return { processed: 0, succeeded: 0 };

    let succeeded = 0;
    for (const item of pending) {
      try {
        const payload = JSON.parse(item.payload);
        const ok = sendHandler ? await sendHandler(item.channel, item.recipient, payload) : false;

        if (ok) {
          db.prepare("UPDATE channel_dlq_events SET status = 'resolved' WHERE id = ?").run(item.id);
          succeeded++;
        } else {
          const nextCount = item.retry_count + 1;
          const nextMinutes = Math.pow(2, nextCount); // 2min, 4min, 8min, 16min, 32min
          const status = nextCount >= 5 ? "dead" : "pending";

          db.prepare(`
            UPDATE channel_dlq_events 
            SET retry_count = ?, status = ?, next_retry_at = datetime('now', '+${nextMinutes} minutes')
            WHERE id = ?
          `).run(nextCount, status, item.id);
        }
      } catch (err) {
        console.error(`[DLQ] Erro ao re-tentar mensagem ${item.id}:`, err.message);
      }
    }

    return { processed: pending.length, succeeded };
  } catch (err) {
    console.error("[DLQ] Erro na execução de retentativas:", err.message);
    return { processed: 0, succeeded: 0, error: err.message };
  }
}

/**
 * Retorna métricas de saúde da Dead-Letter Queue.
 */
function getDlqStats() {
  try {
    const totals = db.prepare(`
      SELECT 
        COUNT(*) as total_events,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending_count,
        COALESCE(SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END), 0) as resolved_count,
        COALESCE(SUM(CASE WHEN status = 'dead' THEN 1 ELSE 0 END), 0) as dead_count
      FROM channel_dlq_events
    `).get();

    return totals;
  } catch (err) {
    console.error("[DLQ] Erro ao buscar stats:", err.message);
    return { total_events: 0, pending_count: 0, resolved_count: 0, dead_count: 0 };
  }
}

module.exports = {
  enqueueFailedMessage,
  retryPendingMessages,
  getDlqStats
};
