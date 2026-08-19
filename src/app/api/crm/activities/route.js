import { NextResponse } from "next/server";
import { getActivities, createActivity } from "@/lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId") || undefined;
    const dealId = searchParams.get("dealId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const activities = await getActivities({ contactId, dealId, limit, offset });
    return NextResponse.json({ activities });
  } catch (error) {
    console.error("GET /api/crm/activities error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    if (!body.contactId || !body.type) {
      return NextResponse.json({ error: "contactId and type are required" }, { status: 400 });
    }

    const activity = await createActivity(body);
    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    console.error("POST /api/crm/activities error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
