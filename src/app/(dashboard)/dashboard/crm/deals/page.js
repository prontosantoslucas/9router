"use client";

import { useState, useEffect } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Plus, Download, Trash2, CheckSquare, Square, ArrowRightLeft } from "lucide-react";

const STAGES = [
  { id: "lead", name: "Lead", color: "bg-gray-100" },
  { id: "qualified", name: "Qualificado", color: "bg-blue-100" },
  { id: "proposal", name: "Proposta", color: "bg-yellow-100" },
  { id: "negotiation", name: "Negociação", color: "bg-orange-100" },
  { id: "won", name: "Ganho", color: "bg-green-100" },
  { id: "lost", name: "Perdido", color: "bg-red-100" },
];

export default function DealsKanbanPage() {
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState({});
  const [activeDeal, setActiveDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedStage, setSelectedStage] = useState("lead");
  const [selected, setSelected] = useState(new Set());
  const [moveTarget, setMoveTarget] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchDeals();
  }, []);

  async function fetchDeals() {
    try {
      setLoading(true);
      const res = await fetch("/api/crm/deals");
      const data = await res.json();
      setDeals(data.deals || []);

      const contactIds = [...new Set(data.deals.map((d) => d.contactId))];
      const contactsData = {};
      
      await Promise.all(
        contactIds.map(async (id) => {
          const res = await fetch(`/api/crm/contacts/${id}`);
          const data = await res.json();
          if (data.contact) contactsData[id] = data.contact;
        })
      );
      
      setContacts(contactsData);
    } catch (error) {
      console.error("Erro ao buscar deals:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      setActiveDeal(null);
      return;
    }

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
          prev.map((deal) =>
            deal.id === dealId ? { ...deal, stage: newStage } : deal
          )
        );
      }
    } catch (error) {
      console.error("Erro ao atualizar deal:", error);
    }

    setActiveDeal(null);
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

      if (res.ok) {
        setShowForm(false);
        fetchDeals();
      }
    } catch (error) {
      console.error("Erro ao criar deal:", error);
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
    }
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Deletar ${selected.size} negócio(s)?`)) return;
    const res = await fetch("/api/crm/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", ids: [...selected], type: "deals" }),
    });
    if (res.ok) {
      setSelected(new Set());
      fetchDeals();
    }
  }

  function handleExport() {
    const link = document.createElement("a");
    link.href = "/api/crm/export?type=deals";
    link.click();
  }

  const dealsByStage = STAGES.reduce((acc, stage) => {
    acc[stage.id] = deals.filter((deal) => deal.stage === stage.id);
    return acc;
  }, {});

  if (loading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Pipeline de Vendas</h1>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 text-gray-700"
          title="Exportar negócios (CSV)"
        >
          <Download size={18} />
          CSV
        </button>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <span className="text-sm font-medium text-blue-700">{selected.size} selecionado(s)</span>
          <select
            value={moveTarget}
            onChange={(e) => setMoveTarget(e.target.value)}
            className="text-xs px-2 py-1 border border-blue-300 rounded bg-white"
          >
            <option value="">Mover para...</option>
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            onClick={handleBulkMove}
            disabled={!moveTarget}
            className="flex items-center gap-1 text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            <ArrowRightLeft size={14} /> Mover
          </button>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1 text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
          >
            <Trash2 size={14} /> Deletar
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-gray-500 hover:underline ml-auto"
          >
            Limpar
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              deals={dealsByStage[stage.id] || []}
              contacts={contacts}
              selected={selected}
              onToggleSelect={toggleSelect}
              onAddDeal={() => {
                setSelectedStage(stage.id);
                setShowForm(true);
              }}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDeal ? (
            <DealCard
              deal={activeDeal}
              contact={contacts[activeDeal.contactId]}
              isDragging
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {showForm && (
        <DealFormWithContact
          onSave={handleCreateDeal}
          onCancel={() => setShowForm(false)}
          stage={selectedStage}
        />
      )}
    </div>
  );
}

function KanbanColumn({ stage, deals, contacts, selected, onToggleSelect, onAddDeal }) {
  const totalValue = deals.reduce((sum, deal) => sum + deal.valueCents, 0);

  return (
    <div className="flex-shrink-0 w-80">
      <div className={`${stage.color} rounded-lg p-4 mb-3`}>
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-bold text-lg">{stage.name}</h2>
          <span className="bg-white px-2 py-1 rounded text-sm font-semibold">
            {deals.length}
          </span>
        </div>
        <div className="text-sm font-medium">
          ${(totalValue / 100).toFixed(2)}
        </div>
      </div>

      <div
        id={stage.id}
        className="space-y-3 min-h-[500px] bg-gray-50 rounded-lg p-3"
      >
        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            contact={contacts[deal.contactId]}
            isSelected={selected.has(deal.id)}
            onToggle={() => onToggleSelect(deal.id)}
          />
        ))}

        <button
          onClick={onAddDeal}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          Adicionar
        </button>
      </div>
    </div>
  );
}

function DealCard({ deal, contact, isDragging, isSelected, onToggle }) {
  return (
    <div
      id={deal.id}
      className={`bg-white p-4 rounded-lg border cursor-move hover:shadow-md transition-shadow ${
        isDragging ? "opacity-50" : ""
      } ${isSelected ? "border-blue-400 ring-1 ring-blue-300" : "border-gray-200"}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold">{deal.title}</h3>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle && onToggle();
          }}
          className="text-gray-400 hover:text-blue-600 shrink-0"
          title={isSelected ? "Deselecionar" : "Selecionar"}
        >
          {isSelected ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} />}
        </button>
      </div>
      
      {contact && (
        <p className="text-sm text-gray-600 mb-2">{contact.name}</p>
      )}
      
      <div className="flex justify-between items-center text-sm">
        <span className="font-medium text-green-600">
          ${(deal.valueCents / 100).toFixed(2)}
        </span>
        <span className="text-gray-500">
          {new Date(deal.createdAt).toLocaleDateString("pt-BR")}
        </span>
      </div>

      {deal.notes && (
        <p className="text-xs text-gray-500 mt-2 line-clamp-2">{deal.notes}</p>
      )}
    </div>
  );
}

function DealFormWithContact({ onSave, onCancel, stage }) {
  const [contacts, setContacts] = useState([]);
  const [formData, setFormData] = useState({
    contactId: "",
    title: "",
    valueCents: 0,
    notes: "",
  });

  useEffect(() => {
    fetchContacts();
  }, []);

  async function fetchContacts() {
    try {
      const res = await fetch("/api/crm/contacts?limit=1000");
      const data = await res.json();
      setContacts(data.contacts || []);
    } catch (error) {
      console.error("Erro ao buscar contatos:", error);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave(formData);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">Novo Negócio - {stage}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Contato *</label>
            <select
              required
              value={formData.contactId}
              onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione um contato</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name} {contact.company ? `(${contact.company})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Título *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Valor ($)</label>
            <input
              type="number"
              step="0.01"
              value={formData.valueCents / 100}
              onChange={(e) =>
                setFormData({ ...formData, valueCents: Math.round(parseFloat(e.target.value) * 100) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
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
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
