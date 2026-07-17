import { NextResponse } from "next/server";
import { getBot } from "@/lib/telegram/bot.js";

export async function GET() {
  const bot = getBot();
  if (!bot) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not configured" }, { status: 400 });
  }
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL;
    if (!base) {
      return NextResponse.json({ error: "NEXT_PUBLIC_BASE_URL not set" }, { status: 400 });
    }
    const webhookUrl = `${base}/api/telegram/webhook`;
    await bot.telegram.setWebhook(webhookUrl);
    const info = await bot.telegram.getWebhookInfo();
    return NextResponse.json({ ok: true, webhookUrl, info });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
