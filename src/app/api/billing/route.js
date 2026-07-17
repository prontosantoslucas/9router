import { NextResponse } from "next/server";
import { getPlanById } from "@/lib/db/repos/plansRepo.js";
import { getGateway } from "@/lib/billing/gateways/index.js";

function baseUrl(request) {
  return process.env.NEXT_PUBLIC_BASE_URL || `http://${request.headers.get("host") || "localhost:20128"}`;
}

export async function POST(request) {
  try {
    const { planId, gateway, apiKeyId } = await request.json();
    if (!planId || !gateway) {
      return NextResponse.json({ error: "planId and gateway required" }, { status: 400 });
    }
    const plan = await getPlanById(planId);
    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: "plan not found" }, { status: 404 });
    }
    const driver = getGateway(gateway);
    const base = baseUrl(request);
    const session = await driver.createCheckout(plan, {
      successUrl: `${base}/dashboard/billing/success?gateway=${gateway}&session={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}/dashboard/billing/cancel`,
      metadata: apiKeyId ? { apiKeyId } : {},
    });
    return NextResponse.json({ url: session.url, checkoutId: session.externalId });
  } catch (e) {
    console.error("[billing/checkout]", e);
    return NextResponse.json({ error: e.message || "Checkout failed" }, { status: 500 });
  }
}
