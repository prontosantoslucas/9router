import { NextResponse } from "next/server";
import { resolveAlert } from "@/lib/db";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    await resolveAlert(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/crm/alerts/[id]/resolve error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
