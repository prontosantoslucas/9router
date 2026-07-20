"use client";

import { useState, useEffect } from "react";
import { Card, Button, Badge } from "@/shared/components";

export default function PlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", priceCents: "", currency: "USD", durationDays: "", tokenLimit: "", costLimitCents: "", rpm: "", isActive: true });

  function fetchPlans() {
    fetch("/api/billing/plans").then(r => r.json()).then(d => { setPlans(d.plans || []); setLoading(false); });
  }

  useEffect(() => { fetchPlans(); }, []);

  function resetForm() { setEditId(null); setForm({ name: "", priceCents: "", currency: "USD", durationDays: "", tokenLimit: "", costLimitCents: "", rpm: "", isActive: true }); }

  function editPlan(p) { setEditId(p.id); setForm({ name: p.name, priceCents: String(p.priceCents), currency: p.currency, durationDays: String(p.durationDays), tokenLimit: String(p.tokenLimit || ""), costLimitCents: String(p.costLimitCents || ""), rpm: String(p.rpm || ""), isActive: p.isActive }); }

  async function save(e) {
    e.preventDefault();
    const payload = {
      name: form.name,
      priceCents: Number(form.priceCents),
      currency: form.currency,
      durationDays: Number(form.durationDays),
      tokenLimit: form.tokenLimit ? Number(form.tokenLimit) : null,
      costLimitCents: form.costLimitCents ? Number(form.costLimitCents) : null,
      rpm: form.rpm ? Number(form.rpm) : null,
      isActive: form.isActive,
    };
    const url = editId ? `/api/billing/plans?id=${editId}` : "/api/billing/plans";
    const method = editId ? "PATCH" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    resetForm();
    fetchPlans();
  }

  async function remove(id) {
    if (!confirm("Delete this plan?")) return;
    await fetch(`/api/billing/plans?id=${id}`, { method: "DELETE" });
    fetchPlans();
  }

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8"><p className="text-text-muted">Loading...</p></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Plans</h1>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">{editId ? "Edit Plan" : "New Plan"}</h2>
        <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input className="w-full px-3 py-2 rounded-md border border-border bg-surface text-text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Price (cents)</label>
            <input type="number" className="w-full px-3 py-2 rounded-md border border-border bg-surface text-text" value={form.priceCents} onChange={e => setForm(f => ({ ...f, priceCents: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Currency</label>
            <input className="w-full px-3 py-2 rounded-md border border-border bg-surface text-text" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Duration (days)</label>
            <input type="number" className="w-full px-3 py-2 rounded-md border border-border bg-surface text-text" value={form.durationDays} onChange={e => setForm(f => ({ ...f, durationDays: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Token Limit</label>
            <input type="number" className="w-full px-3 py-2 rounded-md border border-border bg-surface text-text" value={form.tokenLimit} onChange={e => setForm(f => ({ ...f, tokenLimit: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cost Limit (cents)</label>
            <input type="number" className="w-full px-3 py-2 rounded-md border border-border bg-surface text-text" value={form.costLimitCents} onChange={e => setForm(f => ({ ...f, costLimitCents: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">RPM</label>
            <input type="number" className="w-full px-3 py-2 rounded-md border border-border bg-surface text-text" value={form.rpm} onChange={e => setForm(f => ({ ...f, rpm: e.target.value }))} />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4" />
              <span className="text-sm font-medium">Active</span>
            </label>
          </div>
          <div className="sm:col-span-2 flex gap-3">
            <Button type="submit">{editId ? "Update" : "Create"}</Button>
            {editId && <Button type="button" variant="secondary" onClick={resetForm}>Cancel</Button>}
          </div>
        </form>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map(p => (
          <Card key={p.id} className="p-4 border border-border">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold">{p.name}</h3>
                <p className="text-lg font-bold">${(p.priceCents / 100).toFixed(2)} <span className="text-sm font-normal text-text-muted">{p.currency}</span></p>
              </div>
              <Badge variant={p.isActive ? "success" : "warning"}>{p.isActive ? "Active" : "Inactive"}</Badge>
            </div>
            <div className="text-sm text-text-muted space-y-1">
              <p>{p.durationDays} days</p>
              {p.tokenLimit && <p>{p.tokenLimit.toLocaleString()} tokens</p>}
              {p.rpm && <p>{p.rpm} RPM</p>}
              {p.costLimitCents && <p>${(p.costLimitCents / 100).toFixed(2)} cost cap</p>}
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="secondary" onClick={() => editPlan(p)}>Edit</Button>
              <Button variant="danger" onClick={() => remove(p.id)}>Delete</Button>
            </div>
          </Card>
        ))}
        {plans.length === 0 && <p className="text-text-muted col-span-full">No plans created yet.</p>}
      </div>
    </div>
  );
}
