"use client";

import { useState, useEffect } from "react";
import { Card, Button, Badge } from "@/shared/components";

export default function BillingPage() {
  const [plans, setPlans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [keys, setKeys] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/billing/plans").then(r => r.json()),
      fetch("/api/billing/payments").then(r => r.json()),
      fetch("/api/billing/api-keys").then(r => r.json()),
      fetch("/api/billing/stats").then(r => r.json()),
    ]).then(([plansData, paymentsData, keysData, statsData]) => {
      setPlans(plansData.plans || []);
      setPayments(paymentsData.payments || []);
      setKeys(keysData.keys || []);
      setStats(statsData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="max-w-4xl mx-auto px-4 py-8"><p className="text-text-muted">Loading...</p></div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold">Billing</h1>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4">
            <p className="text-sm text-text-muted uppercase font-semibold">Users</p>
            <p className="text-2xl font-bold mt-1">{stats.userCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-text-muted uppercase font-semibold">Paid Keys</p>
            <p className="text-2xl font-bold mt-1">{stats.paidKeyCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-text-muted uppercase font-semibold">Revenue</p>
            <p className="text-2xl font-bold mt-1">${(stats.totalRevenueCents / 100).toFixed(2)}</p>
          </Card>
        </div>
      )}

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Plans</h2>
        {plans.length === 0 ? (
          <p className="text-text-muted">No plans configured. Create plans in the database.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.filter(p => p.isActive).map(plan => (
              <Card key={plan.id} className="p-4 border border-border">
                <h3 className="font-semibold">{plan.name}</h3>
                <p className="text-2xl font-bold mt-2">${(plan.priceCents / 100).toFixed(2)}</p>
                <p className="text-sm text-text-muted">{plan.durationDays} days</p>
                {plan.tokenLimit && <p className="text-sm text-text-muted">{plan.tokenLimit.toLocaleString()} token limit</p>}
                {plan.costLimitCents && <p className="text-sm text-text-muted">${(plan.costLimitCents / 100).toFixed(2)} cost limit</p>}
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">API Keys</h2>
        {keys.length === 0 ? (
          <p className="text-text-muted">No paid API keys yet.</p>
        ) : (
          <div className="space-y-3">
            {keys.map(k => (
              <div key={k.id} className="flex items-center justify-between p-3 rounded-lg bg-bg border border-border">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{k.label || "Unnamed"}</p>
                  <p className="text-xs text-text-muted font-mono truncate">{k.key?.slice(0, 24)}...</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  {k.bannedAt ? <Badge variant="error">Banned</Badge> :
                   k.revokedAt ? <Badge variant="warning">Revoked</Badge> :
                   new Date(k.periodEnd) < new Date() ? <Badge variant="error">Expired</Badge> :
                   <Badge variant="success">Active</Badge>}
                  <span className="text-xs text-text-muted">{(k.balanceCents / 100).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Payment History</h2>
        {payments.length === 0 ? (
          <p className="text-text-muted">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-border">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Gateway</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">User</th>
                </tr>
              </thead>
              <tbody>
                {payments.slice(0, 20).map(p => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="py-2 text-text-muted">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="py-2">{(p.amountCents / 100).toFixed(2)} {p.currency}</td>
                    <td className="py-2 text-text-muted">{p.gateway}</td>
                    <td className="py-2">
                      <Badge variant={p.status === "paid" ? "success" : p.status === "failed" ? "error" : "warning"}>{p.status}</Badge>
                    </td>
                    <td className="py-2 text-text-muted truncate max-w-[120px]">{p.userEmail || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
