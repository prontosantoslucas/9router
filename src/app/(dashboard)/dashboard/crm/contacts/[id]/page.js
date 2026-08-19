"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Mail, Phone, Building2, DollarSign, Plus, Key, Clock } from "lucide-react";
import { useRouter } from "next/navigation";

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
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchContact();
    fetchDeals();
    fetchActivities();
    fetchApiKeys();
    fetchUsage();
  }, []);

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
      const res = await fetch(`/api/crm/activities?contactId=${id}&limit=20`);
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

      if (res.ok) {
        setShowDealForm(false);
        fetchDeals();
        fetchActivities();
      }
    } catch (error) {
      console.error("Erro ao criar deal:", error);
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
      }
    } catch (error) {
      console.error("Erro ao vincular key:", error);
    }
  }

  if (loading) return <div className="p-6">Carregando...</div>;
  if (!contact) return <div className="p-6">Contato não encontrado</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <button
        onClick={() => router.push("/dashboard/crm/contacts")}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={20} />
        Voltar
      </button>

      <div className="bg-white rounded-lg p-6 border border-gray-200 mb-6">
        <h1 className="text-3xl font-bold mb-4">{contact.name}</h1>
        <div className="flex gap-6 mb-4">
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-gray-600 hover:text-blue-600">
              <Mail size={18} />
              {contact.email}
            </a>
          )}
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-gray-600 hover:text-blue-600">
              <Phone size={18} />
              {contact.phone}
            </a>
          )}
          {contact.company && (
            <div className="flex items-center gap-2 text-gray-600">
              <Building2 size={18} />
              {contact.company}
            </div>
          )}
        </div>
        {contact.tags.length > 0 && (
          <div className="flex gap-2">
            {contact.tags.map((tag) => (
              <span key={tag} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">{tag}</span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")} label="Visão Geral" />
        <TabButton active={activeTab === "keys"} onClick={() => setActiveTab("keys")} label={`API Keys (${apiKeys.length})`} />
        <TabButton active={activeTab === "usage"} onClick={() => setActiveTab("usage")} label="Consumo" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {activeTab === "overview" && (
            <>
              {contact.notes && (
                <div className="bg-white rounded-lg p-6 border border-gray-200">
                  <h3 className="font-semibold mb-2">Notas</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{contact.notes}</p>
                </div>
              )}

              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Negócios</h2>
                  <button onClick={() => setShowDealForm(true)} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 text-sm">
                    <Plus size={16} /> Novo
                  </button>
                </div>
                {deals.length === 0 ? <p className="text-gray-500">Nenhum negócio</p> : (
                  <div className="space-y-3">
                    {deals.map((deal) => <DealCard key={deal.id} deal={deal} />)}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <h2 className="text-xl font-bold mb-4">Atividades</h2>
                {activities.length === 0 ? <p className="text-gray-500">Sem atividades</p> : (
                  <div className="space-y-4">
                    {activities.map((activity) => <ActivityItem key={activity.id} activity={activity} />)}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "keys" && (
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">API Keys Vinculadas</h2>
                <button onClick={() => setShowKeyForm(true)} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 text-sm">
                  <Plus size={16} /> Vincular
                </button>
              </div>
              {apiKeys.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nenhuma API key vinculada</p>
              ) : (
                <div className="space-y-3">
                  {apiKeys.map((key) => (
                    <div key={key.id} className="p-4 border rounded-lg flex justify-between items-center">
                      <div>
                        <div className="font-semibold">{key.name || "Sem nome"}</div>
                        <code className="text-xs text-gray-500">{key.key.substring(0, 16)}...</code>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-green-600">${(key.balanceCents / 100).toFixed(2)}</div>
                        <span className={`text-xs px-2 py-0.5 rounded ${key.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
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
            <div className="space-y-6">
              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <h2 className="text-xl font-bold mb-4">Consumo (30 dias)</h2>
                {!usageData ? <p>Carregando...</p> : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <UsageStat label="Requisições" value={usageData.totals.totalRequests || 0} />
                      <UsageStat label="Custo" value={`$${(usageData.totals.totalCost || 0).toFixed(4)}`} />
                      <UsageStat label="Prompt Tokens" value={(usageData.totals.totalPromptTokens || 0).toLocaleString()} />
                      <UsageStat label="Compl. Tokens" value={(usageData.totals.totalCompletionTokens || 0).toLocaleString()} />
                    </div>
                    
                    {usageData.usage.length === 0 ? (
                      <p className="text-gray-500">Sem dados</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="py-2 text-left">Data</th>
                              <th className="text-left">Modelo</th>
                              <th className="text-left">Reqs</th>
                              <th className="text-right">Custo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {usageData.usage.slice(0, 15).map((u, i) => (
                              <tr key={i} className="border-b">
                                <td className="py-2">{u.date}</td>
                                <td className="font-medium">{u.model}</td>
                                <td>{u.requests}</td>
                                <td className="text-right text-green-600">${u.cost.toFixed(4)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <h3 className="font-semibold mb-4">Stats</h3>
            <div className="space-y-3">
              <StatItem label="Negócios" value={stats?.dealsCount || 0} />
              <StatItem label="Valor Pipeline" value={`$${((stats?.dealsValue || 0) / 100).toFixed(2)}`} />
              <StatItem label="Ganhos" value={stats?.wonDeals || 0} />
              <StatItem label="API Keys" value={apiKeys.length} />
            </div>
          </div>

          {activities.length > 0 && (
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="font-semibold mb-3 text-sm uppercase text-gray-500">Última Atividade</h3>
              <div className="text-sm">
                <p className="font-medium">{activities[0].type}</p>
                <p className="text-gray-600">{activities[0].description}</p>
                <div className="flex items-center gap-1 text-gray-400 mt-2 text-xs">
                  <Clock size={12} />
                  {new Date(activities[0].createdAt).toLocaleString("pt-BR")}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showDealForm && <DealForm onSave={handleCreateDeal} onCancel={() => setShowDealForm(false)} />}
      {showKeyForm && <KeyForm onSave={handleLinkKey} onCancel={() => setShowKeyForm(false)} />}
    </div>
  );
}

function TabButton({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-[1px] ${
        active ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {label}
    </button>
  );
}

function StatItem({ label, value }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-600 text-sm">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function UsageStat({ label, value }) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function DealCard({ deal }) {
  const stageColors = {
    lead: "bg-gray-100 text-gray-700",
    qualified: "bg-blue-100 text-blue-700",
    proposal: "bg-yellow-100 text-yellow-700",
    negotiation: "bg-orange-100 text-orange-700",
    won: "bg-green-100 text-green-700",
    lost: "bg-red-100 text-red-700",
  };

  return (
    <div className="p-4 border rounded-lg">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold">{deal.title}</h3>
        <span className={`text-xs px-2 py-1 rounded ${stageColors[deal.stage]}`}>{deal.stage}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="font-medium text-green-600">${(deal.valueCents / 100).toFixed(2)}</span>
        <span className="text-gray-500">{new Date(deal.createdAt).toLocaleDateString("pt-BR")}</span>
      </div>
    </div>
  );
}

function ActivityItem({ activity }) {
  return (
    <div className="flex gap-3">
      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
      <div className="flex-1">
        <div className="flex justify-between">
          <span className="font-medium text-sm">{activity.type}</span>
          <span className="text-xs text-gray-500">{new Date(activity.createdAt).toLocaleString("pt-BR")}</span>
        </div>
        {activity.description && <p className="text-sm text-gray-600 mt-1">{activity.description}</p>}
      </div>
    </div>
  );
}

function DealForm({ onSave, onCancel }) {
  const [formData, setFormData] = useState({
    title: "",
    valueCents: 0,
    stage: "lead",
    notes: "",
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">Novo Negócio</h2>
        <form onSubmit={(e) => { e.preventDefault(); onSave(formData); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Título *</label>
            <input required type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Valor ($)</label>
            <input type="number" step="0.01" value={formData.valueCents / 100} onChange={(e) => setFormData({ ...formData, valueCents: Math.round(parseFloat(e.target.value) * 100) })} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Stage</label>
            <select value={formData.stage} onChange={(e) => setFormData({ ...formData, stage: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
              <option value="lead">Lead</option>
              <option value="qualified">Qualified</option>
              <option value="proposal">Proposal</option>
              <option value="negotiation">Negotiation</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notas</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="submit" className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Salvar</button>
            <button type="button" onClick={onCancel} className="flex-1 bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function KeyForm({ onSave, onCancel }) {
  const [existingKeys, setExistingKeys] = useState([]);
  const [formData, setFormData] = useState({ existingKeyId: "", name: "", machineId: "" });
  const [mode, setMode] = useState("link");

  useEffect(() => {
    fetch("/api/keys").then(r => r.json()).then(d => setExistingKeys(d.keys || [])).catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">Vincular API Key</h2>
        <div className="flex gap-2 mb-4 p-1 bg-gray-100 rounded">
          <button onClick={() => setMode("link")} className={`flex-1 py-1.5 text-xs font-medium rounded ${mode === "link" ? "bg-white shadow" : ""}`}>Existente</button>
          <button onClick={() => setMode("new")} className={`flex-1 py-1.5 text-xs font-medium rounded ${mode === "new" ? "bg-white shadow" : ""}`}>Nova</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(formData); }} className="space-y-4">
          {mode === "link" ? (
            <div>
              <label className="block text-sm font-medium mb-1">Key</label>
              <select required value={formData.existingKeyId} onChange={(e) => setFormData({ ...formData, existingKeyId: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                <option value="">Selecione...</option>
                {existingKeys.map(k => <option key={k.id} value={k.id}>{k.name || k.key.substring(0, 16)}...</option>)}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Nome</label>
                <input required type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Machine ID</label>
                <input required type="text" value={formData.machineId} onChange={(e) => setFormData({ ...formData, machineId: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </>
          )}
          <div className="flex gap-3 pt-4">
            <button type="submit" className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Salvar</button>
            <button type="button" onClick={onCancel} className="flex-1 bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
