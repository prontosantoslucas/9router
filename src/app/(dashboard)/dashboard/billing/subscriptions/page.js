"use client";

import { useState, useEffect, useCallback } from "react";

const STATUS_STYLES = {
  active: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20",
  paused: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
  cancelled: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20",
  expired: "bg-surface-3 text-text-muted border-border",
};

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_STYLES[status] || STATUS_STYLES.expired}`}>
      {status}
    </span>
  );
}

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/billing/subscriptions");
    const data = await res.json();
    setSubs(data.subscriptions || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  const doAction = async (id, action) => {
    setActionLoading(id);
    await fetch(`/api/billing/subscriptions?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setActionLoading(null);
    fetchSubs();
  };

  const handleRenewal = async () => {
    if (!confirm("Process renewals for all active subscriptions?")) return;
    setActionLoading("renewal");
    await fetch("/api/billing/subscriptions", { method: "POST" });
    setActionLoading(null);
    fetchSubs();
  };

  const activeCount = subs.filter(s => s.status === "active").length;

  return (
    <div className="max-w-6xl mx-auto p-6 animate-fade-up">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center size-9 rounded-md bg-amber-500/10 border border-amber-500/20">
              <span className="material-symbols-outlined text-amber-500 text-[20px]">autorenew</span>
            </div>
            <h1 className="text-2xl font-display font-bold tracking-tight text-text-main">Subscriptions</h1>
          </div>
          <p className="text-sm text-text-muted mt-2">Manage active plans and renewal cycles · <span className="text-green-600 dark:text-green-400 font-medium">{activeCount} active</span></p>
        </div>
        <button
          onClick={handleRenewal}
          disabled={actionLoading === "renewal"}
          className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-md text-sm font-semibold transition-all active:scale-[0.97] disabled:opacity-50"
        >
          {actionLoading === "renewal" ? <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> : <span className="material-symbols-outlined text-[16px]">sync</span>}
          {actionLoading === "renewal" ? "Processing…" : "Process Renewals"}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-text-muted">
          <span className="material-symbols-outlined animate-spin text-[24px] block mb-2">progress_activity</span>
          Loading…
        </div>
      ) : subs.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <span className="material-symbols-outlined text-[32px] opacity-40 block mb-2">subscriptions</span>
          No subscriptions yet.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Plan</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Gateway</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Period End</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subs.map(s => (
                  <tr key={s.id} className="border-b border-border-subtle hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3 text-text-main">{s.email || s.userId?.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-medium text-text-main">{s.planName}</td>
                    <td className="px-4 py-3 text-text-muted text-xs">{s.gateway}</td>
                    <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3 text-text-muted text-xs">{s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-3 justify-end">
                        {s.status === "active" && (
                          <>
                            <button onClick={() => doAction(s.id, "pause")} disabled={actionLoading === s.id} className="text-amber-600 dark:text-amber-400 hover:underline text-xs font-medium disabled:opacity-50">Pause</button>
                            <button onClick={() => doAction(s.id, "cancel")} disabled={actionLoading === s.id} className="text-red-500 hover:underline text-xs font-medium disabled:opacity-50">Cancel</button>
                          </>
                        )}
                        {s.status === "paused" && (
                          <button onClick={() => doAction(s.id, "resume")} disabled={actionLoading === s.id} className="text-green-600 dark:text-green-400 hover:underline text-xs font-medium disabled:opacity-50">Resume</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
