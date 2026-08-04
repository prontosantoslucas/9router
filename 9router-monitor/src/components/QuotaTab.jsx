import { useEffect, useState } from "react";
import { getProviders, getQuota, getStats } from "../api.js";
import { useConfig } from "../store.js";

const PRIORITY = ["antigravity", "claude"];

function pct(q) {
  if (typeof q.remainingPercentage === "number") return Math.max(0, Math.min(100, q.remainingPercentage));
  if (typeof q.remaining === "number" && typeof q.total === "number" && q.total > 0)
    return Math.max(0, Math.min(100, (q.remaining / q.total) * 100));
  if (typeof q.used === "number" && typeof q.total === "number" && q.total > 0)
    return Math.max(0, Math.min(100, 100 - (q.used / q.total) * 100));
  return null;
}

function priority(provider) {
  const index = PRIORITY.indexOf(provider);
  return index === -1 ? PRIORITY.length : index;
}

function countdown(resetAt, now) {
  const seconds = Math.max(0, Math.floor((new Date(resetAt).getTime() - now) / 1000));
  if (!resetAt || Number.isNaN(new Date(resetAt).getTime())) return "sem reset";
  if (seconds === 0) return "reinicia agora";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function quotaState(remaining) {
  if (remaining === null) return "";
  if (remaining < 15) return "low";
  if (remaining < 40) return "mid";
  return "full";
}

export default function QuotaTab() {
  const refreshMs = useConfig((s) => s.refreshMs);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const [{ connections = [] }, stats] = await Promise.all([
          getProviders(),
          getStats("7d"),
        ]);
        const requestsByConnection = {};
        for (const account of Object.values(stats?.byAccount || {})) {
          if (!account.connectionId) continue;
          requestsByConnection[account.connectionId] =
            (requestsByConnection[account.connectionId] || 0) + (account.requests || 0);
        }
        const oauth = connections
          .filter((c) => c.authType === "oauth" && (requestsByConnection[c.id] || 0) > 0)
          .sort((a, b) => {
            const rank = priority(a.provider) - priority(b.provider);
            if (rank) return rank;
            return (requestsByConnection[b.id] || 0) - (requestsByConnection[a.id] || 0);
          });
        const results = await Promise.all(
          oauth.map(async (conn) => {
            const requests = requestsByConnection[conn.id] || 0;
            try {
              return { conn, quota: await getQuota(conn.id), requests };
            } catch (e) {
              return { conn, quota: { message: String(e) }, requests };
            }
          })
        );
        if (alive) {
          setRows(results);
          setError("");
        }
      } catch (e) {
        if (alive) setError(String(e));
      } finally {
        if (alive) setLoading(false);
      }
    }
    tick();
    const id = setInterval(tick, refreshMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [refreshMs]);

  if (loading) return <div className="loading">Carregando cotas…</div>;
  if (error) return <div className="error">{error}</div>;
  if (!rows.length) return <div className="empty">Sem modelos em uso nos últimos 7 dias.</div>;

  return (
    <div className="quota-list">
      {rows.map(({ conn, quota, requests }) => (
        <div className="quota-card" key={conn.id}>
          <div className="quota-head">
            <strong>{conn.name || conn.email || conn.provider}</strong>
            <span className="tag">{requests} req · {conn.provider}</span>
          </div>
          {quota.quotas ? (
            Object.entries(quota.quotas)
              .filter(([, q]) => q.used > 0 || q.remainingPercentage < 100)
              .sort(([, a], [, b]) => (a.remainingPercentage ?? 100) - (b.remainingPercentage ?? 100))
              .map(([label, q]) => {
                const remaining = pct(q);
                const state = quotaState(remaining);
                return (
                  <div className="quota-row" key={label}>
                    <div className="quota-meta">
                      <span className="quota-name" title={q.displayName || label}>{q.displayName || label}</span>
                      <span className={`countdown ${state}`}>{countdown(q.resetAt, now)}</span>
                    </div>
                    {q.unlimited ? (
                      <div className="bar unlimited"><span style={{ width: "100%" }} /></div>
                    ) : remaining === null ? (
                      <div className="muted small">sem dados</div>
                    ) : (
                      <div className={`bar ${state}`}>
                        <span className={state} style={{ width: `${remaining}%` }} />
                        <em>{Math.round(remaining)}%</em>
                      </div>
                    )}
                  </div>
                );
              })
          ) : (
            <div className="muted small">{quota.message || "sem dados de cota"}</div>
          )}
        </div>
      ))}
    </div>
  );
}
