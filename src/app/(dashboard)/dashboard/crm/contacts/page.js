"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Users, Search, Download, Trash2, Tag, ChevronLeft, ChevronRight,
  Loader2, UserPlus, ArrowUpDown, MessageSquare, Phone, Mail, Building2,
  Filter, Sparkles, CheckCircle2, ShieldCheck, MoreVertical, Plus, ExternalLink
} from "lucide-react";
import {
  CONTACT_STATUSES, statusMeta, tagMeta, initials, avatarColor,
  formatDate, timeAgo, formatWhatsAppUrl
} from "../crmMeta";

const PAGE_SIZE = 50;

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [bulkTag, setBulkTag] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchContacts();
  }, [search, statusFilter, tagFilter, page]);

  function notify(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function fetchContacts() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (tagFilter) params.set("tags", tagFilter);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String((page - 1) * PAGE_SIZE));

      const res = await fetch(`/api/crm/contacts?${params}`);
      const data = await res.json();
      setContacts(data.contacts || []);
    } catch (error) {
      console.error("Erro ao buscar contatos:", error);
    } finally {
      setLoading(false);
    }
  }

  const allTags = useMemo(() => {
    const set = new Set();
    contacts.forEach((c) => (c.tags || []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [contacts]);

  async function handleCreate(formData) {
    try {
      const res = await fetch("/api/crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        setShowForm(false);
        fetchContacts();
        notify("✓ Contato cadastrado com sucesso!");
      } else {
        notify(data.error || "Erro ao criar contato");
      }
    } catch (error) {
      notify("Erro ao criar contato");
    }
  }

  async function handleExport() {
    const url = `/api/crm/export?type=contacts`;
    const link = document.createElement("a");
    link.href = url;
    link.click();
    notify("Exportando CSV de contatos…");
  }

  async function handleBulk(action) {
    if (selected.size === 0) return;

    if (action === "delete") {
      if (!confirm(`Tem certeza que deseja excluir ${selected.size} contato(s)?`)) return;
      await fetch("/api/crm/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids: [...selected] }),
      });
      notify(`${selected.size} contato(s) excluído(s)`);
    } else if (action === "add-tag") {
      const tag = prompt("Digite o nome da tag para adicionar:");
      if (!tag) return;
      await fetch("/api/crm/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add-tag", ids: [...selected], tag }),
      });
      notify(`Tag "${tag}" adicionada aos contatos`);
    } else if (action === "set-status") {
      if (!bulkStatus) return;
      await fetch("/api/crm/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-status", ids: [...selected], status: bulkStatus }),
      });
      notify(`Status alterado para ${statusMeta(bulkStatus).label}`);
    }

    setSelected(new Set());
    setBulkStatus("");
    fetchContacts();
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === contacts.length) setSelected(new Set());
    else setSelected(new Set(contacts.map((c) => c.id)));
  }

  const allSelected = contacts.length > 0 && selected.size === contacts.length;

  return (
    <div className="space-y-5 pb-12">
      {/* Toast Notification */}
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
            <span className="font-semibold text-brand-400">Diretório de Clientes</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black font-display text-text-main tracking-tight flex items-center gap-2.5">
            <Users className="size-6 text-brand-500" />
            Contatos & Empresas
          </h1>
          <p className="text-xs text-text-muted">
            {contacts.length > 0 ? `${contacts.length} contatos encontrados na base ativa` : "Gerencie sua base de clientes e leads"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors"
          >
            <Download className="size-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-soft hover:opacity-90 transition-opacity"
          >
            <UserPlus className="size-3.5" />
            <span>Novo Contato</span>
          </button>
        </div>
      </div>

      {/* ── Quick Filter Chips (Plane Workspace Tabs) ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
        <button
          type="button"
          onClick={() => { setStatusFilter("all"); setPage(1); }}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 ${
            statusFilter === "all"
              ? "bg-brand-500 text-white shadow-soft"
              : "border border-border bg-surface text-text-muted hover:text-text-main"
          }`}
        >
          <span>Todos</span>
        </button>

        {CONTACT_STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => { setStatusFilter(s.value); setPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 ${
              statusFilter === s.value
                ? "bg-brand-500 text-white shadow-soft"
                : "border border-border bg-surface text-text-muted hover:text-text-main"
            }`}
          >
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* ── Search & Tag Filters ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar por nome, email, telefone ou empresa..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-xs text-text-main placeholder:text-text-muted focus:border-brand-500 focus:outline-none"
          />
        </div>

        {allTags.length > 0 && (
          <div className="flex items-center gap-1 text-xs font-semibold text-text-muted bg-surface border border-border px-2.5 py-1.5 rounded-xl">
            <Tag className="size-3 text-brand-500" />
            <select
              value={tagFilter}
              onChange={(e) => { setTagFilter(e.target.value); setPage(1); }}
              className="bg-transparent text-text-main font-semibold focus:outline-none text-xs"
            >
              <option value="">Todas as tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Bulk Actions Floating Bar ── */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-500/30 bg-label-blue-bg px-4 py-2 text-xs animate-in fade-in">
          <span className="font-bold text-label-blue mr-1">{selected.size} selecionado(s)</span>
          <button
            type="button"
            onClick={() => handleBulk("add-tag")}
            className="h-7 px-2.5 rounded-lg bg-surface border border-border font-bold text-text-main hover:bg-surface-2 transition-colors flex items-center gap-1"
          >
            <Tag className="size-3 text-brand-500" /> Tag
          </button>

          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            className="h-7 rounded-lg border border-border bg-surface px-2 text-xs text-text-main font-semibold focus:outline-none"
          >
            <option value="">Mudar status...</option>
            {CONTACT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {bulkStatus && (
            <button
              type="button"
              onClick={() => handleBulk("set-status")}
              className="h-7 px-2.5 rounded-lg bg-brand-500 text-white font-bold hover:bg-brand-600 transition-colors"
            >
              Aplicar
            </button>
          )}

          <button
            type="button"
            onClick={() => handleBulk("delete")}
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

      {/* ── Plane Contacts Data Table ── */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-brand-500" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface py-20 text-center shadow-soft">
          <div className="size-12 rounded-2xl bg-surface-2 flex items-center justify-center text-text-muted">
            <Users className="size-6 text-brand-500" />
          </div>
          <p className="text-sm font-bold text-text-main">Nenhum contato encontrado</p>
          <p className="text-xs text-text-muted max-w-sm">
            {search || statusFilter !== "all" || tagFilter
              ? "Ajuste os filtros para encontrar outros contatos."
              : "Cadastre novos contatos ou sincronize leads do robô de prospecção."}
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-2 flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-xs font-bold text-white hover:bg-brand-600 shadow-soft"
          >
            <UserPlus className="size-4" /> Cadastrar Contato
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-soft">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs text-text-main">
              <thead className="border-b border-border bg-surface-2 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                <tr>
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="rounded border-border"
                    />
                  </th>
                  <th className="p-3.5">Contato</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Tags & Nicho</th>
                  <th className="p-3.5">Empresa</th>
                  <th className="p-3.5">Canais Diretos</th>
                  <th className="p-3.5 text-right">Atualização</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {contacts.map((contact) => {
                  const sm = statusMeta(contact.status);
                  const waUrl = formatWhatsAppUrl(contact.phone);
                  const isSel = selected.has(contact.id);

                  return (
                    <tr
                      key={contact.id}
                      className={`hover:bg-surface-2/60 transition-colors group ${
                        isSel ? "bg-brand-500/5" : ""
                      }`}
                    >
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleSelect(contact.id)}
                          className="rounded border-border"
                        />
                      </td>

                      <td className="p-3.5">
                        <Link
                          href={`/dashboard/crm/contacts/${contact.id}`}
                          className="flex items-center gap-3"
                        >
                          <div className={`size-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(contact.name)}`}>
                            {initials(contact.name)}
                          </div>
                          <div className="min-w-0">
                            <span className="block font-bold text-text-main group-hover:text-brand-400 transition-colors truncate max-w-[200px]">
                              {contact.name}
                            </span>
                            {contact.email && (
                              <span className="block text-[11px] text-text-muted truncate max-w-[200px]">
                                {contact.email}
                              </span>
                            )}
                          </div>
                        </Link>
                      </td>

                      <td className="p-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${sm.bg} ${sm.text}`}>
                          {sm.label}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <div className="flex max-w-[200px] flex-wrap gap-1">
                          {(contact.tags || []).slice(0, 2).map((tag) => {
                            const tm = tagMeta(tag);
                            return (
                              <span key={tag} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${tm.bg} ${tm.text}`}>
                                {tag}
                              </span>
                            );
                          })}
                          {(contact.tags || []).length > 2 && (
                            <span className="text-[10px] text-text-muted">
                              +{(contact.tags || []).length - 2}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 text-text-muted font-medium">
                        {contact.company ? (
                          <div className="flex items-center gap-1.5 truncate max-w-[140px]">
                            <Building2 className="size-3 text-text-muted/60" />
                            <span>{contact.company}</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center size-7 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                              title={`WhatsApp (${contact.phone})`}
                            >
                              <MessageSquare className="size-3.5" />
                            </a>
                          )}
                          {contact.email && (
                            <a
                              href={`mailto:${contact.email}`}
                              className="flex items-center justify-center size-7 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                              title={`Email (${contact.email})`}
                            >
                              <Mail className="size-3.5" />
                            </a>
                          )}
                          <Link
                            href={`/dashboard/crm/contacts/${contact.id}`}
                            className="flex items-center justify-center size-7 rounded-lg bg-surface-2 text-text-muted hover:text-text-main transition-colors"
                            title="Ver Perfil 360°"
                          >
                            <ExternalLink className="size-3.5" />
                          </Link>
                        </div>
                      </td>

                      <td className="p-3.5 text-right font-mono text-[11px] text-text-muted whitespace-nowrap">
                        {timeAgo(contact.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pagination ── */}
      {!loading && contacts.length > 0 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-main disabled:opacity-40 hover:bg-surface-2 transition-colors"
          >
            <ChevronLeft className="size-3.5" /> Anterior
          </button>
          <span className="text-xs font-mono text-text-muted">Página {page}</span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={contacts.length < PAGE_SIZE}
            className="flex items-center gap-1 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-main disabled:opacity-40 hover:bg-surface-2 transition-colors"
          >
            Próxima <ChevronRight className="size-3.5" />
          </button>
        </div>
      )}

      {/* ── Modal: Novo Contato ── */}
      {showForm && (
        <ContactForm onSave={handleCreate} onCancel={() => setShowForm(false)} />
      )}
    </div>
  );
}

function ContactForm({ onSave, onCancel, initial = {} }) {
  const [formData, setFormData] = useState({
    name: initial.name || "",
    email: initial.email || "",
    phone: initial.phone || "",
    company: initial.company || "",
    status: initial.status || "lead",
    notes: initial.notes || "",
    tags: initial.tags || [],
  });
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  function addTag() {
    const t = tagInput.trim();
    if (t && !formData.tags.includes(t)) {
      setFormData({ ...formData, tags: [...formData.tags, t] });
    }
    setTagInput("");
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    await onSave(formData);
    setSaving(false);
  }

  const inputCls =
    "h-9 w-full rounded-xl border border-border bg-surface-2 px-3 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold font-display text-text-main flex items-center gap-2">
              <UserPlus className="size-4 text-brand-500" />
              Novo Contato / Cliente
            </h2>
            <p className="text-xs text-text-muted">Cadastre um contato comercial para acompanhamento.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-text-muted hover:text-text-main text-xs"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-muted">Nome Completo / Estabelecimento *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              autoFocus
              placeholder="Ex.: Clínica Odontológica Sorriso / Dr. Paulo"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-muted">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contato@empresa.com"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-muted">WhatsApp / Telefone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(11) 99999-9999"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-muted">Empresa / Ramo</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="Ex.: Odontologia / Saúde"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-muted">Status do Lead</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className={inputCls}
              >
                {CONTACT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-muted">Tags</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Digite a tag e pressione Enter"
                className="h-9 flex-1 rounded-xl border border-border bg-surface-2 px-3 text-xs text-text-main focus:border-brand-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={addTag}
                className="h-9 px-3 rounded-xl border border-border bg-surface text-text-muted hover:text-brand-500 text-xs font-bold"
              >
                + Tag
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {formData.tags.map((t) => {
                  const tm = tagMeta(t);
                  return (
                    <span key={t} className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${tm.bg} ${tm.text}`}>
                      {t}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, tags: formData.tags.filter((x) => x !== t) })}
                        className="opacity-60 hover:opacity-100"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-muted">Notas & Histórico Inicial</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Informações sobre o cliente, origem ou necessidades..."
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
              <span>Cadastrar Contato</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
