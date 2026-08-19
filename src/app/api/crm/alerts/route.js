import { NextResponse } from "next/server";
import { getAlerts, resolveAlert } from "@/lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId") || undefined;
    const resolved = searchParams.get("resolved") === "true" ? true : searchParams.get("resolved") === "false" ? false : undefined;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const alerts = await getAlerts({ contactId, resolved, limit, offset });
    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("GET /api/crm/alerts error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
