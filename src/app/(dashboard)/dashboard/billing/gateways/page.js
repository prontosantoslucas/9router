"use client";

import { useState, useEffect } from "react";
import { Card, Button, Badge, Toggle } from "@/shared/components";

export default function GatewayConfigPage() {
  const [gateways, setGateways] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    fetch("/api/admin/gateways")
      .then(r => r.json())
      .then(data => {
        setGateways(data.gateways || []);
        const fd = {};
        for (const g of data.gateways || []) {
          fd[g.gateway] = { enabled: g.enabled, ...g.data };
        }
        setFormData(fd);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function setField(gateway, key, value) {
    setFormData(fd => ({ ...fd, [gateway]: { ...fd[gateway], [key]: value } }));
  }

  async function save(gateway) {
    setSaving(gateway);
    const data = {};
    const g = gateways.find(gw => gw.gateway === gateway);
    for (const field of g.fields) {
      if (formData[gateway]?.[field.key] !== undefined) data[field.key] = formData[gateway][field.key];
    }
    await fetch("/api/admin/gateways", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gateway, enabled: formData[gateway]?.enabled || false, data }),
    });
    setSaving(null);
  }

  async function remove(gateway) {
    await fetch(`/api/admin/gateways?gateway=${gateway}`, { method: "DELETE" });
    setFormData(fd => ({ ...fd, [gateway]: { enabled: false } }));
    setGateways(gw => gw.map(g => g.gateway === gateway ? { ...g, enabled: false, data: {} } : g));
  }

  if (loading) {
    return <div className="max-w-4xl mx-auto px-4 py-8"><p className="text-text-muted">Loading...</p></div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Gateway Configuration</h1>
      <p className="text-text-muted">Configure payment gateways. Values are stored in database and override env vars.</p>

      {gateways.map(g => (
        <Card key={g.gateway} className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold capitalize">{g.gateway}</h2>
              <Badge variant={g.configured ? "success" : "warning"}>{g.configured ? "Configured" : "Not Configured"}</Badge>
            </div>
            <Toggle checked={formData[g.gateway]?.enabled || false} onChange={v => setField(g.gateway, "enabled", v)} label="Enabled" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {g.fields.map(field => (
              <div key={field.key}>
                <label className="block text-sm font-medium mb-1">{field.label}</label>
                {field.type === "select" ? (
                  <select
                    className="w-full px-3 py-2 rounded-md border border-border bg-surface text-text"
                    value={formData[g.gateway]?.[field.key] || ""}
                    onChange={e => setField(g.gateway, field.key, e.target.value)}
                  >
                    {field.options.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    className="w-full px-3 py-2 rounded-md border border-border bg-surface text-text"
                    value={formData[g.gateway]?.[field.key] || ""}
                    onChange={e => setField(g.gateway, field.key, e.target.value)}
                    placeholder={field.label}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <Button onClick={() => save(g.gateway)} disabled={saving === g.gateway}>
              {saving === g.gateway ? "Saving..." : "Save"}
            </Button>
            <Button variant="secondary" onClick={() => remove(g.gateway)}>Clear</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
