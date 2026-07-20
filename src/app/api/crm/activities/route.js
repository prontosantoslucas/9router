import { NextResponse } from "next/server";
import { getActivities, logActivity } from "@/lib/crm/crmRepo.js";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId") || undefined;
    return NextResponse.json({ activities: await getActivities(contactId) });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const activity = await logActivity(data);
    return NextResponse.json({ activity }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}
