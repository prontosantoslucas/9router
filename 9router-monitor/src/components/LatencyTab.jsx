import { getRequestDetails } from "../api.js";
import { useConfig } from "../store.js";
import { usePoll } from "../usePoll.js";
import PeriodToggle from "./PeriodToggle.jsx";
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from "recharts";

function startDateFor(period) {
  const d = new Date();
  if (period === "today") d.setHours(0, 0, 0, 0);
  else d.setDate(d.getDate() - 7);
  return d.toISOString();
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.floor((p / 100) * s.length));
  return s[i];
}

export default function LatencyTab() {
  const period = useConfig((s) => s.period);
  const { data, error, loading } = usePoll(
    () => getRequestDetails(`pageSize=100&startDate=${encodeURIComponent(startDateFor(period))}`),
    [period]
  );

  if (loading) return <div className="loading">Carregando…</div>;
  if (error) return <div className="error">{error}</div>;

  const details = (data?.details || []).filter((d) => d.latency && d.latency.total > 0);
  const totals = details.map((d) => d.latency.total);
  const ttfts = details.map((d) => d.latency.ttft || 0);
  const avg = totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0;
  const p95 = Math.round(percentile(totals, 95));
  const avgTtft = ttfts.length ? Math.round(ttfts.reduce((a, b) => a + b, 0) / ttfts.length) : 0;

  const series = [...details]
    .reverse()
    .map((d, i) => ({ i, ms: d.latency.total }));

  return (
    <div className="latency">
      <PeriodToggle />
      {details.length === 0 ? (
        <div className="empty">Sem requisições no período.</div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat"><em>Média</em><strong>{avg}ms</strong></div>
            <div className="stat"><em>p95</em><strong>{p95}ms</strong></div>
            <div className="stat"><em>TTFT méd</em><strong>{avgTtft}ms</strong></div>
            <div className="stat"><em>Amostras</em><strong>{details.length}</strong></div>
          </div>
          <div className="spark">
            <ResponsiveContainer width="100%" height={70}>
              <LineChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <Tooltip
                  formatter={(v) => [`${v}ms`, "latência"]}
                  labelFormatter={() => ""}
                  contentStyle={{ background: "#1a1d24", border: "none", fontSize: 11 }}
                />
                <Line type="monotone" dataKey="ms" stroke="#6ea8fe" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
