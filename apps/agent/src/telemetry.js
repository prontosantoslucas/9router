const db = require("./db");

// Criar tabela de eventos de telemetria se não existir
try {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS telemetry_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      provider TEXT,
      model TEXT,
      tokens_in INTEGER DEFAULT 0,
      tokens_out INTEGER DEFAULT 0,
      tokens_saved INTEGER DEFAULT 0,
      latency_ms INTEGER DEFAULT 0,
      status TEXT DEFAULT 'success',
      filter_applied TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
} catch (err) {
  console.error("[Telemetry] Erro ao criar tabela telemetry_events:", err.message);
}

/**
 * Registra um evento de telemetria no banco de dados.
 */
function recordTelemetryEvent(data = {}) {
  try {
    const {
      eventType = "llm_request",
      provider = "unknown",
      model = "unknown",
      tokensIn = 0,
      tokensOut = 0,
      tokensSaved = 0,
      latencyMs = 0,
      status = "success",
      filterApplied = null
    } = data;

    const stmt = db.prepare(`
      INSERT INTO telemetry_events (
        event_type, provider, model, tokens_in, tokens_out, tokens_saved, latency_ms, status, filter_applied
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      eventType,
      provider,
      model,
      tokensIn,
      tokensOut,
      tokensSaved,
      latencyMs,
      status,
      filterApplied
    );

    return true;
  } catch (err) {
    console.error("[Telemetry] Erro ao registrar evento:", err.message);
    return false;
  }
}

/**
 * Retorna estatísticas agregadas de telemetria.
 */
function getTelemetryStats() {
  try {
    const totals = db.prepare(`
      SELECT 
        COUNT(*) as total_requests,
        COALESCE(SUM(tokens_in), 0) as total_tokens_in,
        COALESCE(SUM(tokens_out), 0) as total_tokens_out,
        COALESCE(SUM(tokens_saved), 0) as total_tokens_saved,
        COALESCE(AVG(latency_ms), 0) as avg_latency_ms,
        COALESCE(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END), 0) as success_count,
        COALESCE(SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END), 0) as error_count
      FROM telemetry_events
    `).get();

    const byProvider = db.prepare(`
      SELECT 
        provider,
        COUNT(*) as count,
        COALESCE(AVG(latency_ms), 0) as avg_latency_ms,
        COALESCE(SUM(tokens_saved), 0) as tokens_saved
      FROM telemetry_events
      GROUP BY provider
      ORDER BY count DESC
      LIMIT 10
    `).all();

    const rtkFilters = db.prepare(`
      SELECT 
        filter_applied,
        COUNT(*) as count,
        COALESCE(SUM(tokens_saved), 0) as total_saved
      FROM telemetry_events
      WHERE filter_applied IS NOT NULL AND filter_applied != ''
      GROUP BY filter_applied
      ORDER BY total_saved DESC
    `).all();

    const successRate = totals.total_requests > 0 
      ? Math.round((totals.success_count / totals.total_requests) * 100) 
      : 100;

    return {
      totals: {
        ...totals,
        avg_latency_ms: Math.round(totals.avg_latency_ms),
        success_rate_pct: successRate
      },
      byProvider,
      rtkFilters
    };
  } catch (err) {
    console.error("[Telemetry] Erro ao buscar estatísticas:", err.message);
    return {
      totals: { total_requests: 0, total_tokens_in: 0, total_tokens_out: 0, total_tokens_saved: 0, avg_latency_ms: 0, success_rate_pct: 100 },
      byProvider: [],
      rtkFilters: []
    };
  }
}

module.exports = {
  recordTelemetryEvent,
  getTelemetryStats
};
