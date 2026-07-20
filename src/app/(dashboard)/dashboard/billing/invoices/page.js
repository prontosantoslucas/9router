"use client";

import { useState, useEffect } from "react";

export default function InvoicesPage() {
  const [tab, setTab] = useState("payments");
  const [email, setEmail] = useState("");
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchInvoices = async () => {
    setLoading(true);
    const res = await fetch("/api/billing/invoices");
    const data = await res.json();
    setInvoices(data.invoices || []);
    setLoading(false);
  };

  useEffect(() => { if (tab === "invoices") fetchInvoices(); }, [tab]);

  const lookupPayments = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userRes = await fetch(`/api/admin/users?email=${encodeURIComponent(email)}`);
      const u = await userRes.json();
      if (!u.user) { setPayments([]); return; }
      const payRes = await fetch(`/api/billing/payments?userId=${u.user.id}`);
      const p = await payRes.json();
      setPayments(p.payments || []);
    } catch { setPayments([]); }
    setLoading(false);
  };

  return (
    <div class="max-w-6xl mx-auto p-6">
      <h1 class="text-2xl font-bold mb-2">Invoices & Payments</h1>

      <div class="flex gap-1 mb-6 border-b">
        <button onClick={() => setTab("payments")} class={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === "payments" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>Payments</button>
        <button onClick={() => setTab("invoices")} class={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === "invoices" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>Usage Invoices</button>
      </div>

      {tab === "payments" && (
        <div class="space-y-4">
          <form onSubmit={lookupPayments} class="flex gap-3 items-end">
            <div class="flex-1 max-w-sm">
              <label class="block text-sm font-medium mb-1">Email used at checkout</label>
              <input type="email" class="w-full px-3 py-2 rounded border" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <button type="submit" disabled={loading} class="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{loading ? "..." : "Search"}</button>
          </form>

          {payments.length === 0 && <p class="text-center text-gray-400 py-8">No payments found.</p>}

          <div class="bg-white rounded-lg border">
            <table class="w-full text-sm">
              <thead><tr class="border-b bg-gray-50"><th class="text-left px-4 py-3">Amount</th><th class="text-left px-4 py-3">Status</th><th class="text-left px-4 py-3">Gateway</th><th class="text-left px-4 py-3">Plan</th><th class="text-left px-4 py-3">Date</th></tr></thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} class="border-b hover:bg-gray-50">
                    <td class="px-4 py-3 font-medium">{(p.amountCents / 100).toFixed(2)} {p.currency}</td>
                    <td class="px-4 py-3"><span class={`px-2 py-0.5 rounded text-xs font-medium ${p.status === "paid" ? "bg-green-100 text-green-800" : p.status === "refunded" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>{p.status}</span></td>
                    <td class="px-4 py-3 text-gray-500">{p.gateway}</td>
                    <td class="px-4 py-3 text-gray-500">{p.planId?.slice(0, 8) || "-"}</td>
                    <td class="px-4 py-3 text-gray-500 text-xs">{new Date(p.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "invoices" && (
        <div class="space-y-4">
          <div class="flex items-center gap-3">
            <button onClick={fetchInvoices} disabled={loading} class="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Refresh</button>
          </div>

          {loading && <p class="text-center text-gray-400 py-8">Loading...</p>}

          {!loading && invoices.length === 0 && <p class="text-center text-gray-400 py-8">No usage invoices generated yet. Run "Process Renewals" to create them.</p>}

          {invoices.map(inv => (
            <div key={inv.id} class="bg-white rounded-lg border p-4">
              <div class="flex items-center justify-between mb-3">
                <div>
                  <span class="font-semibold">{(inv.totalCents / 100).toFixed(2)} {inv.currency}</span>
                  <span class={`ml-3 px-2 py-0.5 rounded text-xs font-medium ${inv.status === "paid" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>{inv.status}</span>
                </div>
                <div class="text-xs text-gray-500">{inv.email || inv.userId?.slice(0, 8)}</div>
              </div>
              <div class="text-xs text-gray-500 mb-2">{inv.description || `${inv.periodStart?.slice(0, 10)} — ${inv.periodEnd?.slice(0, 10)}`}</div>
              {inv.lineItems?.length > 0 && (
                <table class="w-full text-xs border-t">
                  <thead><tr class="text-gray-500"><th class="text-left py-1 pr-2">Model</th><th class="text-right py-1 px-2">Requests</th><th class="text-right py-1 pl-2">Amount</th></tr></thead>
                  <tbody>
                    {inv.lineItems.map(item => (
                      <tr key={item.id}>
                        <td class="py-1 pr-2 font-mono">{item.model}</td>
                        <td class="text-right py-1 px-2">{item.quantity}</td>
                        <td class="text-right py-1 pl-2">{(item.amountCents / 100).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
