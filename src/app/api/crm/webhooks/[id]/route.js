import { NextResponse } from "next/server";
import { deleteWebhook } from "@/lib/db";

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await deleteWebhook(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/crm/webhooks/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
