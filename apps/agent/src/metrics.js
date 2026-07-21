const WINDOW_MS = 5 * 60 * 1000;

const state = {
  requests: [],
  errors: 0,
  latency: [],
  last5m: [],
  startTime: Date.now(),
};

function track(type, model, latencyMs, status) {
  const now = Date.now();
  const entry = { type, model, latencyMs, status, time: now };

  if (status >= 400) state.errors++;

  state.requests.push(entry);
  if (latencyMs > 0) state.latency.push(latencyMs);

  // keep windowed data
  const cutoff = now - WINDOW_MS;
  state.requests = state.requests.filter((r) => r.time > cutoff);
  state.latency = state.latency.filter((_, i) => {
    if (i > 1000) return false; // cap at 1k
    return true;
  });
  if (state.latency.length > 1000) state.latency = state.latency.slice(-1000);
}

function getStats() {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const recent = state.requests.filter((r) => r.time > cutoff);
  const recentErrors = recent.filter((r) => r.status >= 400);
  const latencies = recent.map((r) => r.latencyMs).filter((l) => l > 0);
  const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

  // model usage in last 5min
  const modelCounts = {};
  for (const r of recent) {
    if (r.model) modelCounts[r.model] = (modelCounts[r.model] || 0) + 1;
  }
  const topModels = Object.entries(modelCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([model, count]) => ({ model, count }));

  return {
    uptime: Math.round((now - state.startTime) / 1000),
    requestsTotal: state.requests.length,
    requests5m: recent.length,
    errors5m: recentErrors.length,
    avgLatencyMs: avgLatency,
    topModels,
    startTime: state.startTime,
  };
}

module.exports = { track, getStats };
