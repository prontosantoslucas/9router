"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Pencil, Briefcase, Calendar, Clock, Sparkles, Loader2,
  Building2, User, TrendingUp, Trophy, StickyNote, Send, X, Flag,
  CircleDollarSign, Hourglass, ThumbsDown, RotateCcw
} from "lucide-react";
import {
  DEAL_STAGES, PRIORITIES, CONTACT_STATUSES,
  stageMeta, priorityMeta, sourceMeta, statusMeta,
  initials, avatarColor, formatCurrency, formatDate, timeAgo
} from "../../crmMeta";

export default function DealDetailPage({ params }) {
  const router = useRouter();
  const [deal, setDeal] = useState(null);
  const [contact, setContact] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [showEditForm, setShowEditForm] = useState(false);
  const [quickNote, setQuickNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchDeal();
  }, []);

  function notify(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function fetchDeal() {
    try {
      setLoading(true);
      const id = (await params).id;
      const res = await fetch(`/api/crm/deals/${id}`);
      const data = await res.json();
      if (data.deal) {
        setDeal(data.deal);
        if (data.deal.contactId) {
          const cr = await fetch(`/api/crm/contacts/${data.deal.contactId}`);
          const cd = await cr.json();
          if (cd.contact) setContact(cd.contact);
        }
        await fetchActivities(id);
      }
    } catch (error) {
      console.error("Erro ao buscar negócio:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchActivities(dealId) {
    try {
      const res = await fetch(`/api/crm/activities?dealId=${dealId}&limit=100`);
      const data = await res.json();
      setActivities(data.activities || []);
    } catch (error) {
      console.error("Erro ao buscar atividades:", error);
    }
  }

  async function handleUpdateDeal(formData) {
    try {
      const id = (await params).id;
      const res = await fetch(`/api/crm/deals/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        setShowEditForm(false);
        setDeal(data.deal);
        if (data.deal.contactId) {
          const cr = await fetch(`/api/crm/contacts/${data.deal.contactId}`);
          const cd = await cr.json();
          if (cd.contact) setContact(cd.contact);
        }
        fetchActivities(id);
        notify("✓ Negócio atualizado!");
      } else {
        notify(data.error || "Erro ao atualizar negócio");
      }
    } catch (error) {
      notify("Erro ao atualizar negócio");
    }
  }

  async function handleSetOutcome(outcome) {
    const closedStages = ["won", "lost", "cancelled"];
    const isClosing = closedStages.includes(outcome);
    try {
      const id = (await params).id;
      const res = await fetch(`/api/crm/deals/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: outcome,
          closedAt: isClosing ? new Date().toISOString() : null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setDeal(data.deal);
        fetchActivities(id);
        notify(
          isClosing
            ? `✓ Negócio marcado como ${stageMeta(outcome).label}!`
            : "✓ Negócio reaberto!"
        );
      } else {
        notify(data.error || "Erro ao atualizar negócio");
      }
    } catch (error) {
      notify("Erro ao atualizar negócio");
    }
  }

  async function handleAddQuickNote() {
    if (!quickNote.trim() || !deal) return;
    setSavingNote(true);
    try {
      const res = await fetch("/api/crm/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: deal.contactId,
          dealId: deal.id,
          type: "note_added",
          description: quickNote.trim(),
        }),
      });
      if (res.ok) {
        setQuickNote("");
        fetchActivities(deal.id);
        notify("✓ Nota registrada na linha do tempo!");
      }
    } catch (err) {
      notify("Erro ao salvar nota");
    } finally {
      setSavingNote(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="p-8 text-center text-text-muted">
        <p>Negócio não encontrado.</p>
        <Link href="/dashboard/crm/deals" className="text-xs text-brand-400 underline mt-2 block">
          Voltar para o Pipeline
        </Link>
      </div>
    );
  }

  const sm = stageMeta(deal.stage);
  const pm = priorityMeta(deal.priority);
  const scm = sourceMeta(deal.source);

  const closeDate = deal.expectedCloseAt ? new Date(deal.expectedCloseAt + "T00:00:00") : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isClosed = ["won", "lost", "cancelled"].includes(deal.stage);
  let closeInfo = null;
  if (closeDate) {
    const daysDiff = Math.round((closeDate - today) / 86400000);
    if (daysDiff < 0 && !isClosed) {
      closeInfo = { label: `Atrasado há ${Math.abs(daysDiff)} dia(s)`, tone: "crimson" };
    } else if (daysDiff === 0 && !isClosed) {
      closeInfo = { label: "Vence hoje!", tone: "orange" };
    } else if (!isClosed) {
      closeInfo = { label: `Em ${daysDiff} dia(s)`, tone: "blue" };
    }
  }

  const dealAge = Math.max(1, Math.round((Date.now() - new Date(deal.createdAt).getTime()) / 86400000));

  return (
    <div className="space-y-6 pb-12">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-brand-500/30 bg-surface-2 px-4 py-2.5 text-xs font-semibold text-text-main shadow-elevated animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="size-4 text-brand-500" />
          <span>{toast}</span>
        </div>
      )}

      {/* ── Breadcrumbs & Navigation ── */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard/crm/deals")}
            className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text-main transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Voltar ao Pipeline</span>
          </button>
          <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
            <Link href="/dashboard/crm" className="hover:text-text-main transition-colors">CRM</Link>
            <span>/</span>
            <Link href="/dashboard/crm/deals" className="hover:text-text-main transition-colors">Pipeline</Link>
            <span>/</span>
            <span className="font-semibold text-brand-400 truncate max-w-[180px]">{deal.title}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isClosed ? (
            <>
              <button
                type="button"
                onClick={() => handleSetOutcome("won")}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 text-xs font-bold hover:bg-emerald-500/20 transition-colors"
              >
                <Trophy className="size-3.5" />
                <span>Marcar Ganho</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetOutcome("lost")}
                className="flex items-center gap-1.5 rounded-xl bg-label-crimson-bg text-label-crimson border border-label-crimson/20 px-3 py-1.5 text-xs font-bold hover:opacity-80 transition-opacity"
              >
                <ThumbsDown className="size-3.5" />
                <span>Marcar Perdido</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => handleSetOutcome("lead")}
              className="flex items-center gap-1.5 rounded-xl border border-brand-500/30 bg-brand-500/10 text-brand-400 px-3 py-1.5 text-xs font-bold hover:bg-brand-500/20 transition-colors"
            >
              <RotateCcw className="size-3.5" />
              <span>Reabrir Negócio</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowEditForm(true)}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-bold text-text-main hover:bg-surface-2 transition-colors"
          >
            <Pencil className="size-3.5 text-brand-500" />
            <span>Editar Negócio</span>
          </button>
        </div>
      </div>

      {/* ── 360° Deal Header Card ── */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black font-display text-text-main truncate">
                {deal.title}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${sm.bg} ${sm.text}`}>
                {sm.label}
              </span>
              <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${pm.bg} ${pm.text}`}>
                {pm.label}
              </span>
              {deal.source && (
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-surface-2 border border-border text-text-muted">
                  {scm?.label || deal.source}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
              <span className="flex items-center gap-1.5 font-mono font-bold text-text-main text-lg">
                <CircleDollarSign className="size-4 text-brand-500" />
                {formatCurrency(deal.valueCents, deal.currency)}
              </span>
              {closeDate && (
                <span className={`flex items-center gap-1.5 font-medium ${
                  closeInfo?.tone === "crimson" ? "text-label-crimson" :
                  closeInfo?.tone === "orange" ? "text-label-orange" : "text-label-blue"
                }`}>
                  <Calendar className="size-3.5" />
                  {formatDate(deal.expectedCloseAt)}
                  {closeInfo && <span className="font-bold">• {closeInfo.label}</span>}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                Criado {timeAgo(deal.createdAt)}
              </span>
            </div>
          </div>

          {contact && (
            <Link
              href={`/dashboard/crm/contacts/${contact.id}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 hover:border-brand-500/40 transition-colors shrink-0"
            >
              <span className={`size-10 rounded-xl flex items-center justify-center text-xs font-black ${avatarColor(contact.name)}`}>
                {initials(contact.name)}
              </span>
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-text-main flex items-center gap-1.5">
                  <User className="size-3 text-brand-500" />
                  {contact.name}
                </div>
                <div className="text-[10px] text-text-muted flex items-center gap-1.5">
                  {contact.company ? (
                    <>
                      <Building2 className="size-3" />
                      {contact.company}
                    </>
                  ) : (
                    <span>Contato vinculado</span>
                  )}
                </div>
              </div>
            </Link>
          )}
        </div>

        {deal.notes && (
          <div className="rounded-xl bg-surface-2 border border-border p-3.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-text-muted">
              <StickyNote className="size-3.5 text-brand-500" />
              Notas & Observações
            </div>
            <p className="whitespace-pre-wrap text-xs text-text-main leading-relaxed">
              {deal.notes}
            </p>
          </div>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-border bg-surface p-3.5 space-y-1 shadow-soft">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-text-muted">
            <TrendingUp className="size-3.5 text-brand-500" />
            <span>Valor do Negócio</span>
          </div>
          <div className="text-lg font-black font-display text-text-main">
            {formatCurrency(deal.valueCents, deal.currency)}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-3.5 space-y-1 shadow-soft">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-text-muted">
            <Hourglass className="size-3.5 text-label-blue" />
            <span>Fechamento Previsto</span>
          </div>
          <div className="text-lg font-black font-display text-text-main">
            {closeDate ? (
              closeInfo?.tone === "crimson" ? (
                <span className="text-label-crimson">{closeInfo.label}</span>
              ) : closeInfo?.tone === "orange" ? (
                <span className="text-label-orange">{closeInfo.label}</span>
              ) : (
                closeInfo?.label
              )
            ) : (
              <span className="text-text-muted text-sm font-semibold">Sem data</span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-3.5 space-y-1 shadow-soft">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-text-muted">
            <Clock className="size-3.5 text-label-purple" />
            <span>Idade do Negócio</span>
          </div>
          <div className="text-lg font-black font-display text-text-main">
            {dealAge} dia(s)
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-3.5 space-y-1 shadow-soft">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-text-muted">
            <Sparkles className="size-3.5 text-emerald-400" />
            <span>Atividades</span>
          </div>
          <div className="text-lg font-black font-display text-text-main">
            {activities.length}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 border-b border-border">
        {[
          { id: "overview", label: "Visão Geral", icon: Briefcase },
          { id: "timeline", label: "Atividades & Histórico", icon: Clock },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-text-muted hover:text-text-main"
            }`}
          >
            <tab.icon className="size-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-5 space-y-3.5 shadow-soft">
            <h3 className="text-xs font-bold text-text-main flex items-center gap-1.5">
              <Briefcase className="size-3.5 text-brand-500" /> Detalhes da Negociação
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 space-y-0.5">
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Estágio</div>
                <div className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${sm.bg}`} /> {sm.label}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 space-y-0.5">
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Prioridade</div>
                <div className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                  <Flag className="size-3" /> {pm.label}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 space-y-0.5">
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Moeda</div>
                <div className="text-xs font-semibold text-text-main">{deal.currency}</div>
              </div>
              <div className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 space-y-0.5">
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Data de Fechamento</div>
                <div className="text-xs font-semibold text-text-main">
                  {deal.expectedCloseAt ? formatDate(deal.expectedCloseAt) : "—"}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 space-y-0.5">
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Fonte</div>
                <div className="text-xs font-semibold text-text-main">{scm?.label || deal.source || "—"}</div>
              </div>
              <div className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 space-y-0.5">
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Criado em</div>
                <div className="text-xs font-semibold text-text-main">{formatDate(deal.createdAt)}</div>
              </div>
            </div>
          </div>

          {contact && (
            <div className="rounded-2xl border border-border bg-surface p-5 space-y-3.5 shadow-soft">
              <h3 className="text-xs font-bold text-text-main flex items-center gap-1.5">
                <User className="size-3.5 text-brand-500" /> Contato Vinculado
              </h3>
              <Link
                href={`/dashboard/crm/contacts/${contact.id}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3.5 hover:border-brand-500/40 transition-colors"
              >
                <span className={`size-9 rounded-xl flex items-center justify-center text-xs font-black ${avatarColor(contact.name)}`}>
                  {initials(contact.name)}
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="text-xs font-bold text-text-main">{contact.name}</div>
                  <div className="text-[10px] text-text-muted truncate">
                    {contact.email || contact.phone || contact.company || "Sem dados de contato"}
                  </div>
                </div>
                <span className="text-[10px] font-bold text-brand-400">Ver perfil →</span>
              </Link>
            </div>
          )}
        </div>
      )}

      {activeTab === "timeline" && (
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-5 shadow-soft">
          <h2 className="text-sm font-bold font-display text-text-main flex items-center gap-2 border-b border-border pb-3">
            <Clock className="size-4 text-brand-500" />
            Histórico do Negócio
          </h2>

          <div className="space-y-2 bg-surface-2 p-3 rounded-xl border border-border">
            <textarea
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
              placeholder="Escreva uma nota sobre esta negociação (ligação, reunião, proposta...)"
              rows={2}
              className="w-full bg-transparent text-xs text-text-main placeholder:text-text-muted focus:outline-none resize-none"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddQuickNote}
                disabled={savingNote || !quickNote.trim()}
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-brand-500 text-white font-bold text-xs hover:bg-brand-600 disabled:opacity-40 transition-colors"
              >
                <Send className="size-3" />
                <span>Registrar</span>
              </button>
            </div>
          </div>

          {activities.length === 0 ? (
            <p className="py-8 text-center text-xs text-text-muted">
              Nenhuma atividade registrada. Crie, mova ou edite o negócio para gerar histórico.
            </p>
          ) : (
            <div className="relative space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-border">
              {activities.map((act) => {
                const tone =
                  act.type === "deal_created" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                  act.type === "stage_changed" ? "text-brand-500 bg-brand-500/10 border-brand-500/20" :
                  act.type === "note_added" ? "text-label-yellow bg-label-yellow-bg border-label-yellow/30" :
                  "text-label-purple bg-label-purple-bg border-label-purple/30";
                return (
                  <div key={act.id} className="relative flex items-start gap-3 pl-1">
                    <span className={`size-6 rounded-full border flex items-center justify-center shrink-0 z-10 ${tone}`}>
                      <Sparkles className="size-3" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-text-main capitalize">{act.type.replace(/_/g, " ")}</span>
                        <span className="text-[10px] font-mono text-text-muted">{timeAgo(act.createdAt)}</span>
                      </div>
                      {act.description && (
                        <p className="text-xs text-text-muted leading-relaxed whitespace-pre-wrap">
                          {act.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Editar Negócio ── */}
      {showEditForm && (
        <EditDealModal
          deal={deal}
          onSave={handleUpdateDeal}
          onCancel={() => setShowEditForm(false)}
        />
      )}
    </div>
  );
}

function EditDealModal({ deal, onSave, onCancel }) {
  const [contacts, setContacts] = useState([]);
  const [formData, setFormData] = useState({
    contactId: deal.contactId || "",
    title: deal.title || "",
    valueCents: deal.valueCents ?? 0,
    currency: deal.currency || "BRL",
    stage: deal.stage || "lead",
    priority: deal.priority || "none",
    expectedCloseAt: deal.expectedCloseAt || "",
    notes: deal.notes || "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, []);

  async function fetchContacts() {
    try {
      const res = await fetch("/api/crm/contacts?limit=1000");
      const data = await res.json();
      setContacts(data.contacts || []);
    } catch (error) {
      console.error("Erro ao carregar contatos:", error);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await onSave(formData);
    setSaving(false);
  }

  const inputCls =
    "h-9 w-full rounded-xl border border-border bg-surface-2 px-3 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold font-display text-text-main flex items-center gap-2">
              <Briefcase className="size-4 text-brand-500" />
              Editar Negócio
            </h2>
            <p className="text-xs text-text-muted">Atualize os dados desta oportunidade de venda.</p>
          </div>
          <button type="button" onClick={onCancel} className="text-text-muted hover:text-text-main text-xs">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-muted">Contato / Cliente *</label>
            <select
              required
              value={formData.contactId}
              onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
              className={inputCls}
            >
              <option value="">Selecione um contato</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company ? `(${c.company})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-muted">Título do Negócio *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-muted">Valor Total</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.valueCents / 100}
                onChange={(e) =>
                  setFormData({ ...formData, valueCents: Math.round((parseFloat(e.target.value) || 0) * 100) })
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-muted">Moeda</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className={inputCls}
              >
                <option value="BRL">BRL (R$)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-muted">Estágio</label>
              <select
                value={formData.stage}
                onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                className={inputCls}
              >
                {DEAL_STAGES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-muted">Prioridade</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className={inputCls}
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-muted">
              Data de Fechamento Prevista
              <span className="ml-1.5 text-[10px] text-text-muted/70">(usada na visão Calendário)</span>
            </label>
            <input
              type="date"
              value={formData.expectedCloseAt}
              onChange={(e) => setFormData({ ...formData, expectedCloseAt: e.target.value })}
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-muted">Notas & Observações</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Detalhes sobre a negociação, necessidades e prazos..."
              className="w-full rounded-xl border border-border bg-surface-2 p-2.5 text-xs text-text-main placeholder:text-text-muted focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 h-9 rounded-xl border border-border bg-surface hover:bg-surface-2 text-xs font-bold text-text-main transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-9 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-xs font-bold text-white shadow-soft hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              <span>Salvar Alterações</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}