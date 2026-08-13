"use client";

import { useEffect, useState } from "react";
import { 
  Activity, 
  Cpu, 
  Zap, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  TrendingUp, 
  Layers, 
  ShieldCheck 
} from "lucide-react";

export default function TelemetryPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTelemetry = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/telemetry/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Erro ao carregar telemetria:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 15000);
    return () => clearInterval(interval);
  }, []);

  const totals = stats?.totals || {
    total_requests: 0,
    total_tokens_in: 0,
    total_tokens_out: 0,
    total_tokens_saved: 0,
    avg_latency_ms: 0,
    success_rate_pct: 100,
  };

  const byProvider = stats?.byProvider || [];
  const rtkFilters = stats?.rtkFilters || [];

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-2 text-brand-500 font-semibold text-sm tracking-wide uppercase">
            <Activity className="w-4 h-4" /> Observabilidade & Telemetria em Tempo Real
          </div>
          <h1 className="text-3xl font-bold text-text-main mt-1">Métricas de LLMs & Economia RTK</h1>
          <p className="text-text-muted text-sm mt-1">
            Monitoramento de latência, taxa de sucesso de fallbacks e compressão de tokens por filtro.
          </p>
        </div>
        <button
          onClick={fetchTelemetry}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-border/80 text-text-main text-sm font-medium hover:bg-surface-2 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar Métricas
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Requisições */}
        <div className="p-5 rounded-2xl bg-surface/70 border border-border/60 backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Total de Chamadas</span>
            <Cpu className="w-5 h-5 text-brand-500" />
          </div>
          <div className="text-3xl font-extrabold text-text-main">
            {loading ? "..." : totals.total_requests.toLocaleString("pt-BR")}
          </div>
          <p className="text-xs text-text-muted">Requisições processadas pelo roteador</p>
        </div>

        {/* Card 2: Economia RTK */}
        <div className="p-5 rounded-2xl bg-surface/70 border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Economia RTK</span>
            <Zap className="w-5 h-5" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400">
            {loading ? "..." : `${(totals.total_tokens_saved / 1000).toFixed(1)}k`}
          </div>
          <p className="text-xs text-emerald-500/80">Tokens economizados em ferramentas</p>
        </div>

        {/* Card 3: Latência Média */}
        <div className="p-5 rounded-2xl bg-surface/70 border border-border/60 backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Latência Média</span>
            <TrendingUp className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-3xl font-extrabold text-text-main">
            {loading ? "..." : `${totals.avg_latency_ms} ms`}
          </div>
          <p className="text-xs text-text-muted">Tempo médio de resposta dos LLMs</p>
        </div>

        {/* Card 4: Taxa de Sucesso */}
        <div className="p-5 rounded-2xl bg-surface/70 border border-border/60 backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Taxa de Sucesso</span>
            <ShieldCheck className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-3xl font-extrabold text-text-main">
            {loading ? "..." : `${totals.success_rate_pct}%`}
          </div>
          <p className="text-xs text-text-muted">Resiliência e estabilidade do fallback</p>
        </div>
      </div>

      {/* Grid 2 Colunas: Provedores vs Filtros RTK */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Desempenho por Provedor */}
        <div className="p-6 rounded-2xl bg-surface/70 border border-border/60 space-y-4">
          <div className="flex items-center gap-2 text-text-main font-semibold text-lg border-b border-border/40 pb-3">
            <Layers className="w-5 h-5 text-brand-500" /> Latência & Volume por Provedor
          </div>
          {loading ? (
            <div className="text-center py-8 text-text-muted text-sm">Carregando dados dos provedores...</div>
          ) : byProvider.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-sm">Nenhum evento registrado ainda.</div>
          ) : (
            <div className="space-y-3">
              {byProvider.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-surface-2/60 border border-border/40">
                  <div>
                    <div className="font-semibold text-text-main text-sm capitalize">{item.provider}</div>
                    <div className="text-xs text-text-muted">{item.count} requisições processadas</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-amber-400">{Math.round(item.avg_latency_ms)} ms</div>
                    <div className="text-xs text-emerald-400">-{Math.round(item.tokens_saved / 1000)}k tokens</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Impacto dos Filtros RTK Token Saver */}
        <div className="p-6 rounded-2xl bg-surface/70 border border-border/60 space-y-4">
          <div className="flex items-center gap-2 text-text-main font-semibold text-lg border-b border-border/40 pb-3">
            <Zap className="w-5 h-5 text-emerald-400" /> Filtros do RTK Token Saver
          </div>
          {loading ? (
            <div className="text-center py-8 text-text-muted text-sm">Carregando métricas RTK...</div>
          ) : rtkFilters.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-sm">Nenhum filtro ativado recentemente.</div>
          ) : (
            <div className="space-y-3">
              {rtkFilters.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold">
                      {item.filter_applied}
                    </span>
                    <span className="text-xs text-text-muted">({item.count} usos)</span>
                  </div>
                  <div className="text-emerald-400 font-bold text-sm">
                    +{(item.total_saved / 1000).toFixed(1)}k economizados
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
