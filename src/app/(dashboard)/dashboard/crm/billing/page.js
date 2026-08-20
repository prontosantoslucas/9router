"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CreditCard, ExternalLink, Plus, Copy, Trash2, CheckCircle,
  XCircle, Clock, Loader2, Settings, Link2, DollarSign,
  Sparkles, RefreshCw, ShieldCheck, ArrowLeft, Send
} from "lucide-react";
import { formatCurrency, formatDate, timeAgo } from "../crmMeta";

export default function CRMBillingPage() {
  const [checkouts, setCheckouts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  function notify(text) {
    setToastMsg(text);
    setTimeout(() => setToastMsg(null), 3000);
  }

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
      notify("✓ Link de checkout gerado com sucesso!");
      return data;
    } catch (error) {
      notify(`Erro: ${error.message}`);
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
      if (!res.ok) throw new Error("Erro ao salvar configuração");
      setShowConfig(false);
      await fetchAll();
      notify("✓ Gateway configurado com sucesso!");
    } catch (error) {
      notify(`Erro: ${error.message}`);
    }
  }

  async function handleDeleteIntegration(id) {
    if (!confirm("Remover este gateway?")) return;
    await fetch(`/api/crm/integrations?id=${id}`, { method: "DELETE" });
    await fetchAll();
    notify("Gateway removido.");
  }

  async function copyLink(url) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(url);
      notify("✓ Link copiado para a área de transferência!");
      setTimeout(() => setCopiedId(null), 2500);
    } catch { /* noop */ }
  }

  const activeProviders = integrations.filter((i) => i.isActive).map((i) => i.provider);

  const totalReceived = checkouts
    .filter((c) => c.status === "paid")
    .reduce((acc, c) => acc + (c.amountCents || 0), 0);

  const totalPending = checkouts
    .filter((c) => c.status === "pending")
    .reduce((acc, c) => acc + (c.amountCents || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-brand-500/30 bg-surface-2 px-4 py-2.5 text-xs font-semibold text-text-main shadow-elevated animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="size-4 text-brand-500" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ── Top Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
            <Link href="/dashboard/crm" className="hover:text-text-main transition-colors">CRM</Link>
            <span>/</span>
            <span className="font-semibold text-brand-400">Checkout & Cobranças</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black font-display text-text-main tracking-tight flex items-center gap-2.5">
            <CreditCard className="size-6 text-brand-500" />
            Faturamento Direto & Links de Pagamento
          </h1>
          <p className="text-xs text-text-muted">
            Gere links de pagamento rápidos e acompanhe o status de recebimentos via Pix e Cartão.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowConfig(true)}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-bold text-text-main hover:bg-surface-2 transition-colors"
          >
            <Settings className="size-3.5 text-brand-500" />
            <span>Configurar Gateways</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-soft hover:opacity-90 transition-opacity"
          >
            <Plus className="size-3.5" />
            <span>Gerar Link de Checkout</span>
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="rounded-2xl border border-border bg-surface p-4 space-y-1 shadow-soft">
          <div className="flex items-center justify-between text-xs font-semibold text-text-muted">
            <span>Recebido (Pagos)</span>
            <CheckCircle className="size-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black font-display text-emerald-400">
            {formatCurrency(totalReceived)}
          </div>
          <p className="text-[11px] text-text-muted">
            {checkouts.filter((c) => c.status === "paid").length} pagamento(s) confirmado(s)
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 space-y-1 shadow-soft">
          <div className="flex items-center justify-between text-xs font-semibold text-text-muted">
            <span>Aguardando Pagamento</span>
            <Clock className="size-4 text-orange-400" />
          </div>
          <div className="text-xl font-black font-display text-text-main">
            {formatCurrency(totalPending)}
          </div>
          <p className="text-[11px] text-text-muted">
            {checkouts.filter((c) => c.status === "pending").length} link(s) pendente(s)
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 space-y-1 shadow-soft">
          <div className="flex items-center justify-between text-xs font-semibold text-text-muted">
            <span>Total de Links Criados</span>
            <Link2 className="size-4 text-purple-400" />
          </div>
          <div className="text-xl font-black font-display text-text-main">
            {checkouts.length}
          </div>
          <p className="text-[11px] text-text-muted">Histórico de cobranças geradas</p>
        </div>
      </div>

      {/* ── Gateway Status Cards ── */}
      <div className="rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-soft">
        <h2 className="text-sm font-bold font-display text-text-main flex items-center gap-2 border-b border-border pb-3">
          <ShieldCheck className="size-4 text-brand-500" />
          Gateways de Pagamento Habilitados
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {[
            { id: "mercadopago", name: "Mercado Pago (Pix & Cartão)" },
            { id: "stripe", name: "Stripe Global" },
            { id: "paypal", name: "PayPal" },
          ].map((provider) => {
            const int = integrations.find((i) => i.provider === provider.id);
            const active = int?.isActive;

            return (
              <div
                key={provider.id}
                className={`p-4 rounded-xl border transition-all ${
                  active
                    ? "bg-surface-2 border-emerald-500/30"
                    : "bg-surface-2/40 border-border"
                } space-y-2 flex flex-col justify-between`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-main">{provider.name}</span>
                  {active ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-label-emerald-bg text-label-emerald flex items-center gap-1">
                      <CheckCircle className="size-3" /> Conectado
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface text-text-muted border border-border">
                      Não configurado
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px]">
                  {int ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteIntegration(int.id)}
                      className="text-crimson-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Trash2 className="size-3" /> Desconectar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowConfig(true)}
                      className="text-brand-400 hover:text-brand-300 font-bold"
                    >
                      + Configurar chaves
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Checkouts List ── */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-soft">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-bold font-display text-text-main flex items-center gap-2">
            <Link2 className="size-4 text-brand-500" />
            Links de Checkout Gerados
          </h2>
          <span className="text-xs font-mono text-text-muted">{checkouts.length} link(s)</span>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="size-7 animate-spin mx-auto text-brand-500" />
          </div>
        ) : checkouts.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="size-12 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto text-text-muted">
              <Link2 className="size-6 text-brand-500" />
            </div>
            <p className="text-sm font-bold text-text-main">Nenhum link de checkout gerado ainda</p>
            <p className="text-xs text-text-muted">Clique em "Gerar Link de Checkout" para criar o primeiro.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs text-text-main">
              <thead className="border-b border-border bg-surface-2 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Cliente</th>
                  <th className="p-3.5">Descrição</th>
                  <th className="p-3.5 text-right">Valor</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {checkouts.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-2/60 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-text-main">{c.contactName || "Cliente"}</div>
                      {c.contactEmail && <div className="text-[11px] text-text-muted">{c.contactEmail}</div>}
                    </td>
                    <td className="p-3.5 text-text-muted max-w-[240px] truncate">{c.description}</td>
                    <td className="p-3.5 text-right font-mono font-bold text-text-main">
                      {formatCurrency(c.amountCents, c.currency)}
                    </td>
                    <td className="p-3.5 text-center">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <a
                          href={`/checkout/${c.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="size-7 rounded-lg bg-surface-2 flex items-center justify-center text-brand-400 hover:text-brand-300 hover:bg-surface-3 transition-colors"
                          title="Abrir página de checkout"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => copyLink(`${typeof window !== "undefined" ? window.location.origin : ""}/checkout/${c.id}`)}
                          className="size-7 rounded-lg bg-surface-2 flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface-3 transition-colors"
                          title="Copiar link"
                        >
                          {copiedId === `${typeof window !== "undefined" ? window.location.origin : ""}/checkout/${c.id}` ? (
                            <CheckCircle className="size-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="size-3.5" />
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
      </div>

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
    cancelled: { icon: XCircle, cls: "bg-surface text-text-muted", label: "Cancelado" },
    failed: { icon: XCircle, cls: "bg-label-crimson-bg text-label-crimson", label: "Falhou" },
    expired: { icon: Clock, cls: "bg-surface text-text-muted", label: "Expirado" },
  };
  const c = config[status] || config.pending;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${c.cls}`}>
      <Icon className="size-3" />
      <span>{c.label}</span>
    </span>
  );
}

function CreateCheckoutModal({ contacts, activeProviders, onSave, onCancel }) {
  const [form, setForm] = useState({
    contactId: "",
    amountCents: 5000,
    currency: "BRL",
    description: "Assinatura Mensal / Serviço",
    provider: activeProviders[0] || "mercadopago",
  });
  const [saving, setSaving] = useState(false);

  const inputCls =
    "h-9 w-full rounded-xl border border-border bg-surface-2 px-3 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand-500";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div className="bg-surface rounded-2xl border border-border p-6 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-sm font-bold font-display text-text-main flex items-center gap-2">
            <Plus className="size-4 text-brand-500" />
            Gerar Link de Checkout
          </h2>
          <button type="button" onClick={onCancel} className="text-xs text-text-muted hover:text-text-main">✕</button>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            const result = await onSave(form);
            setSaving(false);
            if (result?.checkoutUrl) {
              navigator.clipboard.writeText(result.checkoutUrl);
            }
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Cliente *</label>
            <select
              required
              value={form.contactId}
              onChange={(e) => setForm({ ...form, contactId: e.target.value })}
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
            <label className="block text-xs font-semibold text-text-muted mb-1">Descrição da Cobrança *</label>
            <input
              type="text"
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex.: Implantação de Agente IA + Mensalidade"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0.5"
                required
                value={form.amountCents / 100}
                onChange={(e) =>
                  setForm({ ...form, amountCents: Math.round((parseFloat(e.target.value) || 0) * 100) })
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Gateway</label>
              <select
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                className={inputCls}
              >
                <option value="mercadopago">Mercado Pago (Pix)</option>
                <option value="stripe">Stripe</option>
                <option value="paypal">PayPal</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 h-9 rounded-xl border border-border bg-surface text-xs font-bold text-text-main hover:bg-surface-2 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-9 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-xs font-bold text-white shadow-soft hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              <span>Gerar & Copiar Link</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfigGatewaysModal({ integrations, onSave, onCancel }) {
  const [selectedProvider, setSelectedProvider] = useState("mercadopago");
  const [config, setConfig] = useState({});

  useEffect(() => {
    const int = integrations.find((i) => i.provider === selectedProvider);
    setConfig(int?.config || {});
  }, [selectedProvider, integrations]);

  const inputCls =
    "h-9 w-full rounded-xl border border-border bg-surface-2 px-3 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand-500";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div className="bg-surface rounded-2xl border border-border p-6 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-sm font-bold font-display text-text-main flex items-center gap-2">
            <Settings className="size-4 text-brand-500" />
            Configurar Gateway de Pagamento
          </h2>
          <button type="button" onClick={onCancel} className="text-xs text-text-muted hover:text-text-main">✕</button>
        </div>

        <div className="flex gap-1 bg-surface-2 p-1 rounded-xl">
          {[
            { id: "mercadopago", label: "Mercado Pago" },
            { id: "stripe", label: "Stripe" },
            { id: "paypal", label: "PayPal" },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedProvider(p.id)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                selectedProvider === p.id
                  ? "bg-brand-500 text-white shadow-soft"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(selectedProvider, config);
          }}
          className="space-y-3"
        >
          {selectedProvider === "mercadopago" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Access Token *</label>
                <input
                  type="password"
                  required
                  value={config.accessToken || ""}
                  onChange={(e) => setConfig({ ...config, accessToken: e.target.value })}
                  placeholder="APP_USR-..."
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Public Key</label>
                <input
                  type="text"
                  value={config.publicKey || ""}
                  onChange={(e) => setConfig({ ...config, publicKey: e.target.value })}
                  placeholder="APP_USR-..."
                  className={inputCls}
                />
              </div>
            </>
          )}

          {selectedProvider === "stripe" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Secret Key *</label>
                <input
                  type="password"
                  required
                  value={config.secretKey || ""}
                  onChange={(e) => setConfig({ ...config, secretKey: e.target.value })}
                  placeholder="sk_live_..."
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Publishable Key</label>
                <input
                  type="text"
                  value={config.publishableKey || ""}
                  onChange={(e) => setConfig({ ...config, publishableKey: e.target.value })}
                  placeholder="pk_live_..."
                  className={inputCls}
                />
              </div>
            </>
          )}

          {selectedProvider === "paypal" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Client ID *</label>
                <input
                  type="text"
                  required
                  value={config.clientId || ""}
                  onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Client Secret *</label>
                <input
                  type="password"
                  required
                  value={config.clientSecret || ""}
                  onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
                  className={inputCls}
                />
              </div>
            </>
          )}

          <div className="flex gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 h-9 rounded-xl border border-border bg-surface text-xs font-bold text-text-main hover:bg-surface-2 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 h-9 rounded-xl bg-brand-500 text-xs font-bold text-white hover:bg-brand-600 transition-colors"
            >
              Salvar Credenciais
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}