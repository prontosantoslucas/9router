import { NextResponse } from "next/server";
import { getWebhooks, createWebhook, deleteWebhook } from "@/lib/db";

export async function GET() {
  try {
    const webhooks = await getWebhooks();
    return NextResponse.json({ webhooks });
  } catch (error) {
    console.error("GET /api/crm/webhooks error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    if (!body.url || !body.events || !Array.isArray(body.events)) {
      return NextResponse.json({ error: "url and events array are required" }, { status: 400 });
    }

    const webhook = await createWebhook(body);
    return NextResponse.json({ webhook }, { status: 201 });
  } catch (error) {
    console.error("POST /api/crm/webhooks error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
