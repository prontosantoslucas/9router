"use client";

import { useState } from "react";
import { Card, Badge } from "@/shared/components";

const GATEWAY_LABELS = { stripe: "Stripe", mercadopago: "Mercado Pago", paypal: "PayPal", nowpayments: "NOWPayments" };

export default function InvoicesPage() {
  const [email, setEmail] = useState("");
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lookedUp, setLookedUp] = useState(false);

  async function lookup(e) {
    e.preventDefault();
    setLoading(true);
    setLookedUp(false);
    try {
      const userRes = await fetch(`/api/admin/users?email=${encodeURIComponent(email)}`);
      const userData = await userRes.json();
      if (!userData.user) { setPayments([]); setLookedUp(true); return; }
      const payRes = await fetch(`/api/billing/payments?userId=${userData.user.id}`);
      const payData = await payRes.json();
      setPayments(payData.payments || []);
    } catch { setPayments([]); }
    setLoading(false);
    setLookedUp(true);
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Invoice History</h1>
      <p className="text-text-muted">Enter your email to look up your payment history.</p>

      <form onSubmit={lookup} className="flex gap-3 items-end">
        <div className="flex-1 max-w-sm">
          <label className="block text-sm font-medium mb-1">Email used at checkout</label>
          <input type="email" className="w-full px-3 py-2 rounded-md border border-border bg-surface text-text" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
        </div>
        <button type="submit" disabled={loading} className="px-4 py-2 rounded-md bg-primary text-white font-medium text-sm hover:bg-primary-hover disabled:opacity-50">{loading ? "Searching..." : "Search"}</button>
      </form>

      {lookedUp && payments.length === 0 && (
        <Card className="p-6 text-center text-text-muted">No payments found for this email.</Card>
      )}

      {payments.length > 0 && (
        <div className="space-y-3">
          {payments.map(p => (
            <Card key={p.id} className="p-4 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-semibold">{(p.amountCents / 100).toFixed(2)} {p.currency}</span>
                  <Badge variant={p.status === "paid" ? "success" : p.status === "refunded" ? "warning" : "error"}>{p.status}</Badge>
                </div>
                <div className="text-sm text-text-muted space-x-3">
                  <span>{GATEWAY_LABELS[p.gateway] || p.gateway}</span>
                  <span>{formatDate(p.createdAt)}</span>
                  {p.planId && <span>Plan: {p.planId}</span>}
                </div>
              </div>
              <span className="text-xs font-mono text-text-muted max-w-[120px] truncate">{p.externalId}</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
