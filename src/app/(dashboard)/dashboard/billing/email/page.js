"use client";

import { useState } from "react";
import { Card, Button } from "@/shared/components";

export default function EmailSettingsPage() {
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  async function sendTest(e) {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to }) });
      const data = await res.json();
      setResult(data.ok ? { ok: true, msg: "Test email sent!" } : { ok: false, msg: data.error });
    } catch { setResult({ ok: false, msg: "Network error" }); }
    setSending(false);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Email Settings</h1>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Configuration</h2>
        <div className="text-sm text-text-muted space-y-2">
          <p><strong>RESEND_API_KEY</strong> — set as environment variable</p>
          <p><strong>RESEND_FROM_EMAIL</strong> — sender address (default: noreply@9router.com)</p>
          <p>Payment receipts are sent automatically via the webhook handler.</p>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Send Test Email</h2>
        <form onSubmit={sendTest} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Recipient</label>
            <input type="email" className="w-full px-3 py-2 rounded-md border border-border bg-surface text-text" value={to} onChange={e => setTo(e.target.value)} placeholder="you@example.com" required />
          </div>
          <Button type="submit" disabled={sending}>{sending ? "Sending..." : "Send Test"}</Button>
        </form>
        {result && (
          <p className={`mt-3 text-sm ${result.ok ? "text-green-600" : "text-red-500"}`}>{result.msg}</p>
        )}
      </Card>
    </div>
  );
}
