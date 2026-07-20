"use client";

import { useState, useEffect } from "react";

function StatusBadge({ status }) {
  const styles = {
    paid: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20",
    refunded: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
    pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${styles[status] || "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20"}`}>
      {status}
    </span>
  );
}

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
    <div className="max-w-6xl mx-auto p-6 animate-fade-up">
      <div className="mb-6 flex items-center gap-2.5">
        <div className="flex items-center justify-center size-9 rounded-md bg-amber-500/10 border border-amber-500/20">
          <span className="material-symbols-outlined text-amber-500 text-[20px]">receipt_long</span>
        </div>
        <h1 className="text-2xl font-display font-bold tracking-tight text-text-main">Invoices &amp; Payments</h1>
      </div>

      <div className="flex gap-1 mb-6 border-b border-border">
        <button onClick={() => setTab("payments")} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${tab === "payments" ? "border-amber-500 text-amber-600 dark:text-amber-400" : "border-transparent text-text-muted hover:text-text-main"}`}>Payments</button>
        <button onClick={() => setTab("invoices")} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${tab === "invoices" ? "border-amber-500 text-amber-600 dark:text-amber-400" : "border-transparent text-text-muted hover:text-text-main"}`}>Usage Invoices</button>
      </div>

      {tab === "payments" && (
        <div className="space-y-4">
          <form onSubmit={lookupPayments} className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 max-w-sm min-w-[200px]">
              <label className="block text-sm font-medium mb-1.5 text-text-muted">Email used at checkout</label>
              <input type="email" className="w-full px-3 py-2 rounded-md border border-border bg-bg text-sm text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <button type="submit" disabled={loading} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-all active:scale-[0.97] disabled:opacity-50">
              <span className="material-symbols-outlined text-[16px]">search</span>
              {loading ? "…" : "Search"}
            </button>
          </form>

          {payments.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <span className="material-symbols-outlined text-[32px] opacity-40 block mb-2">payments</span>
              No payments found.
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-surface overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Gateway</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Plan</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Date</th>
                </tr></thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} className="border-b border-border-subtle hover:bg-surface-2 transition-colors">
                      <td className="px-4 py-3 font-semibold text-text-main">{(p.amountCents / 100).toFixed(2)} <span className="text-text-muted text-xs font-normal">{p.currency}</span></td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3 text-text-muted text-xs">{p.gateway}</td>
                      <td className="px-4 py-3 text-text-muted text-xs font-mono">{p.planId?.slice(0, 8) || "-"}</td>
                      <td className="px-4 py-3 text-text-muted text-xs">{new Date(p.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "invoices" && (
        <div className="space-y-4">
          <button onClick={fetchInvoices} disabled={loading} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-all active:scale-[0.97] disabled:opacity-50">
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Refresh
          </button>

          {loading && (
            <div className="text-center py-12 text-text-muted">
              <span className="material-symbols-outlined animate-spin text-[24px] block mb-2">progress_activity</span>
              Loading…
            </div>
          )}

          {!loading && invoices.length === 0 && (
            <div className="text-center py-12 text-text-muted">
              <span className="material-symbols-outlined text-[32px] opacity-40 block mb-2">receipt_long</span>
              No usage invoices generated yet. Run &quot;Process Renewals&quot; to create them.
            </div>
          )}

          {invoices.map(inv => (
            <div key={inv.id} className="rounded-lg border border-border bg-surface p-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-display font-bold text-text-main">{(inv.totalCents / 100).toFixed(2)} <span className="text-sm text-text-muted font-normal">{inv.currency}</span></span>
                  <StatusBadge status={inv.status} />
                </div>
                <div className="text-xs text-text-muted font-mono">{inv.email || inv.userId?.slice(0, 8)}</div>
              </div>
              <div className="text-xs text-text-muted mb-3">{inv.description || `${inv.periodStart?.slice(0, 10)} → ${inv.periodEnd?.slice(0, 10)}`}</div>
              {inv.lineItems?.length > 0 && (
                <table className="w-full text-xs border-t border-border pt-2">
                  <thead><tr className="text-text-muted">
                    <th className="text-left py-1.5 pr-2 font-semibold uppercase tracking-wider">Model</th>
                    <th className="text-right py-1.5 px-2 font-semibold uppercase tracking-wider">Requests</th>
                    <th className="text-right py-1.5 pl-2 font-semibold uppercase tracking-wider">Amount</th>
                  </tr></thead>
                  <tbody>
                    {inv.lineItems.map(item => (
                      <tr key={item.id} className="border-t border-border-subtle">
                        <td className="py-1.5 pr-2 font-mono text-text-main">{item.model}</td>
                        <td className="text-right py-1.5 px-2 text-text-muted">{item.quantity}</td>
                        <td className="text-right py-1.5 pl-2 text-text-main font-medium">{(item.amountCents / 100).toFixed(2)}</td>
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
