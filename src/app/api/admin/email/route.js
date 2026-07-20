import { NextResponse } from "next/server";
import { send } from "@/lib/email/emailService.js";

export async function POST(request) {
  try {
    const { to } = await request.json();
    if (!to) return NextResponse.json({ error: "Recipient email required" }, { status: 400 });
    const result = await send({
      to,
      subject: "Test Email from 9Router",
      html: "<h2>Test Email</h2><p>If you received this, email configuration is working!</p>",
      text: "Test Email — If you received this, email configuration is working!",
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json({ ok: true, id: result.id });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
