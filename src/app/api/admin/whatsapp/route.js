import { NextResponse } from "next/server";
import { sendText } from "@/lib/whatsapp/whatsappService.js";

export async function POST(request) {
  try {
    const { to } = await request.json();
    if (!to) return NextResponse.json({ error: "Recipient phone number required" }, { status: 400 });
    const result = await sendText({ to, body: "Test message from 9Router — WhatsApp integration works!" });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json({ ok: true, id: result.id });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
