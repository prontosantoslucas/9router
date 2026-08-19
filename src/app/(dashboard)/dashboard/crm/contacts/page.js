"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Plus, Search, Download, Trash2, Tag, CheckSquare, Square,
  ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";

const PAGE_SIZE = 24;

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [bulkTag, setBulkTag] = useState("");
  const [bulkAction, setBulkAction] = useState("");

  useEffect(() => {
    fetchContacts();
  }, [search, tagFilter, page]);

  async function fetchContacts() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
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

  async function handleCreate(formData) {
    try {
      const res = await fetch("/api/crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowForm(false);
        fetchContacts();
      }
    } catch (error) {
      console.error("Erro ao criar contato:", error);
    }
  }

  async function handleExport() {
    const type = bulkAction === "export-deals" ? "deals" : "contacts";
    const url = `/api/crm/export?type=${type}`;
    const link = document.createElement("a");
    link.href = url;
    link.click();
  }

  async function handleBulk(action) {
    if (selected.size === 0) return;

    if (action === "delete") {
      if (!confirm(`Deletar ${selected.size} contato(s)? Esta ação é irreversível.`)) return;
      await fetch("/api/crm/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids: [...selected] }),
      });
    } else if (action === "add-tag") {
      const tag = prompt("Tag para adicionar:");
      if (!tag) return;
      await fetch("/api/crm/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add-tag", ids: [...selected], tag }),
      });
    } else if (action === "remove-tag") {
      const tag = prompt("Tag para remover:");
      if (!tag) return;
      await fetch("/api/crm/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove-tag", ids: [...selected], tag }),
      });
    }

    setSelected(new Set());
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

  const allSelected = contacts.length > 0 && selected.size === contacts.length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Contatos CRM</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Novo Contato
        </button>
      </div>

      {/* Barra de busca + export */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por nome, email ou empresa..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => handleExport()}
          className="flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 text-gray-700"
          title="Exportar contatos (CSV)"
        >
          <Download size={18} />
          CSV
        </button>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 animate-in fade-in">
          <span className="text-sm font-medium text-blue-700">{selected.size} selecionado(s)</span>
          <button
            onClick={() => handleBulk("add-tag")}
            className="flex items-center gap-1 text-xs bg-white border border-blue-300 px-2 py-1 rounded hover:bg-blue-100 text-blue-700"
          >
            <Tag size={14} /> Adicionar tag
          </button>
          <button
            onClick={() => handleBulk("remove-tag")}
            className="flex items-center gap-1 text-xs bg-white border border-blue-300 px-2 py-1 rounded hover:bg-blue-100 text-blue-700"
          >
            <Tag size={14} /> Remover tag
          </button>
          <button
            onClick={() => handleBulk("delete")}
            className="flex items-center gap-1 text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
          >
            <Trash2 size={14} /> Deletar
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-gray-500 hover:underline ml-auto"
          >
            Limpar seleção
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 flex justify-center">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          Nenhum contato encontrado
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              selected={selected.has(contact.id)}
              onToggle={() => toggleSelect(contact.id)}
            />
          ))}
        </div>
      )}

      {/* Paginação */}
      {!loading && contacts.length > 0 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
          >
            <ChevronLeft size={16} /> Anterior
          </button>
          <span className="text-sm text-gray-600">Página {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={contacts.length < PAGE_SIZE}
            className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
          >
            Próxima <ChevronRight size={16} />
          </button>
        </div>
      )}

      {showForm && (
        <ContactForm onSave={handleCreate} onCancel={() => setShowForm(false)} />
      )}
    </div>
  );
}

function ContactCard({ contact, selected, onToggle }) {
  return (
    <div className={`relative p-4 border rounded-lg transition-shadow bg-white hover:shadow-lg ${selected ? "border-blue-400 ring-1 ring-blue-300" : "border-gray-200"}`}>
      <button
        onClick={onToggle}
        className="absolute top-3 right-3 text-gray-400 hover:text-blue-600"
        title={selected ? "Deselecionar" : "Selecionar"}
      >
        {selected ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
      </button>

      <a href={`/dashboard/crm/contacts/${contact.id}`} className="block">
        <div className="flex items-start justify-between mb-3 pr-8">
          <h3 className="font-semibold text-lg">{contact.name}</h3>
        </div>

        {contact.email && (
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <span className="truncate">{contact.email}</span>
          </div>
        )}

        {contact.company && (
          <div className="text-sm text-gray-500 mb-2">{contact.company}</div>
        )}

        {contact.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {contact.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                {tag}
              </span>
            ))}
            {contact.tags.length > 3 && (
              <span className="text-[10px] text-gray-400">+{contact.tags.length - 3}</span>
            )}
          </div>
        )}
      </a>
    </div>
  );
}

function ContactForm({ onSave, onCancel, initial = {} }) {
  const [formData, setFormData] = useState({
    name: initial.name || "",
    email: initial.email || "",
    phone: initial.phone || "",
    company: initial.company || "",
    notes: initial.notes || "",
    tags: initial.tags || [],
  });

  const [tagInput, setTagInput] = useState("");

  function addTag() {
    const t = tagInput.trim();
    if (t && !formData.tags.includes(t)) {
      setFormData({ ...formData, tags: [...formData.tags, t] });
    }
    setTagInput("");
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Novo Contato</h2>

        <form onSubmit={(e) => { e.preventDefault(); onSave(formData); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Telefone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Empresa</label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tags</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Digite e Enter"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
              />
              <button type="button" onClick={addTag} className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
                <Tag size={16} />
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {formData.tags.map((t) => (
                  <span key={t} className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    {t}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, tags: formData.tags.filter((x) => x !== t) })}
                      className="hover:text-red-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notas</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="submit" className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              Salvar
            </button>
            <button type="button" onClick={onCancel} className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}