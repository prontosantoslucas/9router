"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCorners,
} from "@dnd-kit/core";
import { Card, Button, Input, Modal, ConfirmModal, Badge, SegmentedControl, Select } from "@/shared/components";
import { Spinner } from "@/shared/components/Loading";
import {
  STAGE_ORDER,
  STAGE_LABELS,
  formatCurrency,
  iconForActivity,
  safeParse,
  toDealPayload,
  validateDealPayload,
  filterContacts as filterContactsFn,
  parseTagsInput,
} from "@/lib/crm/utils.js";

// ────────────────────────────────────────────────────────────────────
// Constantes de tema (não puras — dependem de classes CSS geradas)
// ────────────────────────────────────────────────────────────────────

// Cores por stage — via classes utilitárias do DS (tokens do globals.css).
// Nada de hex hardcoded no JSX.
const STAGE_TONE = {
  lead: { dot: "bg-text-muted", ring: "ring-text-muted/30", accent: "text-text-muted" },
  qualified: { dot: "bg-info", ring: "ring-info/30", accent: "text-info" },
  proposal: { dot: "bg-warning", ring: "ring-warning/30", accent: "text-warning" },
  negotiation: { dot: "bg-brand-500", ring: "ring-brand-500/30", accent: "text-brand-500" },
  won: { dot: "bg-success", ring: "ring-success/30", accent: "text-success" },
  lost: { dot: "bg-danger", ring: "ring-danger/30", accent: "text-danger" },
};

// ────────────────────────────────────────────────────────────────────
// Página
// ────────────────────────────────────────────────────────────────────

