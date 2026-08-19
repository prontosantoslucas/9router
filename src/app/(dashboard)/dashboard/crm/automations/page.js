"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, Info, XCircle, RefreshCw, Plus, Trash2 } from "lucide-react";

export default function AutomationsPage() {
  const [alerts, setAlerts] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [activeTab, setActiveTab] = useState("alerts");

  useEffect(() => {
    fetchAlerts();
    fetchWebhooks();
  }, []);

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
      }
      
      alert(`${data.alertsCreated} novos alertas criados`);
    } catch (error) {
      console.error("Erro ao verificar alertas:", error);
    } finally {
      setChecking(false);
    }
  }

  async function handleResolveAlert(id) {
    try {
      await fetch(`/api/crm/alerts/${id}/resolve`, { method: "POST" });
      fetchAlerts();
    } catch (error) {
      console.error("Erro ao resolver alerta:", error);
    }
  }

  async function handleDeleteWebhook(id) {
    if (!confirm("Deletar webhook?")) return;
    try {
      await fetch(`/api/crm/webhooks/${id}`, { method: "DELETE" });
      fetchWebhooks();
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
      }
    } catch (error) {
      console.error("Erro ao criar webhook:", error);
    }
  }

  if (loading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">AutomaÃ§Ãµes & Alertas</h1>
        <button
          onClick={handleCheckAlerts}
          disabled={checking}
          className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg hover:bg-brand-600 disabled:opacity-50"
        >
          <RefreshCw size={18} className={checking ? "animate-spin" : ""} />
          Verificar Alertas
        </button>
      </div>

      <div className="flex gap-4 mb-6 border-b border-border">
        <TabButton active={activeTab === "alerts"} onClick={() => setActiveTab("alerts")} label={`Alertas (${alerts.length})`} />
        <TabButton active={activeTab === "webhooks"} onClick={() => setActiveTab("webhooks")} label={`Webhooks (${webhooks.length})`} />
      </div>

      {activeTab === "alerts" && (
        <div className="space-y-4">
          {alerts.length === 0 ? (
            <div className="bg-surface rounded-lg p-12 border border-border text-center">
              <CheckCircle size={48} className="mx-auto text-label-emerald mb-4" />
              <p className="text-text-muted">Nenhum alerta ativo no momento</p>
              <p className="text-sm text-text-muted mt-2">Clique em "Verificar Alertas" para checar novamente</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} onResolve={handleResolveAlert} />
            ))
          )}
        </div>
      )}

      {activeTab === "webhooks" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-text-muted">
              Configure webhooks para receber notificaÃ§Ãµes quando eventos importantes acontecem no CRM
            </p>
            <button
              onClick={() => setShowWebhookForm(true)}
              className="flex items-center gap-2 bg-brand-500 text-white px-3 py-1.5 rounded-lg hover:bg-brand-600 text-sm"
            >
              <Plus size={16} />
              Novo Webhook
            </button>
          </div>

          <div className="space-y-3">
            {webhooks.length === 0 ? (
              <div className="bg-surface rounded-lg p-12 border border-border text-center">
                <Info size={48} className="mx-auto text-brand-500 mb-4" />
                <p className="text-text-muted">Nenhum webhook configurado</p>
              </div>
            ) : (
              webhooks.map((webhook) => (
                <WebhookCard key={webhook.id} webhook={webhook} onDelete={handleDeleteWebhook} />
              ))
            )}
          </div>
        </div>
      )}

      {showWebhookForm && (
        <WebhookForm onSave={handleCreateWebhook} onCancel={() => setShowWebhookForm(false)} />
      )}
    </div>
  );
}

function TabButton({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-[1px] ${
        active ? "border-brand-500 text-brand-600" : "border-transparent text-text-muted hover:text-text-main"
      }`}
    >
      {label}
    </button>
  );
}

function AlertCard({ alert, onResolve }) {
  const severityConfig = {
    critical: { icon: XCircle, color: "text-label-crimson", bg: "bg-label-crimson-bg", border: "border-red-200" },
    warning: { icon: AlertTriangle, color: "text-label-yellow", bg: "bg-label-yellow-bg", border: "border-yellow-200" },
    info: { icon: Info, color: "text-brand-600", bg: "bg-label-blue-bg", border: "border-label-blue-bg" },
  };

  const config = severityConfig[alert.severity] || severityConfig.info;
  const Icon = config.icon;

  return (
    <div className={`${config.bg} border ${config.border} rounded-lg p-4`}>
      <div className="flex items-start gap-3">
        <Icon size={24} className={config.color} />
        <div className="flex-1">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-semibold text-text-main">{alert.title}</h3>
              <p className="text-sm text-text-main mt-1">{alert.message}</p>
            </div>
            <button
              onClick={() => onResolve(alert.id)}
              className="text-sm text-text-muted hover:text-text-main underline"
            >
              Resolver
            </button>
          </div>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span className="uppercase font-medium">{alert.type}</span>
            <span>{new Date(alert.createdAt).toLocaleString("pt-BR")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WebhookCard({ webhook, onDelete }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <code className="text-sm font-mono bg-bg-alt px-2 py-1 rounded">{webhook.url}</code>
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                webhook.isActive ? "bg-label-emerald-bg text-label-emerald" : "bg-label-crimson-bg text-label-crimson"
              }`}
            >
              {webhook.isActive ? "Ativo" : "Inativo"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {webhook.events.map((event) => (
              <span key={event} className="text-xs bg-label-blue-bg text-brand-700 px-2 py-1 rounded">
                {event}
              </span>
            ))}
          </div>
          <div className="text-xs text-text-muted">
            {webhook.lastFiredAt ? (
              <span>Ãšltimo disparo: {new Date(webhook.lastFiredAt).toLocaleString("pt-BR")}</span>
            ) : (
              <span>Nunca disparado</span>
            )}
            {webhook.failCount > 0 && <span className="ml-3 text-label-crimson">Falhas: {webhook.failCount}</span>}
          </div>
        </div>
        <button
          onClick={() => onDelete(webhook.id)}
          className="text-label-crimson hover:text-red-700 p-2"
          title="Deletar webhook"
        >
          <Trash2 size={18} />
        </button>
      </div>
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Novo Webhook</h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(formData);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1">URL do Webhook *</label>
            <input
              type="url"
              required
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://seu-servidor.com/webhook"
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Eventos * (selecione ao menos 1)</label>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-border rounded p-3">
              {availableEvents.map((event) => (
                <label key={event} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.events.includes(event)}
                    onChange={() => toggleEvent(event)}
                    className="rounded"
                  />
                  <span className="text-sm">{event}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Secret (opcional)</label>
            <input
              type="text"
              value={formData.secret}
              onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
              placeholder="Para assinar requisiÃ§Ãµes com HMAC"
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-text-muted mt-1">
              Se fornecido, o webhook incluirÃ¡ header X-Webhook-Signature com HMAC-SHA256
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={formData.events.length === 0}
              className="flex-1 bg-brand-500 text-white px-4 py-2 rounded-lg hover:bg-brand-600 disabled:opacity-50"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-bg-alt text-text-main px-4 py-2 rounded-lg hover:bg-bg-alt"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
