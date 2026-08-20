"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, CalendarDays, Loader2, Briefcase, TrendingUp
} from "lucide-react";
import {
  DEAL_STAGES, stageMeta, priorityMeta, formatCurrency, formatDate, initials, avatarColor
} from "../crmMeta";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function DealsTimelinePage() {
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState({});
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cursor = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    return d;
  }, [monthOffset]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const res = await fetch("/api/crm/deals?limit=1000");
      const data = await res.json();
      const loadedDeals = data.deals || [];
      setDeals(loadedDeals);

      const contactIds = [...new Set(loadedDeals.map((d) => d.contactId).filter(Boolean))];
      const contactsData = {};
      await Promise.all(
        contactIds.map(async (id) => {
          try {
            const r = await fetch(`/api/crm/contacts/${id}`);
            const d = await r.json();
            if (d.contact) contactsData[id] = d.contact;
          } catch { /* ignore */ }
        })
      );
      setContacts(contactsData);
    } catch (error) {
      console.error("Erro ao buscar negócios:", error);
    } finally {
      setLoading(false);
    }
  }

  const dealsByDay = useMemo(() => {
    const map = {};
    deals.forEach((deal) => {
      if (!deal.expectedCloseAt) return;
      const key = deal.expectedCloseAt.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(deal);
    });
    return map;
  }, [deals]);

  const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
  const monthDeals = deals.filter((d) => d.expectedCloseAt?.startsWith(monthKey));

  const monthValue = monthDeals
    .filter((d) => !["won", "lost", "cancelled"].includes(d.stage))
    .reduce((sum, d) => sum + (d.valueCents || 0), 0);

  // Grid: weeks starting Sunday
  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function dayKey(day) {
    return `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function goToday() {
    setMonthOffset(0);
  }

  return (
    <div className="space-y-5 pb-12">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
            <Link href="/dashboard/crm" className="hover:text-text-main transition-colors">CRM</Link>
            <span>/</span>
            <span className="font-semibold text-brand-400">Calendário de Fechamentos</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black font-display text-text-main tracking-tight flex items-center gap-2.5">
            <CalendarDays className="size-6 text-brand-500" />
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </h1>
          <p className="text-xs text-text-muted">
            <span className="font-semibold text-text-main">{monthDeals.length}</span> negócio(s) com data prevista neste mês •{" "}
            <span className="font-semibold text-brand-400">{formatCurrency(monthValue)}</span> em negociação
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToday}
            disabled={monthOffset === 0}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-bold text-text-main hover:bg-surface-2 transition-colors disabled:opacity-40"
          >
            Hoje
          </button>
          <div className="flex items-center rounded-lg border border-border bg-surface">
            <button
              type="button"
              onClick={() => setMonthOffset((o) => o - 1)}
              className="p-1.5 text-text-muted hover:text-brand-400 transition-colors"
              title="Mês anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-2 text-xs font-bold text-text-main font-mono">
              {String(cursor.getMonth() + 1).padStart(2, "0")}/{cursor.getFullYear()}
            </span>
            <button
              type="button"
              onClick={() => setMonthOffset((o) => o + 1)}
              className="p-1.5 text-text-muted hover:text-brand-400 transition-colors"
              title="Próximo mês"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider mr-1">Etapas:</span>
        {DEAL_STAGES.map((s) => {
          const sm = stageMeta(s.value);
          return (
            <span key={s.value} className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${sm.bg} ${sm.text}`}>
              {sm.label}
            </span>
          );
        })}
      </div>

      {/* ── Calendar Grid ── */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-brand-500" />
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-soft">
          <div className="overflow-x-auto custom-scrollbar">
            <div className="min-w-[560px]">
              <div className="grid grid-cols-7 border-b border-border bg-surface-2">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="px-2 py-2.5 text-center text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    {w}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 auto-rows-fr">
                {cells.map((day, i) => {
                  if (day === null) {
                    return <div key={`empty-${i}`} className="min-h-[110px] border-b border-r border-border/50 bg-surface-2/30" />;
                  }
              const key = dayKey(day);
              const dayDeals = dealsByDay[key] || [];
              const isToday = day === today.getDate() && monthOffset === 0;
              const isPast = key < today.toISOString().slice(0, 10);

              return (
                <div
                  key={key}
                  className={`min-h-[110px] p-1.5 border-b border-r border-border/50 transition-colors ${
                    isToday ? "bg-brand-500/10" : isPast ? "bg-surface-2/30" : ""
                  }`}
                >
                  <div className={`flex items-center justify-between mb-1.5 px-0.5`}>
                    <span
                      className={`flex size-6 items-center justify-center rounded-full text-[11px] font-bold font-mono ${
                        isToday ? "bg-brand-500 text-white shadow-soft" : "text-text-muted"
                      }`}
                    >
                      {day}
                    </span>
                    {dayDeals.length > 0 && (
                      <span className="rounded-full bg-surface-2 border border-border px-1.5 py-0.5 text-[9px] font-bold text-text-muted">
                        {dayDeals.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {dayDeals.slice(0, 3).map((deal) => {
                      const sm = stageMeta(deal.stage);
                      const contact = contacts[deal.contactId];
                      return (
                        <Link
                          key={deal.id}
                          href={`/dashboard/crm/deals/${deal.id}`}
                          title={`${deal.title} — ${formatCurrency(deal.valueCents, deal.currency)}`}
                          className={`block truncate rounded-md px-1.5 py-1 text-[10px] font-bold ${sm.bg} ${sm.text} hover:opacity-80 transition-opacity`}
                        >
                          <span className="flex items-center gap-1 truncate">
                            {contact && (
                              <span className={`size-3 rounded-full flex items-center justify-center text-[6px] font-bold shrink-0 ${avatarColor(contact.name)}`}>
                                {initials(contact.name)}
                              </span>
                            )}
                            <span className="truncate">{deal.title}</span>
                          </span>
                        </Link>
                      );
                    })}
                    {dayDeals.length > 3 && (
                      <div className="px-1.5 text-[9px] font-bold text-text-muted">
                        +{dayDeals.length - 3} mais
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </div>
        </div>
      )}

      {/* ── Month Summary List ── */}
      {monthDeals.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft space-y-3">
          <h2 className="text-xs font-bold font-display text-text-main flex items-center gap-2">
            <TrendingUp className="size-4 text-brand-500" />
            Fechamentos previstos em {MONTHS[cursor.getMonth()]}
          </h2>
          <div className="divide-y divide-border/60">
            {monthDeals
              .slice()
              .sort((a, b) => (a.expectedCloseAt > b.expectedCloseAt ? 1 : -1))
              .map((deal) => {
                const sm = stageMeta(deal.stage);
                const pm = priorityMeta(deal.priority);
                const contact = contacts[deal.contactId];
                return (
                  <div key={deal.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold font-mono ${sm.bg} ${sm.text}`}>
                        {formatDate(deal.expectedCloseAt)}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-text-main truncate">{deal.title}</div>
                        {contact && (
                          <div className="text-[10px] text-text-muted truncate">
                            {contact.name} {contact.company ? `• ${contact.company}` : ""}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`hidden sm:flex px-2 py-0.5 rounded-md text-[10px] font-bold ${pm.bg} ${pm.text}`}>
                        {pm.label}
                      </span>
                      <span className="font-mono font-bold text-text-main text-xs">
                        {formatCurrency(deal.valueCents, deal.currency)}
                      </span>
                    </div>
                  </div>
);
            })}
          </div>
        </div>
      )}
    </div>
  );
}