"use client";

import { useState, useEffect } from "react";
import { Card, Badge } from "@/shared/components";

export default function BillingAdminPage() {
  const [users, setUsers] = useState([]);
  const [keys, setKeys] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/billing/admin/users").then(r => r.json()),
      fetch("/api/billing/admin/keys").then(r => r.json()),
      fetch("/api/billing/payments").then(r => r.json()),
    ]).then(([usersData, keysData, paymentsData]) => {
      setUsers(usersData.users || []);
      setKeys(keysData.keys || []);
      setPayments(paymentsData.payments || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="max-w-6xl mx-auto px-4 py-8"><p className="text-text-muted">Loading...</p></div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold">Billing Admin</h1>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Users ({users.length})</h2>
        {users.length === 0 ? (
          <p className="text-text-muted">No users yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-border">
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Keys</th>
                  <th className="pb-2">Total Paid</th>
                  <th className="pb-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-border/50">
                    <td className="py-2">{u.email}</td>
                    <td className="py-2"><Badge variant={u.role === "admin" ? "primary" : "default"}>{u.role}</Badge></td>
                    <td className="py-2"><Badge variant={u.status === "active" ? "success" : "error"}>{u.status}</Badge></td>
                    <td className="py-2 text-text-muted">{u.keyCount}</td>
                    <td className="py-2">${(u.totalPaid / 100).toFixed(2)}</td>
                    <td className="py-2 text-text-muted text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Paid Keys ({keys.length})</h2>
        {keys.length === 0 ? (
          <p className="text-text-muted">No paid keys.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-border">
                  <th className="pb-2">Key</th>
                  <th className="pb-2">Label</th>
                  <th className="pb-2">Plan</th>
                  <th className="pb-2">User</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Period End</th>
                </tr>
              </thead>
              <tbody>
                {keys.map(k => (
                  <tr key={k.id} className="border-b border-border/50">
                    <td className="py-2 font-mono text-xs max-w-[140px] truncate">{k.key}</td>
                    <td className="py-2">{k.label || "-"}</td>
                    <td className="py-2 text-text-muted">{k.planName || "-"}</td>
                    <td className="py-2 text-text-muted text-xs">{k.userEmail || "-"}</td>
                    <td className="py-2">
                      {k.bannedAt ? <Badge variant="error">Banned</Badge> :
                       k.revokedAt ? <Badge variant="warning">Revoked</Badge> :
                       new Date(k.periodEnd) < new Date() ? <Badge variant="error">Expired</Badge> :
                       <Badge variant="success">Active</Badge>}
                    </td>
                    <td className="py-2 text-xs text-text-muted">{k.periodEnd ? new Date(k.periodEnd).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">All Payments ({payments.length})</h2>
        {payments.length === 0 ? (
          <p className="text-text-muted">No payments.</p>
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
                {payments.map(p => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="py-2 text-text-muted">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="py-2">{(p.amountCents / 100).toFixed(2)} {p.currency}</td>
                    <td className="py-2 text-text-muted">{p.gateway}</td>
                    <td className="py-2"><Badge variant={p.status === "paid" ? "success" : p.status === "failed" ? "error" : "warning"}>{p.status}</Badge></td>
                    <td className="py-2 text-text-muted text-xs max-w-[140px] truncate">{p.userEmail || "-"}</td>
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
