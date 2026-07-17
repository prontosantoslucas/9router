import { NextResponse } from "next/server";
import { getGateway } from "@/lib/billing/gateways/index.js";
import { applyWebhookEvent } from "@/lib/billing/credit.js";

export async function POST(request, { params }) {
  const gateway = (await params).gateway;
  try {
    const driver = getGateway(gateway);
    const { ok, error, event } = await driver.verifyWebhook(request);
    if (!ok) {
      console.warn(`[billing/webhook/${gateway}] verify failed:`, error);
      return NextResponse.json({ error: "Invalid webhook" }, { status: 401 });
    }
    const result = await applyWebhookEvent(gateway, event);
    return NextResponse.json(result);
  } catch (e) {
    console.error(`[billing/webhook/${gateway}]`, e);
    return NextResponse.json({ error: e.message || "Webhook failed" }, { status: 500 });
  }
}
