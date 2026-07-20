import { NextResponse } from "next/server";
import { getSubscriptions, getSubscription, cancelSubscription, pauseSubscription, resumeSubscription, processSubscriptionRenewals } from "@/lib/billing/subscriptionManager.js";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const userId = searchParams.get("userId");
    const status = searchParams.get("status");
    if (id) return NextResponse.json({ subscription: await getSubscription(id) });
    return NextResponse.json({ subscriptions: await getSubscriptions({ userId, status }) });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function PATCH(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const { action } = await request.json();
    if (action === "cancel") return NextResponse.json(await cancelSubscription(id));
    if (action === "pause") return NextResponse.json(await pauseSubscription(id));
    if (action === "resume") return NextResponse.json(await resumeSubscription(id));
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST() {
  try {
    const results = await processSubscriptionRenewals();
    return NextResponse.json({ processed: results.length, results });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
