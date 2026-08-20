"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, DollarSign, Target, Users, Zap,
  ArrowUp, ArrowDown, BarChart3, PieChart, Sparkles, RefreshCw,
  Award, ShieldAlert, ArrowLeft, Trophy
} from "lucide-react";
import { formatCurrency, initials, avatarColor, stageMeta } from "../crmMeta";

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pipeline, setPipeline] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [topRevenue, setTopRevenue] = useState([]);
  const [topUsage, setTopUsage] = useState([]);
  const [roi, setROI] = useState([]);
  const [dealsTrend, setDealsTrend] = useState([]);
  const [monthlyForecast, setMonthlyForecast] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    try {
      setLoading(true);
      const [mainRes, topRevRes, topUsageRes, roiRes, trendRes, monthlyRes] = await Promise.all([
        fetch("/api/crm/analytics"),
        fetch("/api/crm/analytics?type=top-revenue&limit=10"),
        fetch("/api/crm/analytics?type=top-usage&limit=10"),
        fetch("/api/crm/analytics?type=roi"),
        fetch("/api/crm/analytics?type=deals-trend&days=30"),
        fetch("/api/crm/analytics?type=monthly-forecast"),
      ]);

      const mainData = await mainRes.json();
      const topRevData = await topRevRes.json();
      const topUsageData = await topUsageRes.json();
      const roiData = await roiRes.json();
      const trendData = await trendRes.json();
      const monthlyData = await monthlyRes.json();

      setPipeline(mainData.pipeline);
      setForecast(mainData.forecast);
      setComparison(mainData.comparison);
      setTopRevenue(topRevData.top || []);
      setTopUsage(topUsageData.top || []);
      setROI(roiData.analysis || []);
      setDealsTrend(trendData.trend || []);
      setMonthlyForecast(monthlyData);
    } catch (error) {
      console.error("Erro ao buscar analytics:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center space-y-3 flex-col">
        <div className="size-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        <p className="text-xs font-mono text-text-muted">Carregando métricas de inteligência…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ── Top Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
            <Link href="/dashboard/crm" className="hover:text-text-main transition-colors">CRM</Link>
            <span>/</span>
            <span className="font-semibold text-brand-400">Analytics & Relatórios</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black font-display text-text-main tracking-tight flex items-center gap-2.5">
            <BarChart3 className="size-6 text-brand-500" />
            Performance Comercial & Insights
          </h1>
          <p className="text-xs text-text-muted">
            Métricas de conversão de pipeline, previsão de receita e ranking de clientes de maior valor.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              fetchAnalytics();
            }}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-bold text-text-main hover:bg-surface-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin text-brand-500" : ""}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* ── Top KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-border bg-surface p-4 space-y-2 shadow-soft">
          <div className="flex items-center justify-between text-xs font-semibold text-text-muted">
            <span>Pipeline Total</span>
            <DollarSign className="size-4 text-brand-500" />
          </div>
          <div className="text-xl font-black font-display text-text-main">
            {formatCurrency(pipeline?.pipelineValue || 0)}
          </div>
          <p className="text-[11px] text-text-muted">Volume total em negociação</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 space-y-2 shadow-soft">
          <div className="flex items-center justify-between text-xs font-semibold text-text-muted">
            <span>Taxa de Ganho (Win Rate)</span>
            <Target className="size-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black font-display text-emerald-400">
            {pipeline?.winRate?.toFixed(1) || 0}%
          </div>
          <p className="text-[11px] text-text-muted">Proporção de negócios fechados</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 space-y-2 shadow-soft">
          <div className="flex items-center justify-between text-xs font-semibold text-text-muted">
            <span>Total de Oportunidades</span>
            <Users className="size-4 text-purple-400" />
          </div>
          <div className="text-xl font-black font-display text-text-main">
            {pipeline?.totalDeals || 0}
          </div>
          <p className="text-[11px] text-text-muted">Negócios gerados no histórico</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 space-y-2 shadow-soft">
          <div className="flex items-center justify-between text-xs font-semibold text-text-muted">
            <span>Receita Esperada (Forecast)</span>
            <TrendingUp className="size-4 text-orange-400" />
          </div>
          <div className="text-xl font-black font-display text-text-main">
            {formatCurrency(Math.round((forecast?.expectedRevenue || 0) * 100))}
          </div>
          <p className="text-[11px] text-text-muted">Ponderada por estágio</p>
        </div>
      </div>

      {/* ── Month Comparison ── */}
      {comparison && (
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-soft">
          <h2 className="text-sm font-bold font-display text-text-main flex items-center gap-2 border-b border-border pb-3">
            <Sparkles className="size-4 text-brand-500" />
            Comparativo Mês Atual vs Mês Anterior
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-surface-2 border border-border space-y-1.5">
              <span className="text-xs font-semibold text-text-muted">Novos Negócios Criados</span>
              <div className="text-xl font-black text-text-main">{comparison.current?.dealsCreated || 0}</div>
              <div className="flex items-center gap-1 text-[11px]">
                {(comparison.growth?.deals || 0) >= 0 ? (
                  <span className="flex items-center gap-0.5 text-emerald-400 font-bold">
                    <ArrowUp className="size-3" /> +{comparison.growth?.deals?.toFixed(1)}%
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-crimson-400 font-bold">
                    <ArrowDown className="size-3" /> {comparison.growth?.deals?.toFixed(1)}%
                  </span>
                )}
                <span className="text-text-muted">vs mês anterior</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-2 border border-border space-y-1.5">
              <span className="text-xs font-semibold text-text-muted">Receita Realizada</span>
              <div className="text-xl font-black text-emerald-400">{formatCurrency(Math.round((comparison.current?.revenue || 0) * 100))}</div>
              <div className="flex items-center gap-1 text-[11px]">
                {(comparison.growth?.revenue || 0) >= 0 ? (
                  <span className="flex items-center gap-0.5 text-emerald-400 font-bold">
                    <ArrowUp className="size-3" /> +{comparison.growth?.revenue?.toFixed(1)}%
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-crimson-400 font-bold">
                    <ArrowDown className="size-3" /> {comparison.growth?.revenue?.toFixed(1)}%
                  </span>
                )}
                <span className="text-text-muted">vs mês anterior</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-2 border border-border space-y-1.5">
              <span className="text-xs font-semibold text-text-muted">Negócios Ganhos</span>
              <div className="text-xl font-black text-text-main">{comparison.current?.dealsWon || 0}</div>
              <span className="text-[11px] text-text-muted font-mono">
                {comparison.previous?.dealsWon || 0} no mês anterior
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── 30-Day Deal Trend Visualizer ── */}
      {dealsTrend.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-soft">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-sm font-bold font-display text-text-main flex items-center gap-2">
              <BarChart3 className="size-4 text-brand-500" />
              Tendência de Novos Negócios (Últimos 30 Dias)
            </h2>
            <span className="text-xs font-mono text-text-muted">Histórico diário</span>
          </div>

          <div className="h-44 flex items-end gap-1.5 pt-4">
            {dealsTrend.map((day, i) => {
              const maxDeals = Math.max(1, ...dealsTrend.map((d) => d.dealsCreated || 0));
              const height = (day.dealsCreated / maxDeals) * 100;

              return (
                <div key={i} className="flex-1 flex flex-col items-center group h-full justify-end">
                  <div
                    className="w-full rounded-t-md bg-brand-500/40 group-hover:bg-brand-500 transition-all cursor-pointer relative"
                    style={{ height: `${Math.max(height, 6)}%` }}
                    title={`${day.date}: ${day.dealsCreated} negócio(s)`}
                  />
                  <span className="text-[9px] font-mono text-text-muted mt-1 truncate max-w-full">
                    {day.date.slice(-2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Monthly Forecast (expectedCloseAt based) ── */}
      {monthlyForecast && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Forecast next 6 months */}
          <div className="rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-soft">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-bold font-display text-text-main flex items-center gap-2">
                <TrendingUp className="size-4 text-brand-500" />
                Forecast de Fechamentos (6 Meses)
              </h2>
              <span className="text-[10px] font-bold text-text-muted bg-surface-2 border border-border rounded-md px-2 py-0.5">
                Baseado em data prevista
              </span>
            </div>

            <div className="space-y-3">
              {(monthlyForecast.forecastByMonth || []).map((m) => {
                const maxGross = Math.max(1, ...(monthlyForecast.forecastByMonth || []).map((x) => x.gross));
                const [year, month] = m.month.split("-");
                const monthLabel = new Date(year, Number(month) - 1, 1).toLocaleDateString("pt-BR", { month: "short" });
                return (
                  <div key={m.month} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-text-main capitalize">{monthLabel}/{year.slice(2)}</span>
                      <span className="font-mono text-text-muted">
                        <span className="font-bold text-brand-400">{formatCurrency(m.gross)}</span>
                        {" · "}ponderado {formatCurrency(m.weighted)}
                      </span>
                    </div>
                    <div className="flex h-5 gap-1">
                      <div
                        className="rounded-md bg-brand-500/70 group-hover:bg-brand-500 transition-all"
                        style={{ width: `${(m.gross / maxGross) * 100}%` }}
                        title={`${m.month}: ${formatCurrency(m.gross)} previsto`}
                      />
                      <div
                        className="rounded-md bg-emerald-400/70"
                        style={{ width: `${(m.weighted / maxGross) * 100}%` }}
                        title={`${m.month}: ${formatCurrency(m.weighted)} ponderado`}
                      />
                    </div>
                  </div>
                );
              })}
              {(!monthlyForecast.forecastByMonth || monthlyForecast.forecastByMonth.length === 0) && (
                <p className="py-6 text-center text-xs text-text-muted">Nenhum negócio com data de fechamento prevista.</p>
              )}
            </div>

            <div className="flex items-center gap-4 pt-2 border-t border-border text-[10px] font-bold text-text-muted">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-brand-500/70" /> Previsto (bruto)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-emerald-400/70" /> Ponderado (prob. por estágio)
              </span>
            </div>
          </div>

          {/* Won revenue last 6 months */}
          <div className="rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-soft">
            <h2 className="text-sm font-bold font-display text-text-main flex items-center gap-2 border-b border-border pb-3">
              <Trophy className="size-4 text-yellow-400" />
              Receita Realizada (6 Meses)
            </h2>

            <div className="space-y-3">
              {(monthlyForecast.wonByMonth || []).map((m) => {
                const maxWon = Math.max(1, ...(monthlyForecast.wonByMonth || []).map((x) => x.revenue));
                const [year, month] = m.month.split("-");
                const monthLabel = new Date(year, Number(month) - 1, 1).toLocaleDateString("pt-BR", { month: "short" });
                return (
                  <div key={m.month} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-text-main capitalize">{monthLabel}/{year.slice(2)}</span>
                      <span className="font-mono text-text-muted">
                        <span className="font-bold text-emerald-400">{formatCurrency(m.revenue)}</span>
                        {m.count > 0 && <span> · {m.count} ganho(s)</span>}
                      </span>
                    </div>
                    <div className="h-5 rounded-md bg-emerald-500/20">
                      <div
                        className="h-full rounded-md bg-emerald-400/70 transition-all"
                        style={{ width: `${(m.revenue / maxWon) * 100}%` }}
                        title={`${m.month}: ${formatCurrency(m.revenue)} ganhos`}
                      />
                    </div>
                  </div>
                );
              })}
              {(!monthlyForecast.wonByMonth || monthlyForecast.wonByMonth.length === 0) && (
                <p className="py-6 text-center text-xs text-text-muted">Sem receita realizada nos últimos 6 meses.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Conversion by Stage ── */}
      {monthlyForecast?.conversionByStage && monthlyForecast.conversionByStage.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-soft">
          <h2 className="text-sm font-bold font-display text-text-main flex items-center gap-2 border-b border-border pb-3">
            <Target className="size-4 text-brand-500" />
            Conversão por Estágio
          </h2>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs text-text-main min-w-[560px]">
              <thead className="border-b border-border bg-surface-2 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                <tr>
                  <th className="p-3">Estágio</th>
                  <th className="p-3 text-right">Negócios</th>
                  <th className="p-3 text-right">Participação</th>
                  <th className="p-3 text-right">Prob. Conversão</th>
                  <th className="p-3 text-right">Valor Total</th>
                  <th className="p-3 text-right">Receita Esperada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {monthlyForecast.conversionByStage.map((row) => {
                  const sm = stageMeta(row.stage);
                  return (
                    <tr key={row.stage} className="hover:bg-surface-2/60 transition-colors">
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${sm.bg} ${sm.text}`}>
                          {sm.label}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold font-mono">{row.count}</td>
                      <td className="p-3 text-right text-text-muted">{row.share}%</td>
                      <td className="p-3 text-right font-mono">
                        <span className="font-bold text-brand-400">{(row.probability * 100).toFixed(0)}%</span>
                      </td>
                      <td className="p-3 text-right font-mono text-text-main">{formatCurrency(row.totalValue)}</td>
                      <td className="p-3 text-right font-mono text-emerald-400">{formatCurrency(row.expectedRevenue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Top Rankings ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers by Revenue */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-soft">
          <h2 className="text-sm font-bold font-display text-text-main flex items-center gap-2 border-b border-border pb-3">
            <Award className="size-4 text-yellow-400" />
            Top Clientes por Receita (LTV)
          </h2>

          {topRevenue.length === 0 ? (
            <p className="py-8 text-center text-xs text-text-muted">Sem dados suficientes ainda.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {topRevenue.map((item, idx) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-mono font-bold text-text-muted w-5 text-center">
                      #{idx + 1}
                    </span>
                    <div className={`size-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(item.name)}`}>
                      {initials(item.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-text-main truncate">{item.name}</p>
                      <p className="text-[10px] text-text-muted truncate">{item.company || "Empresa"}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold font-mono text-emerald-400">
                      {formatCurrency(item.revenue)}
                    </p>
                    <p className="text-[10px] text-text-muted">{item.totalDeals} negócio(s)</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ROI / Health Analysis */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-soft">
          <h2 className="text-sm font-bold font-display text-text-main flex items-center gap-2 border-b border-border pb-3">
            <Zap className="size-4 text-brand-500" />
            Rentabilidade e Consumo por Conta
          </h2>

          {roi.length === 0 ? (
            <p className="py-8 text-center text-xs text-text-muted">Sem dados de consumo vinculados.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {roi.slice(0, 10).map((r, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-text-main truncate">{r.contactName || "Cliente"}</p>
                    <p className="text-[10px] text-text-muted">Custo API: ${r.cost?.toFixed(2) || "0.00"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      (r.margin || 0) >= 0
                        ? "bg-label-emerald-bg text-label-emerald"
                        : "bg-label-crimson-bg text-label-crimson"
                    }`}>
                      Margem: {r.margin?.toFixed(1) || 0}%
                    </span>
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
