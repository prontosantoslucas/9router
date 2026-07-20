"use client";

import { useState } from "react";
import { Card, Button } from "@/shared/components";

export default function WhatsAppSettingsPage() {
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  async function sendTest(e) {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to }) });
      const data = await res.json();
      setResult(data.ok ? { ok: true, msg: "Test message sent!" } : { ok: false, msg: data.error });
    } catch { setResult({ ok: false, msg: "Network error" }); }
    setSending(false);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">WhatsApp Notifications</h1>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Configuration</h2>
        <div className="text-sm text-text-muted space-y-2">
          <p>Uses <strong>WhatsApp Cloud API</strong> (Meta). Set these env vars:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><code>WHATSAPP_PHONE_NUMBER_ID</code> — from Meta Business account</li>
            <li><code>WHATSAPP_ACCESS_TOKEN</code> — long-lived access token</li>
            <li><code>WHATSAPP_TO</code> — admin number to receive payment notifications</li>
          </ul>
          <p className="mt-2">Notifications are sent automatically on each payment.</p>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Send Test Message</h2>
        <form onSubmit={sendTest} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Recipient phone (incl. country code)</label>
            <input type="text" className="w-full px-3 py-2 rounded-md border border-border bg-surface text-text" value={to} onChange={e => setTo(e.target.value)} placeholder="5511999999999" required />
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
