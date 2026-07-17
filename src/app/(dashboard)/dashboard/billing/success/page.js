"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, Button, Badge } from "@/shared/components";
import Link from "next/link";

export default function BillingSuccessPage() {
  const searchParams = useSearchParams();
  const gateway = searchParams.get("gateway");
  const session = searchParams.get("session");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!gateway || !session) {
      setError("Invalid checkout session");
      setLoading(false);
      return;
    }
    let cancelled = false;
    let attempts = 0;

    async function poll() {
      while (attempts < 30 && !cancelled) {
        attempts++;
        try {
          const res = await fetch(`/api/billing/payment-result?gateway=${encodeURIComponent(gateway)}&externalId=${encodeURIComponent(session)}`);
          const data = await res.json();
          if (cancelled) return;
          if (data.found && data.status === "paid") {
            setResult(data);
            setLoading(false);
            return;
          }
        } catch {}
        await new Promise(r => setTimeout(r, 2000));
      }
      if (!cancelled) {
        setError("Payment confirmation timed out. Your payment may still be processing.");
        setLoading(false);
      }
    }
    poll();
    return () => { cancelled = true; };
  }, [gateway, session]);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <p className="text-text-muted">Waiting for payment confirmation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <Card className="p-6">
          <div className="text-4xl mb-4">⏳</div>
          <h2 className="text-xl font-semibold mb-2">Still Processing</h2>
          <p className="text-text-muted mb-4">{error}</p>
          <Link href="/dashboard/billing"><Button variant="primary">Back to Billing</Button></Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <Card className="p-6">
        <div className="text-4xl mb-4">🎉</div>
        <h2 className="text-xl font-semibold mb-2">Payment Successful!</h2>
        <p className="text-text-muted mb-6">Your plan has been activated.</p>

        {result?.key && (
          <div className="text-left mb-6 p-4 rounded-lg bg-bg border border-border">
            <p className="text-sm font-medium mb-1">API Key</p>
            <code className="block text-xs font-mono bg-black/5 dark:bg-white/5 p-2 rounded break-all">{result.key}</code>
          </div>
        )}

        {result?.tempPassword && (
          <div className="text-left mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-sm font-medium mb-1 text-amber-600 dark:text-amber-400">Temporary Password</p>
            <code className="block text-xs font-mono bg-black/5 dark:bg-white/5 p-2 rounded break-all">{result.tempPassword}</code>
            <p className="text-xs text-text-muted mt-2">Save this password. It will not be shown again.</p>
          </div>
        )}

        {result?.amountCents && (
          <p className="text-sm text-text-muted mb-6">Amount: ${(result.amountCents / 100).toFixed(2)} {result.currency}</p>
        )}

        <div className="flex gap-2 justify-center">
          <Link href="/dashboard/billing"><Button variant="primary">Go to Billing</Button></Link>
        </div>
      </Card>
    </div>
  );
}
