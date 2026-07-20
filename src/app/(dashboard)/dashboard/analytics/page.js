"use client";

import { useState, useEffect } from "react";
import { Card, Badge } from "@/shared/components";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const PERIODS = [{ value: "7d", label: "7 Days" }, { value: "30d", label: "30 Days" }, { value: "60d", label: "60 Days" }, { value: "all", label: "All Time" }];

const COLORS = ["#6366f1", "#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16"];

function fmtTokens(n) { if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`; if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`; return String(n || 0); }

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("7d");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState("tokens");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/usage/stats?period=${period}`).then(r => r.json()).then(data => { setStats(data); setLoading(false); }).catch(() => setLoading(false));
  }, [period]);

  const topProviders = stats ? Object.entries(stats.byProvider || {}).sort((a, b) => b[1][chartMode] - a[1][chartMode]).slice(0, 10) : [];
  const topModels = stats ? Object.entries(stats.byModel || {}).sort((a, b) => b[1][chartMode] - a[1][chartMode]).slice(0, 10) : [];
  const topKeys = stats ? Object.entries(stats.byApiKey || {}).sort((a, b) => b[1].cost - a[1].cost).slice(0, 20) : [];

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-8"><p className="text-text-muted">Loading...</p></div>;
  if (!stats) return <div className="max-w-6xl mx-auto px-4 py-8"><p className="text-text-muted">No data available</p></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex gap-1 bg-surface rounded-lg p-1 border border-border">
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${period === p.value ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text"}`}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4"><p className="text-xs text-text-muted uppercase font-semibold">Total Requests</p><p className="text-2xl font-bold mt-1">{fmtTokens(stats.totalRequests)}</p></Card>
        <Card className="p-4"><p className="text-xs text-text-muted uppercase font-semibold">Prompt Tokens</p><p className="text-2xl font-bold mt-1">{fmtTokens(stats.totalPromptTokens)}</p></Card>
        <Card className="p-4"><p className="text-xs text-text-muted uppercase font-semibold">Completion Tokens</p><p className="text-2xl font-bold mt-1">{fmtTokens(stats.totalCompletionTokens)}</p></Card>
        <Card className="p-4"><p className="text-xs text-text-muted uppercase font-semibold">Total Cost</p><p className="text-2xl font-bold mt-1">${stats.totalCost.toFixed(4)}</p></Card>
      </div>

      {/* Top Providers */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Top Providers</h2>
          <div className="flex gap-1 bg-bg-subtle rounded-md p-0.5 border border-border">
            <button onClick={() => setChartMode("tokens")} className={`px-2 py-1 rounded text-xs font-medium ${chartMode === "tokens" ? "bg-primary text-white" : "text-text-muted"}`}>Tokens</button>
            <button onClick={() => setChartMode("cost")} className={`px-2 py-1 rounded text-xs font-medium ${chartMode === "cost" ? "bg-primary text-white" : "text-text-muted"}`}>Cost</button>
          </div>
        </div>
        {topProviders.length === 0 ? <p className="text-text-muted text-sm">No provider data</p> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topProviders.map(([name, d]) => ({ name: name.length > 20 ? name.slice(0, 20) + "..." : name, value: chartMode === "tokens" ? d.promptTokens + d.completionTokens : d.cost }))} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={chartMode === "tokens" ? fmtTokens : v => `$${v.toFixed(2)}`} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => chartMode === "tokens" ? fmtTokens(v) : `$${v.toFixed(4)}`} />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {topProviders.map(([name, d]) => (
                <div key={name} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
                  <span className="truncate max-w-[200px]">{name}</span>
                  <span className="font-mono text-xs text-text-muted">{fmtTokens(d.promptTokens + d.completionTokens)} tok / ${d.cost.toFixed(4)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Top Models */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Top Models</h2>
        {topModels.length === 0 ? <p className="text-text-muted text-sm">No model data</p> : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {topModels.map(([name, d]) => (
              <div key={name} className="flex items-center justify-between text-sm py-2 border-b border-border/50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="truncate">{name}</p>
                  <p className="text-xs text-text-muted">{fmtTokens(d.promptTokens + d.completionTokens)} tokens · ${d.cost.toFixed(4)}</p>
                </div>
                <div className="w-1/3 h-2 bg-bg-subtle rounded-full overflow-hidden ml-4 flex-shrink-0">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, ((d.promptTokens + d.completionTokens) / (topModels[0]?.[1]?.promptTokens + topModels[0]?.[1]?.completionTokens || 1)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Cost Breakdown Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Cost by Provider</h2>
          {topProviders.length === 0 ? <p className="text-text-muted text-sm">No data</p> : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={topProviders.map(([name, d]) => ({ name: name.length > 15 ? name.slice(0, 15) + "..." : name, value: d.cost || 0.001 }))} dataKey="value" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {topProviders.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => `$${v.toFixed(4)}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Tokens by Provider</h2>
          {topProviders.length === 0 ? <p className="text-text-muted text-sm">No data</p> : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={topProviders.map(([name, d]) => ({ name: name.length > 15 ? name.slice(0, 15) + "..." : name, value: (d.promptTokens + d.completionTokens) || 1 }))} dataKey="value" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {topProviders.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmtTokens(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Top API Keys (Users) */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Top Users (API Keys by Cost)</h2>
        {topKeys.length === 0 ? <p className="text-text-muted text-sm">No key data</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-text-muted border-b border-border">
                <th className="pb-2">Key</th><th className="pb-2">Model</th><th className="pb-2">Provider</th><th className="pb-2 text-right">Requests</th><th className="pb-2 text-right">Tokens</th><th className="pb-2 text-right">Cost</th>
              </tr></thead>
              <tbody>
                {topKeys.map(([key, d]) => (
                  <tr key={key} className="border-b border-border/50 text-xs">
                    <td className="py-2 font-mono max-w-[100px] truncate">{d.keyName || d.apiKeyMasked || "local"}</td>
                    <td className="py-2 text-text-muted max-w-[120px] truncate">{d.rawModel || "-"}</td>
                    <td className="py-2 text-text-muted max-w-[100px] truncate">{d.provider || "-"}</td>
                    <td className="py-2 text-right">{d.requests}</td>
                    <td className="py-2 text-right font-mono">{fmtTokens(d.promptTokens + d.completionTokens)}</td>
                    <td className="py-2 text-right font-mono">${d.cost.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