export default function CrmPage() {
  const [tab, setTab] = useState("pipeline");
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [summary, setSummary] = useState(null);

  const [contactFilter, setContactFilter] = useState("");
  const [showDealForm, setShowDealForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [draggingId, setDraggingId] = useState(null);

  const [toast, setToast] = useState(null); // { kind: "success"|"error", text }

  // ── Loaders ───────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const [dealsRes, contactsRes, actsRes] = await Promise.all([
        fetch("/api/crm/deals?summary=1").then((r) => r.json()),
        fetch("/api/crm/contacts").then((r) => r.json()),
        fetch("/api/crm/activities").then((r) => r.json()),
      ]);
      setDeals(dealsRes.deals || []);
      setSummary(dealsRes.summary || null);
      setContacts(contactsRes.contacts || []);
      setActivities(actsRes.activities || []);
    } catch (err) {
      showToast("error", `Falha ao carregar CRM: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── Toast simples inline (dívida técnica: usar sistema do DS quando tiver) ──
  function showToast(kind, text) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Mutations ─────────────────────────────────────────────
  async function moveDeal(id, stage) {
    // Optimistic update
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, stage } : d)));
    try {
      const res = await fetch(`/api/crm/deals?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
      // Reload summary para totais atualizados
      const dealsRes = await fetch("/api/crm/deals?summary=1").then((r) => r.json());
      setDeals(dealsRes.deals || []);
      setSummary(dealsRes.summary || null);
    } catch (err) {
      showToast("error", `Não consegui mover: ${err.message}`);
      loadAll(); // rollback via reload
    }
  }

  async function deleteDeal(id) {
    setConfirmDelete(null);
    try {
      const res = await fetch(`/api/crm/deals?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
      showToast("success", "Deal excluído.");
      loadAll();
    } catch (err) {
      showToast("error", `Falha ao excluir: ${err.message}`);
    }
  }

  async function submitDeal(payload) {
    try {
      // 1. Garantir contato
      let contactId = payload.contactId;
      if (!contactId && payload.contactEmail) {
        const existing = contacts.find((c) => c.email === payload.contactEmail);
        if (existing) contactId = existing.id;
        else {
          const cr = await fetch("/api/crm/contacts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: payload.contactName,
              email: payload.contactEmail,
              source: payload.source || "manual",
            }),
          }).then((r) => r.json());
          contactId = cr.contact?.id;
        }
      }
      if (!contactId) throw new Error("Contato obrigatório");

      // 2. Criar deal
      const res = await fetch("/api/crm/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          title: payload.title,
          valueCents: Number(payload.valueCents) || 0,
          currency: payload.currency || "BRL",
          stage: payload.stage || "lead",
          source: payload.source || "manual",
          notes: payload.notes || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
      showToast("success", "Deal criado.");
      setShowDealForm(false);
      loadAll();
    } catch (err) {
      showToast("error", `Não criei: ${err.message}`);
    }
  }

  async function submitContact(payload) {
    try {
      const res = await fetch("/api/crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
      showToast("success", "Contato salvo.");
      setShowContactForm(false);
      loadAll();
    } catch (err) {
      showToast("error", `Não salvei o contato: ${err.message}`);
    }
  }

  // ── Drag & drop ────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragStart(evt) {
    setDraggingId(evt.active?.id || null);
  }

  function onDragEnd(evt) {
    setDraggingId(null);
    const dealId = evt.active?.id;
    const overStage = evt.over?.id;
    if (!dealId || !overStage) return;
    const current = deals.find((d) => d.id === dealId);
    if (!current || current.stage === overStage) return;
    moveDeal(dealId, overStage);
  }

  const draggedDeal = useMemo(() => deals.find((d) => d.id === draggingId), [deals, draggingId]);

  // ── Contatos: filtro ──────────────────────────────────────
  const filteredContacts = useMemo(
    () => filterContactsFn(contacts, contactFilter),
    [contacts, contactFilter]
  );

  // ── Render ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-3 px-4 py-24 text-text-muted">
        <Spinner size="lg" />
        <p className="text-sm">Carregando CRM...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-text-main sm:text-3xl">CRM</h1>
          <p className="mt-1 text-sm text-text-muted">
            Pipeline de vendas, contatos e atividades — sincronizado com o Agente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={loadAll} title="Recarregar">
            <span className="material-symbols-outlined text-base">refresh</span>
            <span className="sr-only">Recarregar</span>
          </Button>
          {tab === "pipeline" && (
            <Button variant="primary" onClick={() => setShowDealForm(true)}>
              <span className="material-symbols-outlined text-base">add</span>
              <span>Novo deal</span>
            </Button>
          )}
          {tab === "contatos" && (
            <Button variant="primary" onClick={() => setShowContactForm(true)}>
              <span className="material-symbols-outlined text-base">person_add</span>
              <span>Novo contato</span>
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <PipelineSummaryStrip summary={summary} />

      {/* Tabs */}
      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: "pipeline", label: "Pipeline" },
          { value: "contatos", label: `Contatos (${contacts.length})` },
          { value: "atividades", label: "Atividades" },
        ]}
      />

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={`fixed right-6 top-24 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-elev-2 ${
            toast.kind === "success"
              ? "bg-success text-white"
              : "bg-danger text-white"
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Views */}
      {tab === "pipeline" && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {STAGE_ORDER.map((stage) => (
              <StageColumn
                key={stage}
                stage={stage}
                deals={deals.filter((d) => d.stage === stage)}
                onOpen={setSelectedDeal}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {draggedDeal ? <DealCardPreview deal={draggedDeal} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {tab === "contatos" && (
        <ContactsView
          contacts={filteredContacts}
          filter={contactFilter}
          onFilter={setContactFilter}
          onNew={() => setShowContactForm(true)}
          onDelete={async (id) => {
            const res = await fetch(`/api/crm/contacts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
            if (res.ok) {
              showToast("success", "Contato removido.");
              loadAll();
            } else showToast("error", "Falha ao remover.");
          }}
        />
      )}

      {tab === "atividades" && <ActivitiesFeed activities={activities} contacts={contacts} />}

      {/* Modals */}
      {showDealForm && (
        <DealFormModal
          contacts={contacts}
          onCancel={() => setShowDealForm(false)}
          onSubmit={submitDeal}
        />
      )}
      {showContactForm && (
        <ContactFormModal onCancel={() => setShowContactForm(false)} onSubmit={submitContact} />
      )}
      {selectedDeal && (
        <DealDetailModal
          deal={selectedDeal}
          contacts={contacts}
          onClose={() => setSelectedDeal(null)}
          onMove={(stage) => {
            moveDeal(selectedDeal.id, stage);
            setSelectedDeal(null);
          }}
          onDelete={() => {
            setConfirmDelete(selectedDeal);
            setSelectedDeal(null);
          }}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          isOpen
          title="Excluir deal?"
          message={`"${confirmDelete.title}" será removido permanentemente.`}
          confirmText="Excluir"
          cancelText="Cancelar"
          variant="danger"
          onConfirm={() => deleteDeal(confirmDelete.id)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Componentes internos
// ────────────────────────────────────────────────────────────────────

function PipelineSummaryStrip({ summary }) {
  if (!summary) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {STAGE_ORDER.map((stage) => {
        const s = summary.stages?.[stage] || { count: 0, value: 0 };
        const tone = STAGE_TONE[stage];
        return (
          <Card key={stage} padding="sm">
            <div className={`flex items-center gap-2 ${tone.accent}`}>
              <span className={`inline-block h-2 w-2 rounded-full ${tone.dot}`} />
              <p className="text-[11px] font-semibold uppercase tracking-wide">
                {STAGE_LABELS[stage]}
              </p>
            </div>
            <p className="mt-1 text-xl font-extrabold text-text-main">{s.count}</p>
            <p className="text-xs text-text-muted">{formatCurrency(s.value)}</p>
          </Card>
        );
      })}
    </div>
  );
}

function StageColumn({ stage, deals, onOpen }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const tone = STAGE_TONE[stage];
  const total = deals.reduce((s, d) => s + (d.valueCents || 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[240px] flex-col gap-3 rounded-xl border border-border bg-surface/50 p-3 transition-colors dark:bg-surface-2/50 ${
        isOver ? `bg-brand-500/5 ring-2 ring-inset ${tone.ring}` : ""
      }`}
    >
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <div className={`flex items-center gap-2 ${tone.accent}`}>
          <span className={`inline-block h-2 w-2 rounded-full ${tone.dot}`} />
          <h3 className="text-xs font-bold uppercase tracking-wide">{STAGE_LABELS[stage]}</h3>
          <span className="text-xs text-text-muted">·  {deals.length}</span>
        </div>
        <span className="text-[11px] text-text-muted">{formatCurrency(total)}</span>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {deals.length === 0 ? (
          <p className="mt-2 text-center text-xs text-text-muted">Sem deals nesta coluna.</p>
        ) : (
          deals.map((d) => <DraggableDealCard key={d.id} deal={d} onOpen={onOpen} />)
        )}
      </div>
    </div>
  );
}

function DraggableDealCard({ deal, onOpen }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        // Só considera "clique" se não estiver arrastando
        if (!isDragging) {
          e.stopPropagation();
          onOpen(deal);
        }
      }}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(deal);
        }
      }}
    >
      <DealCardPreview deal={deal} />
    </div>
  );
}

function DealCardPreview({ deal }) {
  return (
    <Card padding="sm" className="hover:border-brand-500/60">
      <p className="line-clamp-2 text-sm font-semibold text-text-main">{deal.title}</p>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-text-muted">
        <span className="material-symbols-outlined text-[14px]">person</span>
        <span className="truncate">{deal.contactName || "Sem contato"}</span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-bold text-brand-500">
          {formatCurrency(deal.valueCents, deal.currency || "BRL")}
        </span>
        {deal.source && (
          <Badge variant="default" className="text-[10px]">
            {deal.source}
          </Badge>
        )}
      </div>
    </Card>
  );
}

function ContactsView({ contacts, filter, onFilter, onNew, onDelete }) {
  if (contacts.length === 0 && !filter) {
    return (
      <Card padding="lg" className="text-center">
        <span className="material-symbols-outlined text-4xl text-text-muted">contact_page</span>
        <h3 className="mt-3 text-lg font-bold text-text-main">Nenhum contato ainda</h3>
        <p className="mt-1 text-sm text-text-muted">Comece adicionando o primeiro contato.</p>
        <Button variant="primary" className="mt-4" onClick={onNew}>
          Novo contato
        </Button>
      </Card>
    );
  }

  return (
    <Card padding="md">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex-1">
          <Input
            placeholder="Filtrar por nome, email ou empresa..."
            value={filter}
            onChange={(e) => onFilter(e.target.value)}
            icon="search"
          />
        </div>
        <span className="text-xs text-text-muted">{contacts.length} resultado{contacts.length !== 1 ? "s" : ""}</span>
      </div>

      {contacts.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">Nenhum contato bate com o filtro.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                <th className="pb-2 pr-4">Nome</th>
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4">Telefone</th>
                <th className="pb-2 pr-4">Empresa</th>
                <th className="pb-2 pr-4">Tags</th>
                <th className="pb-2 pr-4">Fonte</th>
                <th className="pb-2 pr-4">Criado</th>
                <th className="pb-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-bg-alt">
                  <td className="py-3 pr-4 font-medium text-text-main">{c.name}</td>
                  <td className="py-3 pr-4 text-xs text-text-muted">{c.email || "—"}</td>
                  <td className="py-3 pr-4 text-xs text-text-muted">{c.phone || "—"}</td>
                  <td className="py-3 pr-4 text-xs text-text-muted">{c.company || "—"}</td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {(c.tags || []).map((t) => (
                        <Badge key={t} variant="default">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-xs text-text-muted">{c.source || "—"}</td>
                  <td className="py-3 pr-4 text-xs text-text-muted">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Remover contato "${c.name}"? Deals ligados também serão apagados.`)) {
                          onDelete(c.id);
                        }
                      }}
                      className="text-text-muted transition-colors hover:text-danger"
                      title="Excluir contato"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ActivitiesFeed({ activities, contacts }) {
  if (activities.length === 0) {
    return (
      <Card padding="lg" className="text-center">
        <span className="material-symbols-outlined text-4xl text-text-muted">history</span>
        <h3 className="mt-3 text-lg font-bold text-text-main">Sem atividades registradas</h3>
        <p className="mt-1 text-sm text-text-muted">
          Ligações, e-mails e notas do agente aparecerão aqui.
        </p>
      </Card>
    );
  }

  const byId = new Map(contacts.map((c) => [c.id, c]));

  return (
    <Card padding="md">
      <ul className="divide-y divide-border/60">
        {activities.map((a) => {
          const contact = byId.get(a.contactId);
          const meta = safeParse(a.metadata);
          return (
            <li key={a.id} className="flex items-start gap-3 py-3">
              <span className="material-symbols-outlined mt-0.5 text-lg text-brand-500">
                {iconForActivity(a.type)}
              </span>
              <div className="flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-text-main">
                    {a.type} {contact ? `— ${contact.name}` : ""}
                  </p>
                  <span className="whitespace-nowrap text-[11px] text-text-muted">
                    {new Date(a.createdAt).toLocaleString("pt-BR")}
                  </span>
                </div>
                {a.description && <p className="mt-1 text-sm text-text-muted">{a.description}</p>}
                {meta && Object.keys(meta).length > 0 && (
                  <pre className="mt-2 rounded bg-bg-alt p-2 text-[11px] text-text-muted">
                    {JSON.stringify(meta, null, 2)}
                  </pre>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────
// Modais
// ────────────────────────────────────────────────────────────────────

function DealFormModal({ contacts, onCancel, onSubmit }) {
  const [form, setForm] = useState({
    contactId: "",
    contactName: "",
    contactEmail: "",
    title: "",
    valueCents: "",
    currency: "BRL",
    stage: "lead",
    source: "",
    notes: "",
  });

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const [validationErrors, setValidationErrors] = useState([]);

  function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, ...toDealPayload(form) };
    const errs = validateDealPayload(payload, { requireContact: true });
    if (errs.length > 0) {
      setValidationErrors(errs);
      return;
    }
    setValidationErrors([]);
    onSubmit(payload);
  }

  return (
    <Modal isOpen title="Novo deal" onClose={onCancel} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
            Contato existente
          </label>
          <Select
            value={form.contactId}
            onChange={(e) => update("contactId", e.target.value)}
            options={[
              { value: "", label: "— criar novo abaixo —" },
              ...contacts.map((c) => ({ value: c.id, label: `${c.name}${c.email ? ` · ${c.email}` : ""}` })),
            ]}
          />
        </div>

        {!form.contactId && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nome do contato"
              value={form.contactName}
              onChange={(e) => update("contactName", e.target.value)}
              placeholder="Ex.: Ana Souza"
              required
            />
            <Input
              label="Email do contato"
              type="email"
              value={form.contactEmail}
              onChange={(e) => update("contactEmail", e.target.value)}
              placeholder="ana@empresa.com"
            />
          </div>
        )}

        <Input
          label="Título do deal"
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="Ex.: Consultoria Q1 2027"
          required
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Valor (R$)"
            type="number"
            step="0.01"
            value={form.valueCents}
            onChange={(e) => update("valueCents", e.target.value)}
            placeholder="0,00"
          />
          <Select
            label="Moeda"
            value={form.currency}
            onChange={(e) => update("currency", e.target.value)}
            options={[
              { value: "BRL", label: "BRL — Real" },
              { value: "USD", label: "USD — Dólar" },
              { value: "EUR", label: "EUR — Euro" },
            ]}
          />
          <Select
            label="Stage inicial"
            value={form.stage}
            onChange={(e) => update("stage", e.target.value)}
            options={STAGE_ORDER.map((s) => ({ value: s, label: STAGE_LABELS[s] }))}
          />
        </div>

        <Input
          label="Origem (opcional)"
          value={form.source}
          onChange={(e) => update("source", e.target.value)}
          placeholder="Ex.: indicação, LinkedIn, evento"
        />

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
            Anotações
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-main focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:bg-surface-2"
            placeholder="Contexto, próximos passos, links..."
          />
        </div>

        {validationErrors.length > 0 && (
          <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs text-danger">
            {validationErrors.map((err, i) => (
              <p key={i}>• {err}</p>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit">
            Criar deal
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ContactFormModal({ onCancel, onSubmit }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    tags: "",
    notes: "",
    source: "manual",
  });

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSubmit({ ...form, tags: parseTagsInput(form.tags) });
  }

  return (
    <Modal isOpen title="Novo contato" onClose={onCancel} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nome" value={form.name} onChange={(e) => update("name", e.target.value)} required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Telefone" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          <Input label="Empresa" value={form.company} onChange={(e) => update("company", e.target.value)} />
        </div>
        <Input
          label="Tags (separadas por vírgula)"
          value={form.tags}
          onChange={(e) => update("tags", e.target.value)}
          placeholder="cliente, vip, produto-x"
        />
        <Input label="Fonte" value={form.source} onChange={(e) => update("source", e.target.value)} />
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
            Anotações
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-main focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:bg-surface-2"
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit">
            Salvar contato
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DealDetailModal({ deal, contacts, onClose, onMove, onDelete }) {
  const contact = contacts.find((c) => c.id === deal.contactId);
  return (
    <Modal isOpen title={deal.title} onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="default">{STAGE_LABELS[deal.stage] || deal.stage}</Badge>
          <span className="text-xs text-text-muted">
            Atualizado em {new Date(deal.updatedAt || deal.createdAt).toLocaleString("pt-BR")}
          </span>
        </div>

        <div className="rounded-lg bg-bg-alt p-4">
          <p className="text-xs uppercase tracking-wide text-text-muted">Valor</p>
          <p className="mt-1 text-2xl font-extrabold text-brand-500">
            {formatCurrency(deal.valueCents, deal.currency || "BRL")}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-text-muted">Contato</p>
            <p className="mt-1 text-sm font-semibold text-text-main">{deal.contactName || "—"}</p>
            {contact?.email && <p className="text-xs text-text-muted">{contact.email}</p>}
            {contact?.phone && <p className="text-xs text-text-muted">{contact.phone}</p>}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-text-muted">Origem</p>
            <p className="mt-1 text-sm text-text-main">{deal.source || "—"}</p>
          </div>
        </div>

        {deal.notes && (
          <div>
            <p className="text-xs uppercase tracking-wide text-text-muted">Anotações</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-text-main">{deal.notes}</p>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">Mover para</p>
          <div className="flex flex-wrap gap-2">
            {STAGE_ORDER.filter((s) => s !== deal.stage).map((s) => (
              <Button key={s} variant="secondary" size="sm" onClick={() => onMove(s)}>
                {STAGE_LABELS[s]}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <Button variant="danger" onClick={onDelete}>
            <span className="material-symbols-outlined text-base">delete</span>
            <span>Excluir</span>
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
