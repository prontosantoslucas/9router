import { NextResponse } from "next/server";
import { getDealById, updateDeal, deleteDeal } from "@/lib/db";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const deal = await getDealById(id);
    
    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    return NextResponse.json({ deal });
  } catch (error) {
    console.error("GET /api/crm/deals/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const deal = await updateDeal(id, body);
    
    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    return NextResponse.json({ deal });
  } catch (error) {
    console.error("PUT /api/crm/deals/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await deleteDeal(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/crm/deals/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
