"use client";

import { useState, useEffect } from "react";
import {
  CreditCard, ExternalLink, Plus, Copy, Trash2, CheckCircle,
  XCircle, Clock, Loader2, Settings, Link2,
} from "lucide-react";

export default function BillingPage() {
  const [checkouts, setCheckouts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      setLoading(true);
      const [ckRes, ctRes, intRes] = await Promise.all([
        fetch("/api/crm/checkouts"),
        fetch("/api/crm/contacts?limit=1000"),
        fetch("/api/crm/integrations"),
      ]);

      const ckData = await ckRes.json();
      const ctData = await ctRes.json();
      const intData = await intRes.json();

      setCheckouts(ckData.checkouts || []);
      setContacts(ctData.contacts || []);
      setIntegrations(intData.integrations || []);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(formData) {
    try {
      const res = await fetch("/api/crm/checkouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowCreate(false);
      await fetchAll();
      return data;
    } catch (error) {
      alert(error.message);
      return null;
    }
  }

  async function handleConfig(provider, config) {
    try {
      const res = await fetch("/api/crm/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, name: provider, config }),
      });
      if (!res.ok) throw new Error("Erro ao salvar configuraÃ§Ã£o");
      setShowConfig(false);
      await fetchAll();
      alert("Gateway configurado com sucesso!");
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleDeleteIntegration(id) {
    if (!confirm("Remover este gateway?")) return;
    await fetch(`/api/crm/integrations?id=${id}`, { method: "DELETE" });
    await fetchAll();
  }

  async function copyLink(url) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(url);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* noop */ }
  }

  const activeProviders = integrations.filter((i) => i.isActive).map((i) => i.provider);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Faturamento & Checkout</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowConfig(true)}
            className="flex items-center gap-2 bg-bg-alt hover:bg-bg-alt text-text-main px-4 py-2 rounded-lg"
          >
            <Settings size={18} />
            Gateways
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg"
          >
            <Plus size={18} />
            Gerar Link de Checkout
          </button>
        </div>
      </div>

      {/* Status dos gateways */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {["stripe", "paypal", "mercadolivre"].map((provider) => {
          const int = integrations.find((i) => i.provider === provider);
          const active = int?.isActive;
          return (
            <div
              key={provider}
              className={`bg-surface rounded-lg border p-4 ${
                active ? "border-label-emerald-bg" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold capitalize">
                  {provider === "mercadolivre" ? "Mercado Livre" : provider}
                </span>
                {active ? (
                  <span className="flex items-center gap-1 text-xs text-label-emerald">
                    <CheckCircle size={14} /> Conectado
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-text-subtle">
                    <XCircle size={14} /> NÃ£o configurado
                  </span>
                )}
              </div>
              {int && (
                <button
                  onClick={() => handleDeleteIntegration(int.id)}
                  className="text-xs text-red-500 hover:underline flex items-center gap-1"
                >
                  <Trash2 size={12} /> Remover
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Lista de checkouts */}
      <h2 className="text-xl font-bold mb-4">Links Gerados</h2>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="animate-spin mx-auto text-brand-600" size={32} />
        </div>
      ) : checkouts.length === 0 ? (
        <div className="bg-surface rounded-lg p-12 border text-center">
          <Link2 size={48} className="mx-auto text-text-subtle mb-4" />
          <p className="text-text-muted">Nenhum link de checkout gerado ainda</p>
          <p className="text-sm text-text-subtle mt-2">
            Clique em "Gerar Link de Checkout" para criar o primeiro
          </p>
        </div>
      ) : (
        <div className="bg-surface rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-alt border-b">
              <tr>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">DescriÃ§Ã£o</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Link</th>
              </tr>
            </thead>
            <tbody>
              {checkouts.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-bg-alt">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.contactName}</div>
                    {c.contactEmail && <div className="text-xs text-text-muted">{c.contactEmail}</div>}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{c.description}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    R$ {(c.amountCents / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <a
                        href={`/checkout/${c.id}`}
                        target="_blank"
                        rel="noopener"
                        className="text-brand-600 hover:text-brand-700"
                        title="Abrir checkout"
                      >
                        <ExternalLink size={16} />
                      </a>
                      <button
                        onClick={() => copyLink(`${window.location.origin}/checkout/${c.id}`)}
                        className="text-text-muted hover:text-text-main"
                        title="Copiar link"
                      >
                        {copiedId === `${window.location.origin}/checkout/${c.id}` ? (
                          <CheckCircle size={16} className="text-label-emerald" />
                        ) : (
                          <Copy size={16} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: criar checkout */}
      {showCreate && (
        <CreateCheckoutModal
          contacts={contacts}
          activeProviders={activeProviders}
          onSave={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Modal: configurar gateways */}
      {showConfig && (
        <ConfigGatewaysModal
          integrations={integrations}
          onSave={handleConfig}
          onCancel={() => setShowConfig(false)}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const config = {
    paid: { icon: CheckCircle, cls: "bg-label-emerald-bg text-label-emerald", label: "Pago" },
    pending: { icon: Clock, cls: "bg-label-yellow-bg text-label-yellow", label: "Pendente" },
    cancelled: { icon: XCircle, cls: "bg-bg-alt text-text-muted", label: "Cancelado" },
    failed: { icon: XCircle, cls: "bg-label-crimson-bg text-label-crimson", label: "Falhou" },
    expired: { icon: Clock, cls: "bg-bg-alt text-text-muted", label: "Expirado" },
  };
  const c = config[status] || config.pending;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${c.cls}`}>
      <Icon size={12} />
      {c.label}
    </span>
  );
}

function CreateCheckoutModal({ contacts, activeProviders, onSave, onCancel }) {
  const [form, setForm] = useState({
    contactId: "",
    amountCents: 0,
    currency: "BRL",
    description: "",
    provider: activeProviders[0] || "",
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">Gerar Link de Checkout</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const result = await onSave(form);
            if (result?.checkoutUrl) {
              if (confirm("Link criado! Copiar para a Ã¡rea de transferÃªncia?")) {
                navigator.clipboard.writeText(result.checkoutUrl);
              }
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Cliente *</label>
            <select
              required
              value={form.contactId}
              onChange={(e) => setForm({ ...form, contactId: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Selecione...</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ""}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Valor (R$) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={form.amountCents / 100}
              onChange={(e) => setForm({ ...form, amountCents: Math.round(parseFloat(e.target.value) * 100) })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">DescriÃ§Ã£o</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex: Assinatura mensal - Plano Pro"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Gateway</label>
            <select
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              {activeProviders.length === 0 ? (
                <option value="">Nenhum gateway configurado</option>
              ) : (
                activeProviders.map((p) => (
                  <option key={p} value={p}>{p === "mercadolivre" ? "Mercado Livre" : p}</option>
                ))
              )}
            </select>
            {activeProviders.length === 0 && (
              <p className="text-xs text-red-500 mt-1">
                Configure um gateway em "Gateways" antes de gerar links
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={activeProviders.length === 0}
              className="flex-1 bg-brand-500 text-white px-4 py-2 rounded-lg hover:bg-brand-600 disabled:opacity-50"
            >
              Gerar Link
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-bg-alt px-4 py-2 rounded-lg hover:bg-bg-alt"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfigGatewaysModal({ integrations, onSave, onCancel }) {
  const [provider, setProvider] = useState("stripe");
  const [form, setForm] = useState({ secretKey: "", clientId: "", clientSecret: "", accessToken: "" });

  const existing = integrations.find((i) => i.provider === provider);

  function switchProvider(p) {
    setProvider(p);
    const cfg = integrations.find((i) => i.provider === p)?.config || {};
    setForm({
      secretKey: cfg.secretKey || "",
      clientId: cfg.clientId || "",
      clientSecret: cfg.clientSecret || "",
      accessToken: cfg.accessToken || "",
    });
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Configurar Gateways de Pagamento</h2>

        <div className="flex gap-2 mb-6 p-1 bg-bg-alt rounded-lg">
          {["stripe", "paypal", "mercadolivre"].map((p) => (
            <button
              key={p}
              onClick={() => switchProvider(p)}
              className={`flex-1 py-2 text-sm font-medium rounded ${
                provider === p ? "bg-surface shadow" : "text-text-muted"
              }`}
            >
              {p === "mercadolivre" ? "Mercado Livre" : p === "stripe" ? "Stripe" : "PayPal"}
            </button>
          ))}
        </div>

        {existing && (
          <div className="mb-4 text-xs text-label-emerald flex items-center gap-1">
            <CheckCircle size={14} /> Gateway jÃ¡ configurado â€” salvar atualiza as credenciais
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const config = {};
            if (provider === "stripe") config.secretKey = form.secretKey;
            if (provider === "paypal") {
              config.clientId = form.clientId;
              config.clientSecret = form.clientSecret;
            }
            if (provider === "mercadolivre") config.accessToken = form.accessToken;
            onSave(provider, config);
          }}
          className="space-y-4"
        >
          {provider === "stripe" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Secret Key *</label>
                <input
                  type="password"
                  required
                  value={form.secretKey}
                  onChange={(e) => setForm({ ...form, secretKey: e.target.value })}
                  placeholder="sk_live_..."
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <p className="text-xs text-text-muted mt-1">
                  Obtenha em dashboard.stripe.com â†’ Developers â†’ API keys
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Webhook Secret (opcional)</label>
                <input
                  type="password"
                  value={form.webhookSecret || ""}
                  onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
                  placeholder="whsec_..."
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </>
          )}

          {provider === "paypal" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Client ID *</label>
                <input
                  type="text"
                  required
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  placeholder="Axxxxxxxx..."
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Client Secret *</label>
                <input
                  type="password"
                  required
                  value={form.clientSecret}
                  onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
                  placeholder="Exxxxxxxx..."
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </>
          )}

          {provider === "mercadolivre" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Access Token *</label>
                <input
                  type="password"
                  required
                  value={form.accessToken}
                  onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
                  placeholder="APP_USR-..."
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <p className="text-xs text-text-muted mt-1">
                  Obtenha em mercadopago.com.br â†’ Seu negÃ³cio â†’ Credenciais de produÃ§Ã£o
                </p>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button type="submit" className="flex-1 bg-brand-500 text-white px-4 py-2 rounded-lg hover:bg-brand-600">
              Salvar
            </button>
            <button type="button" onClick={onCancel} className="flex-1 bg-bg-alt px-4 py-2 rounded-lg hover:bg-bg-alt">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}