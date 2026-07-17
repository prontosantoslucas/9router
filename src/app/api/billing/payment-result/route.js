import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/db/driver.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const gateway = searchParams.get("gateway");
    const externalId = searchParams.get("externalId");
    if (!gateway || !externalId) {
      return NextResponse.json({ error: "gateway and externalId required" }, { status: 400 });
    }
    const db = await getAdapter();
    const payment = db.get(`SELECT * FROM payments WHERE gateway = ? AND externalId = ?`, [gateway, externalId]);
    if (!payment) {
      return NextResponse.json({ found: false });
    }
    let raw = null;
    try { raw = JSON.parse(payment.raw); } catch { raw = {}; }
    let key = null;
    if (payment.apiKeyId) {
      key = db.get(`SELECT key, label FROM apiKeys WHERE id = ?`, [payment.apiKeyId]);
    }
    return NextResponse.json({
      found: true,
      status: payment.status,
      amountCents: payment.amountCents,
      currency: payment.currency,
      tempPassword: raw?.tempPassword || null,
      key: key?.key || null,
      keyLabel: key?.label || null,
      planId: payment.planId,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
