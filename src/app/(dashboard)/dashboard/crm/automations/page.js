"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  AlertTriangle, CheckCircle, Info, XCircle, RefreshCw, Plus, Trash2,
  Zap, Bell, ArrowLeft, Sparkles, ShieldCheck, Globe
} from "lucide-react";

export default function AutomationsPage() {
  const [alerts, setAlerts] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [activeTab, setActiveTab] = useState("alerts");
  const [toastMsg, setToastMsg] = useState(null);

  useEffect(() => {
    fetchAlerts();
    fetchWebhooks();
  }, []);

  function notify(text) {
    setToastMsg(text);
    setTimeout(() => setToastMsg(null), 3000);
  }

  async function fetchAlerts() {
    try {
      const res = await fetch("/api/crm/alerts?resolved=false&limit=100");
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch (error) {
      console.error("Erro ao buscar alertas:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchWebhooks() {
    try {
      const res = await fetch("/api/crm/webhooks");
      const data = await res.json();
      setWebhooks(data.webhooks || []);
    } catch (error) {
      console.error("Erro ao buscar webhooks:", error);
    }
  }

  async function handleCheckAlerts() {
    try {
      setChecking(true);
      const res = await fetch("/api/crm/alerts/check", { method: "POST" });
      const data = await res.json();
      
      if (data.alertsCreated > 0) {
        await fetchAlerts();
        notify(`✓ ${data.alertsCreated} novos alertas gerados!`);
      } else {
        notify("Tudo certo! Nenhum novo alerta de anomalia.");
      }
    } catch (error) {
      console.error("Erro ao verificar alertas:", error);
      notify("Erro ao verificar alertas");
    } finally {
      setChecking(false);
    }
  }

  async function handleResolveAlert(id) {
    try {
      await fetch(`/api/crm/alerts/${id}/resolve`, { method: "POST" });
      fetchAlerts();
      notify("Alerta marcado como resolvido.");
    } catch (error) {
      console.error("Erro ao resolver alerta:", error);
    }
  }

  async function handleDeleteWebhook(id) {
    if (!confirm("Deletar este webhook?")) return;
    try {
      await fetch(`/api/crm/webhooks/${id}`, { method: "DELETE" });
      fetchWebhooks();
      notify("Webhook excluído.");
    } catch (error) {
      console.error("Erro ao deletar webhook:", error);
    }
  }

  async function handleCreateWebhook(formData) {
    try {
      const res = await fetch("/api/crm/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowWebhookForm(false);
        fetchWebhooks();
        notify("✓ Webhook cadastrado com sucesso!");
      }
    } catch (error) {
      console.error("Erro ao criar webhook:", error);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center space-y-3 flex-col">
        <div className="size-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        <p className="text-xs font-mono text-text-muted">Carregando automações e alertas…</p>
      </div>
    );
  }

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
            <span className="font-semibold text-brand-400">Automações & Webhooks</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black font-display text-text-main tracking-tight flex items-center gap-2.5">
            <Zap className="size-6 text-brand-500" />
            Automações, Alertas & Webhooks
          </h1>
          <p className="text-xs text-text-muted">
            Monitore anomalias no pipeline, limites de saldo e integre eventos em tempo real com sistemas externos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCheckAlerts}
            disabled={checking}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-1.5 text-xs font-bold text-text-main hover:bg-surface-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${checking ? "animate-spin text-brand-500" : ""}`} />
            <span>Verificar Anomalias</span>
          </button>
          <button
            type="button"
            onClick={() => setShowWebhookForm(true)}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-soft hover:opacity-90 transition-opacity"
          >
            <Plus className="size-3.5" />
            <span>Novo Webhook</span>
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("alerts")}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === "alerts"
              ? "border-brand-500 text-brand-400"
              : "border-transparent text-text-muted hover:text-text-main"
          }`}
        >
          Alertas Ativos ({alerts.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("webhooks")}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === "webhooks"
              ? "border-brand-500 text-brand-400"
              : "border-transparent text-text-muted hover:text-text-main"
          }`}
        >
          Webhooks Configurados ({webhooks.length})
        </button>
      </div>

      {/* ── Tab Contents ── */}
      {activeTab === "alerts" && (
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center space-y-2">
              <CheckCircle className="size-10 text-emerald-400 mx-auto" />
              <p className="text-sm font-bold text-text-main">Nenhum alerta pendente</p>
              <p className="text-xs text-text-muted">Todos os clientes, pipelines e saldos estão dentro dos parâmetros normais.</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} onResolve={handleResolveAlert} />
            ))
          )}
        </div>
      )}

      {activeTab === "webhooks" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-muted">
              Webhooks enviam payloads HTTP POST com assinatura HMAC para seu backend a cada evento do CRM.
            </p>
          </div>

          <div className="space-y-3">
            {webhooks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center space-y-2">
                <Globe className="size-10 text-brand-500 mx-auto" />
                <p className="text-sm font-bold text-text-main">Nenhum webhook cadastrado</p>
                <p className="text-xs text-text-muted">Adicione endpoints para receber eventos em tempo real.</p>
              </div>
            ) : (
              webhooks.map((webhook) => (
                <WebhookCard key={webhook.id} webhook={webhook} onDelete={handleDeleteWebhook} />
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal: novo webhook */}
      {showWebhookForm && (
        <WebhookForm onSave={handleCreateWebhook} onCancel={() => setShowWebhookForm(false)} />
      )}
    </div>
  );
}

function AlertCard({ alert, onResolve }) {
  const severityConfig = {
    critical: { icon: XCircle, color: "text-label-crimson", bg: "bg-label-crimson-bg border-red-500/30" },
    warning: { icon: AlertTriangle, color: "text-label-yellow", bg: "bg-label-yellow-bg border-yellow-500/30" },
    info: { icon: Info, color: "text-label-blue", bg: "bg-label-blue-bg border-blue-500/30" },
  };

  const config = severityConfig[alert.severity] || severityConfig.info;
  const Icon = config.icon;

  return (
    <div className={`p-4 rounded-xl border ${config.bg} flex items-start gap-3 justify-between shadow-soft`}>
      <div className="flex items-start gap-3">
        <Icon className={`size-5 shrink-0 ${config.color} mt-0.5`} />
        <div className="space-y-1">
          <h3 className="text-xs font-bold text-text-main">{alert.title}</h3>
          <p className="text-xs text-text-muted leading-relaxed">{alert.message}</p>
          <div className="flex items-center gap-3 pt-1 text-[10px] font-mono text-text-muted">
            <span className="uppercase font-bold">{alert.type}</span>
            <span>•</span>
            <span>{new Date(alert.createdAt).toLocaleString("pt-BR")}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onResolve(alert.id)}
        className="text-xs font-bold text-brand-400 hover:text-brand-300 underline shrink-0"
      >
        Resolver
      </button>
    </div>
  );
}

function WebhookCard({ webhook, onDelete }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 flex items-start justify-between gap-4 shadow-soft">
      <div className="space-y-2 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <code className="text-xs font-mono font-bold text-text-main bg-surface-2 px-2.5 py-1 rounded-lg truncate max-w-lg">
            {webhook.url}
          </code>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            webhook.isActive ? "bg-label-emerald-bg text-label-emerald" : "bg-label-crimson-bg text-label-crimson"
          }`}>
            {webhook.isActive ? "Ativo" : "Inativo"}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(webhook.events || []).map((event) => (
            <span key={event} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-surface-2 text-text-muted border border-border">
              {event}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-text-muted">
          <span>
            {webhook.lastFiredAt
              ? `Último disparo: ${new Date(webhook.lastFiredAt).toLocaleString("pt-BR")}`
              : "Nunca disparado"}
          </span>
          {webhook.failCount > 0 && (
            <span className="text-crimson-400 font-bold">Falhas: {webhook.failCount}</span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDelete(webhook.id)}
        className="p-1.5 rounded-lg text-text-muted hover:text-crimson-400 hover:bg-surface-2 transition-colors"
        title="Excluir webhook"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function WebhookForm({ onSave, onCancel }) {
  const [formData, setFormData] = useState({
    url: "",
    events: [],
    secret: "",
  });

  const availableEvents = [
    "contact.created",
    "contact.updated",
    "contact.deleted",
    "deal.created",
    "deal.updated",
    "deal.stage_changed",
    "deal.deleted",
    "deal.close_approaching",
    "alert.created",
    "usage.threshold",
    "balance.low",
  ];

  function toggleEvent(event) {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  }

  const inputCls =
    "h-9 w-full rounded-xl border border-border bg-surface-2 px-3 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand-500";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div className="bg-surface rounded-2xl border border-border p-6 max-w-lg w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-sm font-bold font-display text-text-main flex items-center gap-2">
            <Globe className="size-4 text-brand-500" />
            Cadastrar Novo Webhook
          </h2>
          <button type="button" onClick={onCancel} className="text-xs text-text-muted hover:text-text-main">✕</button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(formData);
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">URL do Webhook (HTTPS) *</label>
            <input
              type="url"
              required
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://seu-endpoint.com/webhook"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Eventos a Escutar *</label>
            <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto border border-border rounded-xl p-2.5 bg-surface-2 custom-scrollbar">
              {availableEvents.map((event) => (
                <label key={event} className="flex items-center gap-2 cursor-pointer text-xs text-text-main">
                  <input
                    type="checkbox"
                    checked={formData.events.includes(event)}
                    onChange={() => toggleEvent(event)}
                    className="rounded border-border"
                  />
                  <span>{event}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Secret / Segredo HMAC (Opcional)</label>
            <input
              type="password"
              value={formData.secret}
              onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
              placeholder="Chave secreta para validação de assinatura"
              className={inputCls}
            />
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
              disabled={formData.events.length === 0}
              className="flex-1 h-9 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-xs font-bold text-white shadow-soft hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Salvar Webhook
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
