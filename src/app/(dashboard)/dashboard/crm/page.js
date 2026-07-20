"use client";

import { useState, useEffect } from "react";
import { Card, Badge } from "@/shared/components";

const STAGE_LABELS = { lead: "Lead", qualified: "Qualified", proposal: "Proposal", negotiation: "Negotiation", won: "Won", lost: "Lost" };
const STAGE_COLORS = { lead: "bg-gray-500", qualified: "bg-blue-500", proposal: "bg-yellow-500", negotiation: "bg-orange-500", won: "bg-green-500", lost: "bg-red-500" };

export default function CrmPage() {
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pipeline");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", contactName: "", contactEmail: "", valueCents: "", stage: "lead", source: "" });

  function loadAll() {
    Promise.all([
      fetch("/api/crm/deals?summary=1").then(r => r.json()),
      fetch("/api/crm/contacts").then(r => r.json()),
    ]).then(([dealData, contactData]) => {
      setDeals(dealData.deals || []);
      setSummary(dealData.summary || null);
      setStages(dealData.stages || []);
      setContacts(contactData.contacts || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }

  useEffect(() => { loadAll(); }, []);

  async function moveDeal(id, stage) {
    await fetch(`/api/crm/deals?id=${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage }) });
    loadAll();
  }

  async function createDeal(e) {
    e.preventDefault();
    let contactId = null;
    const existing = contacts.find(c => c.email === form.contactEmail);
    if (existing) {
      contactId = existing.id;
    } else {
      const res = await fetch("/api/crm/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.contactName, email: form.contactEmail, source: form.source || "manual" }) });
      const data = await res.json();
      contactId = data.contact?.id;
    }
    await fetch("/api/crm/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId, title: form.title, valueCents: Number(form.valueCents) || 0, stage: form.stage, source: form.source || "manual" }) });
    setShowForm(false);
    setForm({ title: "", contactName: "", contactEmail: "", valueCents: "", stage: "lead", source: "" });
    loadAll();
  }

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-8"><p className="text-text-muted">Loading...</p></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">CRM</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab("pipeline")} className={`px-3 py-1.5 rounded-md text-sm font-medium ${tab === "pipeline" ? "bg-primary text-white" : "bg-surface text-text"}`}>Pipeline</button>
          <button onClick={() => setTab("contacts")} className={`px-3 py-1.5 rounded-md text-sm font-medium ${tab === "contacts" ? "bg-primary text-white" : "bg-surface text-text"}`}>Contacts</button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {stages.map(s => (
            <Card key={s} className={`p-3 border-l-4 ${STAGE_COLORS[s]} border-l`}>
              <p className="text-xs text-text-muted uppercase">{STAGE_LABELS[s]}</p>
              <p className="text-xl font-bold">{summary.stages[s]?.count || 0}</p>
              <p className="text-xs text-text-muted">${((summary.stages[s]?.value || 0) / 100).toFixed(0)}</p>
            </Card>
          ))}
        </div>
      )}

      {tab === "pipeline" && (
        <>
          <div className="flex justify-end">
            <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primary-hover">{showForm ? "Cancel" : "+ New Deal"}</button>
          </div>

          {showForm && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">New Deal</h2>
              <form onSubmit={createDeal} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium mb-1">Deal Title</label><input className="w-full px-3 py-2 rounded-md border border-border bg-surface text-text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required /></div>
                <div><label className="block text-sm font-medium mb-1">Contact Name</label><input className="w-full px-3 py-2 rounded-md border border-border bg-surface text-text" value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} required /></div>
                <div><label className="block text-sm font-medium mb-1">Contact Email</label><input type="email" className="w-full px-3 py-2 rounded-md border border-border bg-surface text-text" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} /></div>
                <div><label className="block text-sm font-medium mb-1">Value (cents)</label><input type="number" className="w-full px-3 py-2 rounded-md border border-border bg-surface text-text" value={form.valueCents} onChange={e => setForm(f => ({ ...f, valueCents: e.target.value }))} /></div>
                <div><label className="block text-sm font-medium mb-1">Stage</label><select className="w-full px-3 py-2 rounded-md border border-border bg-surface text-text" value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>{stages.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}</select></div>
                <div><label className="block text-sm font-medium mb-1">Source</label><input className="w-full px-3 py-2 rounded-md border border-border bg-surface text-text" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} /></div>
                <div className="col-span-full"><button type="submit" className="px-4 py-2 rounded-md bg-primary text-white text-sm font-medium">Create Deal</button></div>
              </form>
            </Card>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 overflow-x-auto">
            {stages.map(stage => (
              <div key={stage} className="space-y-3 min-w-[200px]">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${STAGE_COLORS[stage]}`} />
                  <h3 className="font-semibold text-sm text-text-muted uppercase">{STAGE_LABELS[stage]}</h3>
                  <span className="text-xs text-text-muted">({deals.filter(d => d.stage === stage).length})</span>
                </div>
                {deals.filter(d => d.stage === stage).map(deal => (
                  <Card key={deal.id} className="p-3 space-y-2">
                    <p className="font-medium text-sm">{deal.title}</p>
                    <p className="text-xs text-text-muted">{deal.contactName || "Unknown"}{deal.valueCents > 0 && ` — $${(deal.valueCents / 100).toFixed(2)}`}</p>
                    <div className="flex gap-1 flex-wrap">
                      {stage !== "won" && stage !== "lost" && (
                        <>
                          {stage !== "lead" && <button onClick={() => moveDeal(deal.id, stages[stages.indexOf(stage) - 1])} className="text-xs px-1.5 py-0.5 rounded bg-surface text-text-muted hover:bg-border" title="Move back">←</button>}
                          {stage !== "negotiation" && <button onClick={() => moveDeal(deal.id, stages[stages.indexOf(stage) + 1])} className="text-xs px-1.5 py-0.5 rounded bg-surface text-text-muted hover:bg-border" title="Move forward">→</button>}
                        </>
                      )}
                      {stage !== "won" && stage !== "lost" && (
                        <button onClick={() => moveDeal(deal.id, "lost")} className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100 ml-auto">Lost</button>
                      )}
                      {stage !== "won" && stage !== "lost" && (
                        <button onClick={() => moveDeal(deal.id, "won")} className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-600 hover:bg-green-100">Won</button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "contacts" && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Contacts ({contacts.length})</h2>
          {contacts.length === 0 ? <p className="text-text-muted">No contacts yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-text-muted border-b border-border">
                  <th className="pb-2">Name</th><th className="pb-2">Email</th><th className="pb-2">Phone</th><th className="pb-2">Company</th><th className="pb-2">Tags</th><th className="pb-2">Source</th><th className="pb-2">Created</th>
                </tr></thead>
                <tbody>
                  {contacts.map(c => (
                    <tr key={c.id} className="border-b border-border/50">
                      <td className="py-2 font-medium">{c.name}</td>
                      <td className="py-2 text-text-muted text-xs">{c.email || "-"}</td>
                      <td className="py-2 text-text-muted text-xs">{c.phone || "-"}</td>
                      <td className="py-2 text-text-muted text-xs">{c.company || "-"}</td>
                      <td className="py-2">{c.tags?.map(t => <Badge key={t} variant="default" className="mr-1">{t}</Badge>)}</td>
                      <td className="py-2 text-text-muted text-xs">{c.source || "-"}</td>
                      <td className="py-2 text-text-muted text-xs">{new Date(c.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
