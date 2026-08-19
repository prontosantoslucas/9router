import { NextResponse } from "next/server";
import { getDeals, createDeal } from "@/lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId") || undefined;
    const stage = searchParams.get("stage") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const deals = await getDeals({ contactId, stage, limit, offset });
    return NextResponse.json({ deals });
  } catch (error) {
    console.error("GET /api/crm/deals error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    if (!body.contactId || !body.title) {
      return NextResponse.json({ error: "contactId and title are required" }, { status: 400 });
    }

    const deal = await createDeal(body);
    return NextResponse.json({ deal }, { status: 201 });
  } catch (error) {
    console.error("POST /api/crm/deals error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
