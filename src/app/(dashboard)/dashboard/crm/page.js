"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users, DollarSign, TrendingUp, Activity, Plus, ArrowRight,
  Sparkles, RefreshCw, MessageSquare, CheckCircle,
  Briefcase, BarChart3, Zap, Layers, ArrowUpRight, ShoppingCart
} from "lucide-react";
import {
  DEAL_STAGES, OPEN_STAGES, CONTACT_STATUSES, formatCurrency, formatDate,
  initials, avatarColor, statusMeta, priorityMeta, stageMeta,
  formatWhatsAppUrl
} from "./crmMeta";

export default function CRMDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [syncingProspector, setSyncingProspector] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  function notify(text) {
    setToastMsg(text);
    setTimeout(() => setToastMsg(null), 3000);
  }

  async function fetchData() {
    try {
      setLoading(true);
      const [contactsRes, dealsRes] = await Promise.all([
        fetch("/api/crm/contacts?limit=50"),
        fetch("/api/crm/deals?limit=100"),
      ]);

      const contactsData = await contactsRes.json();
      const dealsData = await dealsRes.json();

      setContacts(contactsData.contacts || []);
      setDeals(dealsData.deals || []);
    } catch (error) {
      console.error("Erro ao buscar dados do CRM:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleSyncProspector() {
    setSyncingProspector(true);
    try {
      const res = await fetch("/api/agent/prospector/leads?limit=50");
      if (res.ok) {
        const data = await res.json();
        const leads = data.leads || data.items || [];
        let imported = 0;

        for (const lead of leads) {
          if (!lead.name && !lead.establishment) continue;
          try {
            await fetch("/api/crm/contacts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: lead.establishment || lead.name,
                phone: lead.whatsapp || lead.phone || null,
                company: lead.niche || lead.category || "Prospecção",
                source: "prospector",
                status: "lead",
                notes: lead.pitch || lead.address || "Lead minerado pela Prospecção 24/7",
                tags: ["Prospecção 24/7", lead.niche].filter(Boolean),
              }),
            });
            imported++;
          } catch (_) {}
        }
        notify(`✓ ${imported} lead(s) da Prospecção 24/7 sincronizados no CRM!`);
        fetchData();
      } else {
        notify("Nenhum novo lead na fila da Prospecção para sincronizar.");
      }
    } catch (err) {
      notify(`Erro na sincronização: ${err.message}`);
    } finally {
      setSyncingProspector(false);
    }
  }

  // Cálculos do Funil e Pipeline
  const openDeals = deals.filter((d) => OPEN_STAGES.includes(d.stage));
  const wonDeals = deals.filter((d) => d.stage === "won");
  const lostDeals = deals.filter((d) => d.stage === "lost");

  const totalOpenValue = openDeals.reduce((sum, d) => sum + (d.valueCents || 0), 0);
  const totalWonValue = wonDeals.reduce((sum, d) => sum + (d.valueCents || 0), 0);
  const winRate = deals.length > 0 ? (wonDeals.length / deals.length) * 100 : 0;

  // Receita Ponderada (Forecast)
  const weightedForecast = openDeals.reduce((acc, deal) => {
    const stage = DEAL_STAGES.find((s) => s.value === deal.stage);
    const prob = stage?.probability || 0.1;
    return acc + (deal.valueCents || 0) * prob;
  }, 0);

  // Mapeamento dos Estágios para o Funil
  const funnelStages = DEAL_STAGES.filter((s) => s.value !== "cancelled").map((stage) => {
    const stageDeals = deals.filter((d) => d.stage === stage.value);
    const count = stageDeals.length;
    const value = stageDeals.reduce((acc, d) => acc + (d.valueCents || 0), 0);
    const percentage = deals.length > 0 ? Math.round((count / deals.length) * 100) : 0;
    return {
      ...stage,
      count,
      value,
      percentage,
    };
  });

  const contactMap = contacts.reduce((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex h-[70vh] w-full flex-col items-center justify-center space-y-4">
        <div className="size-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        <p className="text-xs font-mono text-text-muted">Carregando CRM Command Center…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-brand-500/30 bg-surface-2 px-4 py-2.5 text-xs font-semibold text-text-main shadow-elevated animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="size-4 text-brand-500" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ── Top Header / Command Center ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
            <span className="flex items-center gap-1">
              <Layers className="size-3.5 text-brand-500" /> MaxRouter
            </span>
            <span>/</span>
            <span className="font-semibold text-brand-400">CRM de Vendas</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black font-display text-text-main tracking-tight flex items-center gap-2">
            CRM Command Center
            <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-[10px] font-bold text-brand-400 border border-brand-500/20">
              Plane & mimrai Standard
            </span>
          </h1>
          <p className="text-xs text-text-muted">
            Gestão de leads, funil de conversão, contatos omni-channel e previsão de receita em tempo real.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              fetchData();
            }}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors disabled:opacity-50"
            title="Atualizar dados"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin text-brand-500" : ""}`} />
            <span className="hidden md:inline">Atualizar</span>
          </button>

          <button
            type="button"
            onClick={handleSyncProspector}
            disabled={syncingProspector}
            className="flex items-center gap-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-xs font-bold text-brand-400 hover:bg-brand-500/20 transition-colors disabled:opacity-50"
            title="Sincronizar leads minerados pelo robô 24/7"
          >
            <Zap className={`size-3.5 text-brand-500 ${syncingProspector ? "animate-bounce" : ""}`} />
            <span>{syncingProspector ? "Sincronizando..." : "Sincronizar Prospecção"}</span>
          </button>

          <Link
            href="/dashboard/crm/deals"
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-soft hover:opacity-95 transition-opacity"
          >
            <Plus className="size-3.5" />
            <span>Novo Negócio</span>
          </Link>
        </div>
      </div>

      {/* ── KPI Metrics Cards (Plane Layout) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Pipeline Value */}
        <div className="rounded-xl border border-border bg-surface p-4 space-y-2 relative overflow-hidden group hover:border-brand-500/40 transition-all shadow-soft">
          <div className="flex items-center justify-between text-xs font-semibold text-text-muted">
            <span>Pipeline Ativo</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-label-blue-bg text-label-blue">
              <DollarSign className="size-4" />
            </div>
          </div>
          <div className="text-xl font-black font-display text-text-main">
            {formatCurrency(totalOpenValue)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <span className="font-semibold text-brand-400">{openDeals.length} negócios</span>
            <span>em andamento</span>
          </div>
        </div>

        {/* Won Value */}
        <div className="rounded-xl border border-border bg-surface p-4 space-y-2 relative overflow-hidden group hover:border-emerald-500/40 transition-all shadow-soft">
          <div className="flex items-center justify-between text-xs font-semibold text-text-muted">
            <span>Receita Ganha</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-label-emerald-bg text-label-emerald">
              <CheckCircle className="size-4" />
            </div>
          </div>
          <div className="text-xl font-black font-display text-emerald-400">
            {formatCurrency(totalWonValue)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <span className="font-semibold text-emerald-400">{wonDeals.length} negócios</span>
            <span>fechados</span>
          </div>
        </div>

        {/* Forecast Weighted */}
        <div className="rounded-xl border border-border bg-surface p-4 space-y-2 relative overflow-hidden group hover:border-purple-500/40 transition-all shadow-soft">
          <div className="flex items-center justify-between text-xs font-semibold text-text-muted">
            <span>Previsão Ponderada</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-label-purple-bg text-label-purple">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <div className="text-xl font-black font-display text-text-main">
            {formatCurrency(weightedForecast)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <span>Forecast de fechamento</span>
          </div>
        </div>

        {/* Win Rate */}
        <div className="rounded-xl border border-border bg-surface p-4 space-y-2 relative overflow-hidden group hover:border-orange-500/40 transition-all shadow-soft">
          <div className="flex items-center justify-between text-xs font-semibold text-text-muted">
            <span>Taxa de Conversão</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-label-orange-bg text-label-orange">
              <Activity className="size-4" />
            </div>
          </div>
          <div className="text-xl font-black font-display text-text-main">
            {winRate.toFixed(1)}%
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <span>{wonDeals.length} ganhos vs {lostDeals.length} perdidos</span>
          </div>
        </div>

        {/* Total Contacts */}
        <div className="rounded-xl border border-border bg-surface p-4 space-y-2 relative overflow-hidden group hover:border-cyan-500/40 transition-all shadow-soft sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-xs font-semibold text-text-muted">
            <span>Total Contatos</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-label-cyan-bg text-label-cyan">
              <Users className="size-4" />
            </div>
          </div>
          <div className="text-xl font-black font-display text-text-main">
            {contacts.length}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <span className="text-brand-400 font-semibold">
              {contacts.filter((c) => c.source === "prospector").length} do robô
            </span>
          </div>
        </div>
      </div>

      {/* ── Visual Conversion Funnel (Padrão MakePlane Analytics) ── */}
      <div className="rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold font-display text-text-main flex items-center gap-2">
              <BarChart3 className="size-4 text-brand-500" />
              Funil de Conversão do Pipeline
            </h2>
            <p className="text-xs text-text-muted">
              Distribuição de volume e valores monetários por estágio da jornada comercial.
            </p>
          </div>
          <Link
            href="/dashboard/crm/deals"
            className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1 self-start sm:self-auto"
          >
            Abrir Kanban Interativo <ArrowRight className="size-3" />
          </Link>
        </div>

        {/* Funnel Bars */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
          {funnelStages.slice(0, 5).map((stage, idx) => {
            const meta = stageMeta(stage.value);
            return (
              <div
                key={stage.value}
                className="flex flex-col justify-between p-3.5 rounded-xl border border-border bg-surface-2 hover:border-brand-500/30 transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${meta.bg} ${meta.text}`}>
                    {stage.label}
                  </span>
                  <span className="text-[10px] font-mono text-text-muted">#{idx + 1}</span>
                </div>

                <div>
                  <div className="text-base font-bold font-display text-text-main">
                    {formatCurrency(stage.value)}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-text-muted">
                    <span>{stage.count} negócio(s)</span>
                    <span className="font-semibold">{stage.percentage}%</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-surface-3 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(stage.percentage, 6)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main 2-Column: High-Value Deals & Contacts Feed ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: High-Value Deals (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-soft flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold font-display text-text-main flex items-center gap-2">
                <Briefcase className="size-4 text-brand-500" />
                Negócios em Aberto (Prioritários)
              </h2>
              <p className="text-xs text-text-muted">Principais oportunidades em negociação ativa no funil.</p>
            </div>
            <Link
              href="/dashboard/crm/deals"
              className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1"
            >
              Ver todos <ArrowRight className="size-3" />
            </Link>
          </div>

          {openDeals.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="size-10 rounded-full bg-surface-2 flex items-center justify-center mx-auto text-text-muted">
                <Briefcase className="size-5" />
              </div>
              <p className="text-xs font-semibold text-text-main">Nenhum negócio em aberto</p>
              <p className="text-[11px] text-text-muted">Crie novos negócios ou importe da prospecção.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {openDeals.slice(0, 5).map((deal) => {
                const contact = contactMap[deal.contactId];
                const stage = stageMeta(deal.stage);
                const priority = priorityMeta(deal.priority);

                return (
                  <div key={deal.id} className="py-3 flex items-center justify-between gap-3 group hover:bg-surface-2/40 px-2 rounded-lg transition-colors">
                    <div className="min-w-0 flex items-center gap-3">
                      <div className={`size-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(contact?.name || deal.title)}`}>
                        {initials(contact?.name || deal.title)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-text-main truncate group-hover:text-brand-400 transition-colors">
                          {deal.title}
                        </p>
                        <p className="text-[11px] text-text-muted truncate">
                          {contact ? `${contact.name} • ${contact.company || "Empresa"}` : "Sem contato vinculado"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${stage.bg} ${stage.text}`}>
                        {stage.label}
                      </span>
                      <span className="text-xs font-bold font-mono text-text-main">
                        {formatCurrency(deal.valueCents)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-2 border-t border-border">
            <Link
              href="/dashboard/crm/deals"
              className="w-full flex items-center justify-center gap-2 p-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-xs font-bold text-text-main transition-colors"
            >
              <span>Gerenciar Funil de Vendas Completo</span>
              <ArrowUpRight className="size-3.5 text-brand-500" />
            </Link>
          </div>
        </div>

        {/* Right Column: Recent Contacts & WhatsApp Action (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-soft flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold font-display text-text-main flex items-center gap-2">
                <Users className="size-4 text-brand-500" />
                Contatos Recentes & Leads
              </h2>
              <p className="text-xs text-text-muted">Acesso rápido com acionamento 1-clique.</p>
            </div>
            <Link
              href="/dashboard/crm/contacts"
              className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1"
            >
              Diretório <ArrowRight className="size-3" />
            </Link>
          </div>

          {contacts.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="size-10 rounded-full bg-surface-2 flex items-center justify-center mx-auto text-text-muted">
                <Users className="size-5" />
              </div>
              <p className="text-xs font-semibold text-text-main">Nenhum contato cadastrado</p>
              <p className="text-[11px] text-text-muted">Adicione clientes para gerenciar comunicações.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {contacts.slice(0, 5).map((contact) => {
                const status = statusMeta(contact.status);
                const waUrl = formatWhatsAppUrl(contact.phone);

                return (
                  <div key={contact.id} className="py-2.5 flex items-center justify-between gap-2 group hover:bg-surface-2/40 px-2 rounded-lg transition-colors">
                    <Link
                      href={`/dashboard/crm/contacts/${contact.id}`}
                      className="min-w-0 flex items-center gap-2.5 flex-1"
                    >
                      <div className={`size-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(contact.name)}`}>
                        {initials(contact.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-text-main truncate group-hover:text-brand-400 transition-colors">
                          {contact.name}
                        </p>
                        <p className="text-[11px] text-text-muted truncate">
                          {contact.company || contact.email || "Sem empresa"}
                        </p>
                      </div>
                    </Link>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center size-7 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                          title={`Conversar no WhatsApp (${contact.phone})`}
                        >
                          <MessageSquare className="size-3.5" />
                        </a>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${status.bg} ${status.text}`}>
                        {status.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-2 border-t border-border">
            <Link
              href="/dashboard/crm/contacts"
              className="w-full flex items-center justify-center gap-2 p-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-xs font-bold text-text-main transition-colors"
            >
              <span>Ver Todos os Contatos</span>
              <ArrowUpRight className="size-3.5 text-brand-500" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── CRM Navigation Grid (MakePlane Modular Architecture) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
        <Link
          href="/dashboard/crm/deals"
          className="p-4 rounded-xl border border-border bg-surface hover:border-brand-500/40 hover:bg-surface-2 transition-all space-y-2 group shadow-soft"
        >
          <div className="flex size-9 items-center justify-center rounded-xl bg-label-blue-bg text-label-blue group-hover:scale-105 transition-transform">
            <Briefcase className="size-4" />
          </div>
          <h3 className="text-xs font-bold text-text-main group-hover:text-brand-400 transition-colors">
            Pipeline & Kanban
          </h3>
          <p className="text-[11px] text-text-muted leading-relaxed">
            Quadro Kanban e tabela linear para movimentação e negociação de contratos.
          </p>
        </Link>

        <Link
          href="/dashboard/crm/contacts"
          className="p-4 rounded-xl border border-border bg-surface hover:border-brand-500/40 hover:bg-surface-2 transition-all space-y-2 group shadow-soft"
        >
          <div className="flex size-9 items-center justify-center rounded-xl bg-label-purple-bg text-label-purple group-hover:scale-105 transition-transform">
            <Users className="size-4" />
          </div>
          <h3 className="text-xs font-bold text-text-main group-hover:text-brand-400 transition-colors">
            Diretório de Clientes
          </h3>
          <p className="text-[11px] text-text-muted leading-relaxed">
            Perfis de clientes 360°, histórico de atividades, tags e integração com WhatsApp.
          </p>
        </Link>

        <Link
          href="/dashboard/crm/analytics"
          className="p-4 rounded-xl border border-border bg-surface hover:border-brand-500/40 hover:bg-surface-2 transition-all space-y-2 group shadow-soft"
        >
          <div className="flex size-9 items-center justify-center rounded-xl bg-label-orange-bg text-label-orange group-hover:scale-105 transition-transform">
            <BarChart3 className="size-4" />
          </div>
          <h3 className="text-xs font-bold text-text-main group-hover:text-brand-400 transition-colors">
            Analytics & Relatórios
          </h3>
          <p className="text-[11px] text-text-muted leading-relaxed">
            Métricas de taxa de ganho, tendências de vendas e ticket médio consolidado.
          </p>
        </Link>

        <Link
          href="/dashboard/crm/billing"
          className="p-4 rounded-xl border border-border bg-surface hover:border-brand-500/40 hover:bg-surface-2 transition-all space-y-2 group shadow-soft"
        >
          <div className="flex size-9 items-center justify-center rounded-xl bg-label-emerald-bg text-label-emerald group-hover:scale-105 transition-transform">
            <DollarSign className="size-4" />
          </div>
          <h3 className="text-xs font-bold text-text-main group-hover:text-brand-400 transition-colors">
            Faturamento & Checkout
          </h3>
          <p className="text-[11px] text-text-muted leading-relaxed">
            Cobranças diretas, faturas, créditos da API e histórico de transações.
          </p>
        </Link>
      </div>
    </div>
  );
}