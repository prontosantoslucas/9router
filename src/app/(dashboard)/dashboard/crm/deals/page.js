"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  Plus, Download, Trash2, ArrowRightLeft, Loader2, Briefcase, Flag,
  LayoutGrid, Table, Search, Filter, Sparkles, CheckCircle2, MoreVertical,
  Calendar, Building2, User, ChevronRight, ArrowUpRight, Pencil, X,
  Trophy, ThumbsDown, RotateCcw
} from "lucide-react";
import {
  DEAL_STAGES, PRIORITIES, stageMeta, priorityMeta, sourceMeta,
  initials, avatarColor, formatCurrency, formatDate, timeAgo, formatWhatsAppUrl
} from "../crmMeta";

export default function DealsPipelinePage() {
  const [viewMode, setViewMode] = useState("kanban"); // "kanban" | "table"
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState({});
  const [activeDeal, setActiveDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedStage, setSelectedStage] = useState("lead");
  const [selected, setSelected] = useState(new Set());
  const [moveTarget, setMoveTarget] = useState("");
  const [bulkPriority, setBulkPriority] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [editingDeal, setEditingDeal] = useState(null);
  const [toast, setToast] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  useEffect(() => {
    fetchDeals();
  }, []);

  function notify(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function fetchDeals() {
    try {
      setLoading(true);
      const res = await fetch("/api/crm/deals");
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

  async function handleDragEnd(event) {
    const { active, over } = event;
    setActiveDeal(null);

    if (!over || active.id === over.id) return;

    const dealId = active.id;
    const newStage = over.id;

    try {
      const res = await fetch(`/api/crm/deals/${dealId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });

      if (res.ok) {
        setDeals((prev) =>
          prev.map((deal) => (deal.id === dealId ? { ...deal, stage: newStage } : deal))
        );
        notify(`Estágio alterado para: ${stageMeta(newStage).label}`);
      }
    } catch (error) {
      console.error("Erro ao atualizar estágio do deal:", error);
    }
  }

  function handleDragStart(event) {
    const deal = deals.find((d) => d.id === event.active.id);
    setActiveDeal(deal);
  }

  async function handleCreateDeal(formData) {
    try {
      const res = await fetch("/api/crm/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, stage: selectedStage }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowForm(false);
        fetchDeals();
        notify("✓ Negócio criado com sucesso!");
      } else {
        notify(data.error || "Erro ao criar negócio");
      }
    } catch (error) {
      notify("Erro ao criar negócio");
    }
  }

  async function handleUpdateDeal(formData) {
    if (!editingDeal) return;
    try {
      const res = await fetch(`/api/crm/deals/${editingDeal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        setEditingDeal(null);
        fetchDeals();
        notify("✓ Negócio atualizado com sucesso!");
      } else {
        notify(data.error || "Erro ao atualizar negócio");
      }
    } catch (error) {
      notify("Erro ao atualizar negócio");
    }
  }

  async function handleSetOutcome(deal, outcome) {
    const closedStages = ["won", "lost", "cancelled"];
    const isClosing = closedStages.includes(outcome);
    const wasClosed = closedStages.includes(deal.stage);

    try {
      const res = await fetch(`/api/crm/deals/${deal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: outcome,
          closedAt: isClosing ? new Date().toISOString() : null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        fetchDeals();
        notify(
          isClosing
            ? `✓ Negócio marcado como ${stageMeta(outcome).label}`
            : `✓ Negócio reaberto (${stageMeta(outcome).label})`
        );
      } else {
        notify(data.error || "Erro ao atualizar negócio");
      }
    } catch (error) {
      notify("Erro ao atualizar negócio");
    }
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkMove() {
    if (selected.size === 0 || !moveTarget) return;
    const res = await fetch("/api/crm/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "move-deal", ids: [...selected], stage: moveTarget }),
    });
    if (res.ok) {
      setSelected(new Set());
      setMoveTarget("");
      fetchDeals();
      notify(`Movido para ${stageMeta(moveTarget).label}`);
    }
  }

  async function handleBulkPriority() {
    if (selected.size === 0 || !bulkPriority) return;
    const res = await fetch("/api/crm/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-priority", ids: [...selected], priority: bulkPriority }),
    });
    if (res.ok) {
      setSelected(new Set());
      setBulkPriority("");
      fetchDeals();
      notify(`Prioridade alterada para ${priorityMeta(bulkPriority).label}`);
    }
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Tem certeza que deseja deletar ${selected.size} negócio(s)?`)) return;
    const res = await fetch("/api/crm/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", ids: [...selected], type: "deals" }),
    });
    if (res.ok) {
      setSelected(new Set());
      fetchDeals();
      notify(`${selected.size} negócio(s) excluído(s)`);
    }
  }

  function handleExport() {
    const link = document.createElement("a");
    link.href = "/api/crm/export?type=deals";
    link.click();
    notify("Exportando CSV de negócios…");
  }

  // Filtros em memória
  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      const matchesSearch =
        !searchQuery ||
        deal.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contacts[deal.contactId]?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contacts[deal.contactId]?.company?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesPriority = filterPriority === "all" || deal.priority === filterPriority;

      return matchesSearch && matchesPriority;
    });
  }, [deals, contacts, searchQuery, filterPriority]);

  const dealsByStage = useMemo(() => {
    return DEAL_STAGES.reduce((acc, stage) => {
      acc[stage.value] = filteredDeals.filter((deal) => deal.stage === stage.value);
      return acc;
    }, {});
  }, [filteredDeals]);

  const openValue = filteredDeals
    .filter((d) => !["won", "lost", "cancelled"].includes(d.stage))
    .reduce((sum, d) => sum + (d.valueCents || 0), 0);
  const wonValue = filteredDeals
    .filter((d) => d.stage === "won")
    .reduce((sum, d) => sum + (d.valueCents || 0), 0);

  return (
    <div className="space-y-5 pb-12">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-brand-500/30 bg-surface-2 px-4 py-2.5 text-xs font-semibold text-text-main shadow-elevated animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="size-4 text-brand-500" />
          <span>{toast}</span>
        </div>
      )}

      {/* ── Top Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
            <Link href="/dashboard/crm" className="hover:text-text-main transition-colors">CRM</Link>
            <span>/</span>
            <span className="font-semibold text-brand-400">Pipeline de Vendas</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black font-display text-text-main tracking-tight flex items-center gap-2.5">
            <Briefcase className="size-6 text-brand-500" />
            Pipeline & Funil Comercial
          </h1>
          <p className="text-xs text-text-muted">
            <span className="font-semibold text-text-main">{formatCurrency(openValue)}</span> em negociação ativa •{" "}
            <span className="font-semibold text-emerald-400">{formatCurrency(wonValue)} ganhos</span>
          </p>
        </div>

        {/* View Switcher & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Kanban vs Table */}
          <div className="flex items-center rounded-lg border border-border bg-surface p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                viewMode === "kanban"
                  ? "bg-brand-500 text-white shadow-soft"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              <LayoutGrid className="size-3.5" />
              <span>Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                viewMode === "table"
                  ? "bg-brand-500 text-white shadow-soft"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              <Table className="size-3.5" />
              <span>Tabela</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors"
          >
            <Download className="size-3.5" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedStage("lead");
              setShowForm(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-soft hover:opacity-90 transition-opacity"
          >
            <Plus className="size-3.5" />
            <span>Novo Negócio</span>
          </button>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar por negócio, contato ou empresa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-xs text-text-main placeholder:text-text-muted focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs font-semibold text-text-muted bg-surface border border-border px-2.5 py-1.5 rounded-xl">
            <Filter className="size-3 text-brand-500" />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-transparent text-text-main font-semibold focus:outline-none text-xs"
            >
              <option value="all">Todas as prioridades</option>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Bulk Actions Floating Bar ── */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-500/30 bg-label-blue-bg px-4 py-2 text-xs animate-in fade-in">
          <span className="font-bold text-label-blue mr-1">{selected.size} selecionado(s)</span>
          <select
            value={moveTarget}
            onChange={(e) => setMoveTarget(e.target.value)}
            className="h-7 rounded-lg border border-border bg-surface px-2 text-xs text-text-main font-semibold focus:outline-none"
          >
            <option value="">Mover estágio...</option>
            {DEAL_STAGES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleBulkMove}
            disabled={!moveTarget}
            className="h-7 px-2.5 rounded-lg bg-brand-500 text-white font-bold hover:bg-brand-600 disabled:opacity-40 transition-colors flex items-center gap-1"
          >
            <ArrowRightLeft className="size-3" /> Mover
          </button>

          <select
            value={bulkPriority}
            onChange={(e) => setBulkPriority(e.target.value)}
            className="h-7 rounded-lg border border-border bg-surface px-2 text-xs text-text-main font-semibold focus:outline-none"
          >
            <option value="">Definir prioridade...</option>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {bulkPriority && (
            <button
              type="button"
              onClick={handleBulkPriority}
              className="h-7 px-2.5 rounded-lg bg-surface border border-border font-bold text-text-main hover:bg-surface-2 transition-colors flex items-center gap-1"
            >
              <Flag className="size-3" /> Aplicar
            </button>
          )}

          <button
            type="button"
            onClick={handleBulkDelete}
            className="h-7 px-2.5 rounded-lg bg-label-crimson-bg text-label-crimson font-bold hover:opacity-80 transition-opacity flex items-center gap-1"
          >
            <Trash2 className="size-3" /> Excluir
          </button>

          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-text-muted hover:text-text-main underline"
          >
            Limpar seleção
          </button>
        </div>
      )}

      {/* ── Main View: Kanban vs Table ── */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-brand-500" />
        </div>
      ) : viewMode === "kanban" ? (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4 items-start custom-scrollbar">
            {DEAL_STAGES.map((stage) => (
              <KanbanColumn
                key={stage.value}
                stage={stage}
                deals={dealsByStage[stage.value] || []}
                contacts={contacts}
                selected={selected}
                onToggleSelect={toggleSelect}
                onEditDeal={(deal) => setEditingDeal(deal)}
                onSetOutcome={handleSetOutcome}
                onAddDeal={() => {
                  setSelectedStage(stage.value);
                  setShowForm(true);
                }}
              />
            ))}
          </div>

          <DragOverlay>
            {activeDeal ? (
              <DealCard deal={activeDeal} contact={contacts[activeDeal.contactId]} isDragging />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* ── Plane Interactive Data Table ── */
        <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-soft">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs text-text-main min-w-[840px]">
              <thead className="border-b border-border bg-surface-2 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                <tr>
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredDeals.length > 0 && selected.size === filteredDeals.length}
                      onChange={() => {
                        if (selected.size === filteredDeals.length) setSelected(new Set());
                        else setSelected(new Set(filteredDeals.map((d) => d.id)));
                      }}
                      className="rounded border-border"
                    />
                  </th>
                  <th className="p-3.5">Título do Negócio</th>
                  <th className="p-3.5">Contato / Empresa</th>
                  <th className="p-3.5">Estágio</th>
                  <th className="p-3.5">Prioridade</th>
                  <th className="p-3.5 text-right">Valor</th>
                  <th className="p-3.5 text-right">Criado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredDeals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-xs text-text-muted">
                      Nenhum negócio encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  filteredDeals.map((deal) => {
                    const contact = contacts[deal.contactId];
                    const stage = stageMeta(deal.stage);
                    const priority = priorityMeta(deal.priority);
                    const isSel = selected.has(deal.id);

                    return (
                      <tr
                        key={deal.id}
                        className={`hover:bg-surface-2/60 transition-colors ${
                          isSel ? "bg-brand-500/5" : ""
                        }`}
                      >
                        <td className="p-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => toggleSelect(deal.id)}
                            className="rounded border-border"
                          />
                        </td>
                        <td className="p-3.5 font-bold text-text-main">
                          <div className="flex items-center gap-2">
                            <span className={`size-2 rounded-full ${stage.bg}`} />
                            <Link
                              href={`/dashboard/crm/deals/${deal.id}`}
                              className="truncate max-w-[240px] hover:text-brand-400 transition-colors"
                            >
                              {deal.title}
                            </Link>
                          </div>
                        </td>
                        <td className="p-3.5">
                          {contact ? (
                            <Link
                              href={`/dashboard/crm/contacts/${contact.id}`}
                              className="flex items-center gap-2 hover:text-brand-400 transition-colors"
                            >
                              <span className={`size-5 rounded-full flex items-center justify-center text-[8px] font-bold ${avatarColor(contact.name)}`}>
                                {initials(contact.name)}
                              </span>
                              <span className="truncate max-w-[160px] font-medium">{contact.name}</span>
                              {contact.company && (
                                <span className="text-[10px] text-text-muted truncate">({contact.company})</span>
                              )}
                            </Link>
                          ) : (
                            <span className="text-text-muted italic">Sem contato</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${stage.bg} ${stage.text}`}>
                            {stage.label}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${priority.bg} ${priority.text}`}>
                            {priority.label}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-text-main">
                          {formatCurrency(deal.valueCents, deal.currency)}
                        </td>
                        <td className="p-3.5 text-right text-text-muted text-[11px]">
                          {formatDate(deal.createdAt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Novo Negócio ── */}
      {showForm && (
        <DealForm
          onSave={handleCreateDeal}
          onCancel={() => setShowForm(false)}
          stage={selectedStage}
        />
      )}

      {/* ── Modal: Editar Negócio ── */}
      {editingDeal && (
        <DealForm
          deal={editingDeal}
          onSave={handleUpdateDeal}
          onCancel={() => setEditingDeal(null)}
          stage={editingDeal.stage}
        />
      )}
    </div>
  );
}

function KanbanColumn({ stage, deals, contacts, selected, onToggleSelect, onEditDeal, onSetOutcome, onAddDeal }) {
  const totalValue = deals.reduce((sum, deal) => sum + (deal.valueCents || 0), 0);
  const sm = stageMeta(stage.value);
  const [cardMenuId, setCardMenuId] = useState(null);

  return (
    <div className="flex-shrink-0 w-80 flex flex-col">
      {/* Column Header */}
      <div className="mb-2.5 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={`size-2.5 rounded-full ${sm.bg} ${sm.text}`} />
          <h2 className="text-xs font-bold font-display text-text-main">{sm.label}</h2>
          <span className="rounded-full bg-surface-2 border border-border px-2 py-0.5 text-[10px] font-bold text-text-muted">
            {deals.length}
          </span>
        </div>
        <span className="text-xs font-mono font-bold text-text-muted">{formatCurrency(totalValue)}</span>
      </div>

      {/* Droppable Container */}
      <div
        id={stage.value}
        className="space-y-2.5 min-h-[460px] rounded-2xl border border-border bg-surface-2/50 p-2.5 flex-1 flex flex-col"
      >
        <div className="space-y-2.5 flex-1">
          {deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              contact={contacts[deal.contactId]}
              isSelected={selected.has(deal.id)}
              menuOpen={cardMenuId === deal.id}
              onToggleMenu={() => setCardMenuId(cardMenuId === deal.id ? null : deal.id)}
              onCloseMenu={() => setCardMenuId(null)}
              onToggle={() => onToggleSelect(deal.id)}
              onEdit={() => {
                setCardMenuId(null);
                onEditDeal(deal);
              }}
              onSetOutcome={(outcome) => {
                setCardMenuId(null);
                onSetOutcome(deal, outcome);
              }}
            />
          ))}

          {deals.length === 0 && (
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border text-xs text-text-muted/60">
              Nenhum negócio nesta etapa
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onAddDeal}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2 text-xs font-semibold text-text-muted hover:border-brand-500/50 hover:text-brand-400 hover:bg-surface transition-all"
        >
          <Plus className="size-3.5" />
          <span>Adicionar negócio</span>
        </button>
      </div>
    </div>
  );
}

function DealCard({ deal, contact, isDragging, isSelected, onToggle, onEdit, onSetOutcome, menuOpen, onToggleMenu, onCloseMenu }) {
  const pm = priorityMeta(deal.priority);
  const sm = stageMeta(deal.stage);
  const isClosed = ["won", "lost", "cancelled"].includes(deal.stage);

  return (
    <div
      id={deal.id}
      className={`group relative cursor-grab active:cursor-grabbing rounded-xl border bg-surface p-3.5 shadow-soft transition-all hover:shadow-elevated hover:border-brand-500/30 space-y-2.5 ${
        isDragging ? "opacity-40 rotate-2 scale-105" : ""
      } ${isSelected ? "border-brand-500 ring-2 ring-brand-500/20" : "border-border"}`}
    >
      {/* Left priority accent indicator */}
      <span className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${pm.bg}`} />

      <div className="flex items-start justify-between gap-2 pl-1.5">
        <h3 className="text-xs font-bold text-text-main leading-snug group-hover:text-brand-400 transition-colors">
          {deal.title}
        </h3>
        <div className="relative flex items-center gap-0.5 shrink-0">
          <Link
            href={`/dashboard/crm/deals/${deal.id}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded p-0.5 text-text-muted opacity-0 group-hover:opacity-100 hover:text-brand-500 transition-colors"
            title="Abrir página do negócio"
          >
            <ArrowUpRight className="size-3.5" />
          </Link>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.();
            }}
            className="rounded p-0.5 text-text-muted opacity-0 group-hover:opacity-100 hover:text-brand-500 transition-colors"
            title="Editar negócio"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu?.();
            }}
            className={`rounded p-0.5 transition-colors ${
              menuOpen ? "text-brand-500 opacity-100" : "text-text-muted opacity-0 group-hover:opacity-100 hover:text-brand-500"
            }`}
            title="Ações rápidas"
          >
            <MoreVertical className="size-4" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={onCloseMenu} />
              <div className="absolute right-0 top-6 z-30 w-44 rounded-xl border border-border bg-surface p-1 shadow-elevated animate-in fade-in zoom-in-95">
                <Link
                  href={`/dashboard/crm/deals/${deal.id}`}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-main hover:bg-surface-2 transition-colors"
                >
                  <ArrowUpRight className="size-3.5 text-brand-500" /> Abrir página
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-main hover:bg-surface-2 transition-colors"
                >
                  <Pencil className="size-3.5 text-brand-500" /> Editar
                </button>
                <div className="my-1 border-t border-border/60" />
                {!isClosed ? (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetOutcome?.("won");
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                    >
                      <Trophy className="size-3.5" /> Marcar como Ganho
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetOutcome?.("lost");
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-label-crimson hover:bg-label-crimson-bg transition-colors"
                    >
                      <ThumbsDown className="size-3.5" /> Marcar como Perdido
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetOutcome?.("lead");
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-500 hover:bg-brand-500/10 transition-colors"
                  >
                    <RotateCcw className="size-3.5" /> Reabrir Negócio
                  </button>
                )}
                <div className="my-1 border-t border-border/60" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle?.();
                    onCloseMenu?.();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-main hover:bg-surface-2 transition-colors"
                >
                  <CheckCircle2 className="size-3.5 text-brand-500" />
                  {isSelected ? "Deselecionar" : "Selecionar"}
                </button>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.();
            }}
            className={`rounded p-0.5 transition-colors ${
              isSelected ? "text-brand-500" : "text-text-muted opacity-0 group-hover:opacity-100 hover:text-brand-500"
            }`}
            title={isSelected ? "Deselecionar" : "Selecionar"}
          >
            <CheckCircle2 className={`size-4 ${isSelected ? "fill-brand-500 text-white" : ""}`} />
          </button>
        </div>
      </div>

      {contact && (
        <div className="flex items-center gap-2 pl-1.5">
          <span className={`size-5 rounded-full flex items-center justify-center text-[8px] font-bold ${avatarColor(contact.name)}`}>
            {initials(contact.name)}
          </span>
          <span className="truncate text-xs text-text-muted font-medium">
            {contact.name} {contact.company ? `• ${contact.company}` : ""}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between pl-1.5 pt-1 border-t border-border/50 text-xs">
        <span className="font-bold font-mono text-text-main">{formatCurrency(deal.valueCents, deal.currency)}</span>
        <div className="flex items-center gap-2 text-[10px] text-text-muted font-mono">
          {deal.expectedCloseAt && (
            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md ${
              new Date(deal.expectedCloseAt) < new Date() && !["won", "lost", "cancelled"].includes(deal.stage)
                ? "bg-label-crimson-bg text-label-crimson"
                : "bg-label-blue-bg text-label-blue"
            }`}>
              <Calendar className="size-3" />
              {formatDate(deal.expectedCloseAt)}
            </span>
          )}
          <span className="flex items-center gap-1 text-text-muted/60">
            <span>{timeAgo(deal.createdAt)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function DealForm({ onSave, onCancel, stage, deal }) {
  const [contacts, setContacts] = useState([]);
  const [formData, setFormData] = useState({
    contactId: deal?.contactId || "",
    title: deal?.title || "",
    valueCents: deal?.valueCents ?? 50000,
    currency: deal?.currency || "BRL",
    priority: deal?.priority || "medium",
    expectedCloseAt: deal?.expectedCloseAt || "",
    notes: deal?.notes || "",
  });
  const [formStage, setFormStage] = useState(deal?.stage || stage);
  const [saving, setSaving] = useState(false);
  const isEdit = !!deal;
  const sm = stageMeta(formStage);

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
    await onSave({ ...formData, stage: formStage });
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
              {isEdit ? "Editar Negócio" : "Novo Negócio no Pipeline"}
            </h2>
            <p className="text-xs text-text-muted">
              {isEdit ? "Atualize os dados desta oportunidade de venda." : "Cadastre uma nova oportunidade no funil de vendas."}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-text-muted hover:text-text-main text-xs"
          >
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
              placeholder="Ex.: Implantação SaaS Pro + Suporte Anual"
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
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-muted">Estágio</label>
              {isEdit ? (
                <select
                  value={formStage}
                  onChange={(e) => setFormStage(e.target.value)}
                  className={inputCls}
                >
                  {DEAL_STAGES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              ) : (
                <div className="flex h-9 items-center rounded-xl border border-border bg-surface-2 px-3 text-xs text-text-main font-semibold">
                  <span className={`mr-2 size-2 rounded-full ${sm.bg}`} />
                  {sm.label}
                </div>
              )}
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
              <span>{isEdit ? "Salvar Alterações" : "Criar Negócio"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
