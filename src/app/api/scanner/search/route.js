import { NextResponse } from "next/server";
import { runScan, PROVIDERS } from "@/lib/scanner/scanner.js";
import { sendScannerAlert } from "@/lib/scanner/alerts.js";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await runScan({ providers: body.providers || Object.keys(PROVIDERS), sources: body.sources });

    // Send alerts if valid keys found and notify flag is set
    if (body.notify && result.valid > 0) {
      const validKeys = result.results.filter(r => r.status === "valid");
      sendScannerAlert(validKeys).catch(err => console.error("[scanner] alert failed:", err));
    }

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ providers: Object.fromEntries(Object.entries(PROVIDERS).map(([k, v]) => [k, v.name])) });
}

// Standalone alert endpoint: send notification for un-notified valid keys
export async function PUT(request) {
  try {
    const { getAdapter } = await import("@/lib/db/driver.js");
    const db = await getAdapter();
    const unNotified = db.all("SELECT * FROM scannedKeys WHERE status = 'valid' AND notified = 0 LIMIT 50");
    if (unNotified.length === 0) return NextResponse.json({ sent: false, reason: "no un-notified valid keys" });
    const result = await sendScannerAlert(unNotified);
    return NextResponse.json({ sent: true, keys: unNotified.length, result });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
