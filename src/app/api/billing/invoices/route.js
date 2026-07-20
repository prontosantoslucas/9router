import { NextResponse } from "next/server";
import { getInvoices, getInvoice, markInvoicePaid, generateInvoice } from "@/lib/billing/invoicing.js";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const userId = searchParams.get("userId");
    const status = searchParams.get("status");
    if (id) return NextResponse.json({ invoice: await getInvoice(id) });
    return NextResponse.json({ invoices: await getInvoices({ userId, status }) });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const { userId, subscriptionId, periodStart, periodEnd, description } = await request.json();
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
    const result = await generateInvoice(userId, { subscriptionId, periodStart, periodEnd, description });
    return NextResponse.json(result, { status: result.invoice ? 201 : 200 });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function PATCH(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const invoice = await markInvoicePaid(id);
    return NextResponse.json({ invoice });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
