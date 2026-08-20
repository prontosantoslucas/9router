"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft, Mail, Phone, Building2, Plus, Key, Loader2,
  Pencil, Clock, TrendingUp, Briefcase, Trophy, RefreshCw,
  FileText, StickyNote, GitBranch, MailOpen, MessageSquare,
  Sparkles, ExternalLink, Calendar, Send, Trash2
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CONTACT_STATUSES, DEAL_STAGES, PRIORITIES,
  statusMeta, stageMeta, priorityMeta, tagMeta, initials, avatarColor,
  formatCurrency, formatDate, timeAgo, formatWhatsAppUrl
} from "../../crmMeta";

export default function ContactDetailPage({ params }) {
  const router = useRouter();
  const [contact, setContact] = useState(null);
  const [stats, setStats] = useState(null);
  const [deals, setDeals] = useState([]);
  const [activities, setActivities] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [usageData, setUsageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDealForm, setShowDealForm] = useState(false);
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [quickNote, setQuickNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchContact();
    fetchDeals();
    fetchActivities();
    fetchApiKeys();
    fetchUsage();
  }, []);

  function notify(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function fetchContact() {
    try {
      const id = (await params).id;
      const res = await fetch(`/api/crm/contacts/${id}`);
      const data = await res.json();
      setContact(data.contact);
      setStats(data.stats);
    } catch (error) {
      console.error("Erro ao buscar contato:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchDeals() {
    try {
      const id = (await params).id;
      const res = await fetch(`/api/crm/deals?contactId=${id}`);
      const data = await res.json();
      setDeals(data.deals || []);
    } catch (error) {
      console.error("Erro ao buscar deals:", error);
    }
  }

  async function fetchActivities() {
    try {
      const id = (await params).id;
      const res = await fetch(`/api/crm/activities?contactId=${id}&limit=30`);
      const data = await res.json();
      setActivities(data.activities || []);
    } catch (error) {
      console.error("Erro ao buscar atividades:", error);
    }
  }

  async function fetchApiKeys() {
    try {
      const id = (await params).id;
      const res = await fetch(`/api/crm/contacts/${id}/apikeys`);
      const data = await res.json();
      setApiKeys(data.apiKeys || []);
    } catch (error) {
      console.error("Erro ao buscar API keys:", error);
    }
  }

  async function fetchUsage() {
    try {
      const id = (await params).id;
      const res = await fetch(`/api/crm/contacts/${id}/usage?days=30`);
      const data = await res.json();
      setUsageData(data);
    } catch (error) {
      console.error("Erro ao buscar usage:", error);
    }
  }

  async function handleCreateDeal(formData) {
    try {
      const id = (await params).id;
      const res = await fetch("/api/crm/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, contactId: id }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowDealForm(false);
        fetchDeals();
        fetchActivities();
        notify("✓ Negócio vinculado com sucesso!");
      } else {
        notify(data.error || "Erro ao criar negócio");
      }
    } catch (error) {
      notify("Erro ao criar negócio");
    }
  }

  async function handleLinkKey(formData) {
    try {
      const id = (await params).id;
      const res = await fetch(`/api/crm/contacts/${id}/apikeys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowKeyForm(false);
        fetchApiKeys();
        fetchContact();
        notify("✓ API key vinculada!");
      }
    } catch (error) {
      notify("Erro ao vincular key");
    }
  }

  async function handleEditContact(formData) {
    try {
      const id = (await params).id;
      const res = await fetch(`/api/crm/contacts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        setShowEditForm(false);
        setContact(data.contact);
        notify("✓ Contato atualizado!");
      } else {
        notify(data.error || "Erro ao atualizar");
      }
    } catch (error) {
      notify("Erro ao atualizar contato");
    }
  }

  async function handleAddQuickNote() {
    if (!quickNote.trim()) return;
    setSavingNote(true);
    try {
      const id = (await params).id;
      // Adiciona como atividade
      await fetch("/api/crm/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: id,
          type: "note_added",
          description: quickNote.trim(),
        }),
      });
      setQuickNote("");
      fetchActivities();
      notify("✓ Nota registrada na linha do tempo!");
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

  if (!contact) {
    return (
      <div className="p-8 text-center text-text-muted">
        <p>Contato não encontrado.</p>
        <Link href="/dashboard/crm/contacts" className="text-xs text-brand-400 underline mt-2 block">
          Voltar para a lista
        </Link>
      </div>
    );
  }

  const sm = statusMeta(contact.status);
  const waUrl = formatWhatsAppUrl(contact.phone);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-brand-500/30 bg-surface-2 px-4 py-2.5 text-xs font-semibold text-text-main shadow-elevated animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="size-4 text-brand-500" />
          <span>{toast}</span>
        </div>
      )}

      {/* ── Breadcrumbs & Navigation ── */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <button
          type="button"
          onClick={() => router.push("/dashboard/crm/contacts")}
          className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text-main transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Voltar para Contatos</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEditForm(true)}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-bold text-text-main hover:bg-surface-2 transition-colors"
          >
            <Pencil className="size-3.5 text-brand-500" />
            <span>Editar Perfil</span>
          </button>
        </div>
      </div>

      {/* ── 360° Profile Top Header Card ── */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className={`size-14 rounded-2xl flex items-center justify-center text-lg font-black shrink-0 ${avatarColor(contact.name)}`}>
              {initials(contact.name)}
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-black font-display text-text-main truncate">
                  {contact.name}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${sm.bg} ${sm.text}`}>
                  {sm.label}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                {contact.company && (
                  <span className="flex items-center gap-1.5 font-medium text-text-main">
                    <Building2 className="size-3.5 text-brand-500" /> {contact.company}
                  </span>
                )}
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 hover:text-brand-400 transition-colors">
                    <Mail className="size-3.5" /> {contact.email}
                  </a>
                )}
                {contact.phone && (
                  <span className="flex items-center gap-1.5 font-mono">
                    <Phone className="size-3.5" /> {contact.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Communication Actions */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3.5 py-2 text-xs font-bold hover:bg-emerald-500/20 transition-all shadow-soft"
              >
                <MessageSquare className="size-4" />
                <span>Conversar no WhatsApp</span>
              </a>
            )}

            <button
              type="button"
              onClick={() => setShowDealForm(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-3.5 py-2 text-xs font-bold text-white shadow-soft hover:opacity-90 transition-opacity"
            >
              <Plus className="size-4" />
              <span>Novo Negócio</span>
            </button>
          </div>
        </div>

        {/* Tags */}
        {contact.tags && contact.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/50">
            {contact.tags.map((tag) => {
              const tm = tagMeta(tag);
              return (
                <span key={tag} className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${tm.bg} ${tm.text}`}>
                  #{tag}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Campos Personalizados ── */}
      {Object.keys(contact.customFields || {}).length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold font-display text-text-main flex items-center gap-2">
              <FileText className="size-4 text-brand-500" />
              Campos Personalizados
            </h2>
            <button
              type="button"
              onClick={() => setShowEditForm(true)}
              className="flex items-center gap-1 text-[11px] font-bold text-brand-400 hover:text-brand-300 transition-colors"
            >
              <Pencil className="size-3" /> Editar
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {Object.entries(contact.customFields).map(([key, value]) => (
              <div key={key} className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 space-y-0.5">
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{key}</div>
                <div className="text-xs font-semibold text-text-main break-words">{String(value) || "—"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── KPI Stats Summary ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-border bg-surface p-3.5 space-y-1 shadow-soft">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-text-muted">
            <Briefcase className="size-3.5 text-brand-500" />
            <span>Negócios Ativos</span>
          </div>
          <div className="text-lg font-black font-display text-text-main">
            {deals.length}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-3.5 space-y-1 shadow-soft">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-text-muted">
            <TrendingUp className="size-3.5 text-blue-400" />
            <span>Valor em Pipeline</span>
          </div>
          <div className="text-lg font-black font-display text-text-main">
            {formatCurrency(stats?.dealsValue || 0)}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-3.5 space-y-1 shadow-soft">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-text-muted">
            <Trophy className="size-3.5 text-emerald-400" />
            <span>Ganhos / Receita</span>
          </div>
          <div className="text-lg font-black font-display text-emerald-400">
            {stats?.wonDeals || 0}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-3.5 space-y-1 shadow-soft">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-text-muted">
            <Key className="size-3.5 text-purple-400" />
            <span>API Keys Vinculadas</span>
          </div>
          <div className="text-lg font-black font-display text-text-main">
            {apiKeys.length}
          </div>
        </div>
      </div>

      {/* ── Tab Switcher ── */}
      <div className="flex items-center gap-2 border-b border-border">
        {[
          { id: "overview", label: "Visão Geral & Negócios" },
          { id: "timeline", label: `Linha do Tempo (${activities.length})` },
          { id: "keys", label: `API Keys (${apiKeys.length})` },
          { id: "usage", label: "Consumo de API" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
              activeTab === tab.id
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-text-muted hover:text-text-main"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Main Tab Contents ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left main area (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {activeTab === "overview" && (
            <>
              {/* Linked Deals */}
              <div className="rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-soft">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h2 className="text-sm font-bold font-display text-text-main flex items-center gap-2">
                    <Briefcase className="size-4 text-brand-500" />
                    Negócios & Contratos Vinculados
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowDealForm(true)}
                    className="flex items-center gap-1 text-xs font-bold text-brand-400 hover:text-brand-300"
                  >
                    <Plus className="size-3" /> Adicionar
                  </button>
                </div>

                {deals.length === 0 ? (
                  <p className="py-8 text-center text-xs text-text-muted">
                    Nenhum negócio cadastrado para este contato.
                  </p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {deals.map((deal) => {
                      const smMeta = stageMeta(deal.stage);
                      const pmMeta = priorityMeta(deal.priority);

                      return (
                        <div key={deal.id} className="py-3 flex items-center justify-between gap-3 group">
                          <div className="min-w-0">
                            <h3 className="text-xs font-bold text-text-main group-hover:text-brand-400 transition-colors truncate">
                              {deal.title}
                            </h3>
                            <p className="text-[11px] text-text-muted font-mono">
                              Criado em {formatDate(deal.createdAt)} • {pmMeta.label}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs font-bold font-mono text-text-main">
                              {formatCurrency(deal.valueCents, deal.currency)}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${smMeta.bg} ${smMeta.text}`}>
                              {smMeta.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Notes */}
              {contact.notes && (
                <div className="rounded-2xl border border-border bg-surface p-5 space-y-2 shadow-soft">
                  <h3 className="text-xs font-bold text-text-main flex items-center gap-1.5">
                    <StickyNote className="size-3.5 text-brand-500" /> Notas & Histórico
                  </h3>
                  <p className="whitespace-pre-wrap text-xs text-text-muted leading-relaxed">
                    {contact.notes}
                  </p>
                </div>
              )}
            </>
          )}

          {activeTab === "timeline" && (
            <div className="rounded-2xl border border-border bg-surface p-5 space-y-5 shadow-soft">
              <h2 className="text-sm font-bold font-display text-text-main flex items-center gap-2 border-b border-border pb-3">
                <Clock className="size-4 text-brand-500" />
                Linha do Tempo de Atividades
              </h2>

              {/* Quick Note Input */}
              <div className="space-y-2 bg-surface-2 p-3 rounded-xl border border-border">
                <textarea
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  placeholder="Escreva uma nota ou resumo de ligação/reunião com o cliente..."
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

              {/* Activity Items */}
              {activities.length === 0 ? (
                <p className="py-8 text-center text-xs text-text-muted">
                  Nenhuma atividade registrada na linha do tempo.
                </p>
              ) : (
                <div className="relative space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-border">
                  {activities.map((act) => (
                    <div key={act.id} className="relative flex items-start gap-3 pl-1">
                      <span className="size-6 rounded-full bg-brand-500/10 text-brand-500 border border-brand-500/20 flex items-center justify-center shrink-0 z-10">
                        <Sparkles className="size-3" />
                      </span>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-text-main">{act.type.replace(/_/g, " ")}</span>
                          <span className="text-[10px] font-mono text-text-muted">{timeAgo(act.createdAt)}</span>
                        </div>
                        {act.description && (
                          <p className="text-xs text-text-muted leading-relaxed whitespace-pre-wrap">
                            {act.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "keys" && (
            <div className="rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-soft">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-sm font-bold font-display text-text-main flex items-center gap-2">
                  <Key className="size-4 text-brand-500" />
                  API Keys Vinculadas
                </h2>
                <button
                  type="button"
                  onClick={() => setShowKeyForm(true)}
                  className="flex items-center gap-1 text-xs font-bold text-brand-400 hover:text-brand-300"
                >
                  <Plus className="size-3" /> Vincular Key
                </button>
              </div>

              {apiKeys.length === 0 ? (
                <p className="py-8 text-center text-xs text-text-muted">Nenhuma API key vinculada.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {apiKeys.map((key) => (
                    <div key={key.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-text-main">{key.name || "API Key"}</p>
                        <code className="text-[10px] font-mono text-text-muted">{String(key.key).substring(0, 16)}…</code>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${key.isActive ? "bg-label-emerald-bg text-label-emerald" : "bg-label-crimson-bg text-label-crimson"}`}>
                          {key.isActive ? "Ativa" : "Inativa"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "usage" && (
            <div className="rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-soft">
              <h2 className="text-sm font-bold font-display text-text-main border-b border-border pb-3">
                Consumo de API (Últimos 30 dias)
              </h2>

              {!usageData ? (
                <p className="py-8 text-center text-xs text-text-muted">Sem dados de consumo.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-surface-2 rounded-xl border border-border">
                    <p className="text-[10px] text-text-muted">Requisições</p>
                    <p className="text-base font-bold font-mono text-text-main">
                      {(usageData.totals?.totalRequests || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-surface-2 rounded-xl border border-border">
                    <p className="text-[10px] text-text-muted">Custo Total</p>
                    <p className="text-base font-bold font-mono text-emerald-400">
                      ${(usageData.totals?.totalCost || 0).toFixed(4)}
                    </p>
                  </div>
                  <div className="p-3 bg-surface-2 rounded-xl border border-border">
                    <p className="text-[10px] text-text-muted">Prompt Tokens</p>
                    <p className="text-base font-bold font-mono text-text-main">
                      {(usageData.totals?.totalPromptTokens || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-surface-2 rounded-xl border border-border">
                    <p className="text-[10px] text-text-muted">Completion Tokens</p>
                    <p className="text-base font-bold font-mono text-text-main">
                      {(usageData.totals?.totalCompletionTokens || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Details Sidebar (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-5 space-y-3.5 shadow-soft">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted border-b border-border pb-2">
              Metadados do Cliente
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Status do Lead:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sm.bg} ${sm.text}`}>
                  {sm.label}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-text-muted">Origem / Canal:</span>
                <span className="font-semibold text-text-main">
                  {contact.source === "prospector" ? "Prospecção 24/7" : contact.source || "Manual"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-text-muted">Cadastrado em:</span>
                <span className="font-mono text-text-main">{formatDate(contact.createdAt)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-text-muted">Última alteração:</span>
                <span className="font-mono text-text-main">{timeAgo(contact.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Forms */}
      {showDealForm && (
        <SimpleDealModal
          contactId={contact.id}
          onSave={handleCreateDeal}
          onCancel={() => setShowDealForm(false)}
        />
      )}

      {showEditForm && (
        <EditContactModal
          contact={contact}
          onSave={handleEditContact}
          onCancel={() => setShowEditForm(false)}
        />
      )}
    </div>
  );
}

function SimpleDealModal({ contactId, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    title: "",
    valueCents: 50000,
    currency: "BRL",
    stage: "lead",
    priority: "medium",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

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
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-sm font-bold text-text-main">Novo Negócio</h2>
          <button type="button" onClick={onCancel} className="text-xs text-text-muted hover:text-text-main">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-muted">Título do Negócio *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex.: Contrato Anual de IA"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-muted">Valor</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.valueCents / 100}
                onChange={(e) => setFormData({ ...formData, valueCents: Math.round((parseFloat(e.target.value) || 0) * 100) })}
                className={inputCls}
              />
            </div>
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
          </div>

          <div className="flex gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onCancel} className="flex-1 h-9 rounded-xl border border-border bg-surface text-xs font-bold text-text-main">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 h-9 rounded-xl bg-brand-500 text-xs font-bold text-white">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditContactModal({ contact, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: contact.name || "",
    email: contact.email || "",
    phone: contact.phone || "",
    company: contact.company || "",
    status: contact.status || "lead",
    notes: contact.notes || "",
    tags: contact.tags || [],
  });
  const [customFields, setCustomFields] = useState(
    Object.entries(contact.customFields || {}).map(([key, value]) => ({ key, value }))
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const cf = {};
    customFields.forEach(({ key, value }) => {
      if (key.trim()) cf[key.trim()] = value;
    });
    await onSave({ ...formData, customFields: cf });
    setSaving(false);
  }

  function updateField(index, field, val) {
    setCustomFields((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: val } : row)));
  }

  const inputCls =
    "h-9 w-full rounded-xl border border-border bg-surface-2 px-3 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-sm font-bold text-text-main">Editar Contato</h2>
          <button type="button" onClick={onCancel} className="text-xs text-text-muted hover:text-text-main">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-muted">Nome *</label>
            <input required type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputCls} />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-muted">Email</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-muted">WhatsApp / Telefone</label>
              <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-muted">Empresa</label>
              <input type="text" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-muted">Status</label>
              <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className={inputCls}>
                {CONTACT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-muted">Notas</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} className="w-full rounded-xl border border-border bg-surface-2 p-2.5 text-xs text-text-main" />
          </div>

          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-text-muted">Campos Personalizados</label>
              <button
                type="button"
                onClick={() => setCustomFields((prev) => [...prev, { key: "", value: "" }])}
                className="flex items-center gap-1 text-[11px] font-bold text-brand-400 hover:text-brand-300 transition-colors"
              >
                <Plus className="size-3" /> Adicionar campo
              </button>
            </div>

            {customFields.length === 0 && (
              <p className="text-[11px] text-text-muted/70 py-1.5">
                Nenhum campo personalizado. Adicione dados extras como CPF, segmento, tamanho da empresa...
              </p>
            )}

            <div className="space-y-2">
              {customFields.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={row.key}
                    onChange={(e) => updateField(i, "key", e.target.value)}
                    placeholder="Nome do campo (ex.: CPF)"
                    className={`${inputCls} flex-1`}
                  />
                  <input
                    type="text"
                    value={row.value}
                    onChange={(e) => updateField(i, "value", e.target.value)}
                    placeholder="Valor"
                    className={`${inputCls} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => setCustomFields((prev) => prev.filter((_, idx) => idx !== i))}
                    className="rounded-lg p-1.5 text-text-muted hover:text-label-crimson hover:bg-label-crimson-bg transition-colors"
                    title="Remover campo"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onCancel} className="flex-1 h-9 rounded-xl border border-border bg-surface text-xs font-bold text-text-main">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 h-9 rounded-xl bg-brand-500 text-xs font-bold text-white">
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
