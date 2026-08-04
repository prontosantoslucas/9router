import { getStats } from "../api.js";
import { useConfig } from "../store.js";
import { usePoll } from "../usePoll.js";
import PeriodToggle from "./PeriodToggle.jsx";

function fmt(n) {
  if (n == null) return "0";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n);
}

export default function ModelsTab() {
  const period = useConfig((s) => s.period);
  const { data, error, loading } = usePoll(() => getStats(period), [period]);

  if (loading) return <div className="loading">Carregando…</div>;
  if (error) return <div className="error">{error}</div>;

  const byModel = data?.byModel || {};
  const list = Object.entries(byModel)
    .map(([key, m]) => ({ key, ...m }))
    .sort((a, b) => (b.requests || 0) - (a.requests || 0))
    .slice(0, 8);
  const max = list.reduce((mx, m) => Math.max(mx, m.requests || 0), 0) || 1;

  return (
    <div className="models">
      <PeriodToggle />
      <div className="totals">
        <span>{fmt(data?.totalRequests)} req</span>
        <span>{fmt((data?.totalPromptTokens || 0) + (data?.totalCompletionTokens || 0))} tok</span>
        <span>${(data?.totalCost || 0).toFixed(2)}</span>
      </div>
      {list.length === 0 ? (
        <div className="empty">Sem uso no período.</div>
      ) : (
        <div className="rank">
          {list.map((m) => (
            <div className="rank-row" key={m.key}>
              <div className="rank-meta">
                <span className="name" title={m.key}>{m.rawModel || m.key}</span>
                <span className="muted">{m.requests} req</span>
              </div>
              <div className="bar sm">
                <span style={{ width: `${((m.requests || 0) / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
