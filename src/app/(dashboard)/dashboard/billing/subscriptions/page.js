"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const STATUS_STYLES = {
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  cancelled: "bg-red-100 text-red-800",
  expired: "bg-gray-100 text-gray-600",
};

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

  return (
    <div class="max-w-6xl mx-auto p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold">Subscriptions</h1>
          <p class="text-sm text-gray-500 mt-1">Manage active plans and renewal cycles</p>
        </div>
        <button
          onClick={handleRenewal}
          disabled={actionLoading === "renewal"}
          class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {actionLoading === "renewal" ? "Processing..." : "Process Renewals"}
        </button>
      </div>

      {loading ? (
        <div class="text-center py-12 text-gray-400">Loading...</div>
      ) : subs.length === 0 ? (
        <div class="text-center py-12 text-gray-400">No subscriptions yet.</div>
      ) : (
        <div class="bg-white rounded-lg border">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b bg-gray-50">
                  <th class="text-left px-4 py-3 font-medium">User</th>
                  <th class="text-left px-4 py-3 font-medium">Plan</th>
                  <th class="text-left px-4 py-3 font-medium">Gateway</th>
                  <th class="text-left px-4 py-3 font-medium">Status</th>
                  <th class="text-left px-4 py-3 font-medium">Period End</th>
                  <th class="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subs.map(s => (
                  <tr key={s.id} class="border-b hover:bg-gray-50">
                    <td class="px-4 py-3">{s.email || s.userId?.slice(0, 8)}</td>
                    <td class="px-4 py-3 font-medium">{s.planName}</td>
                    <td class="px-4 py-3 text-gray-500">{s.gateway}</td>
                    <td class="px-4 py-3"><span class={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[s.status] || "bg-gray-100"}`}>{s.status}</span></td>
                    <td class="px-4 py-3 text-gray-500 text-xs">{s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : "-"}</td>
                    <td class="px-4 py-3 text-right">
                      <div class="flex gap-2 justify-end">
                        {s.status === "active" && (
                          <>
                            <button onClick={() => doAction(s.id, "pause")} disabled={actionLoading === s.id} class="text-yellow-600 hover:text-yellow-800 text-xs">Pause</button>
                            <button onClick={() => doAction(s.id, "cancel")} disabled={actionLoading === s.id} class="text-red-500 hover:text-red-700 text-xs">Cancel</button>
                          </>
                        )}
                        {s.status === "paused" && (
                          <button onClick={() => doAction(s.id, "resume")} disabled={actionLoading === s.id} class="text-green-600 hover:text-green-800 text-xs">Resume</button>
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
