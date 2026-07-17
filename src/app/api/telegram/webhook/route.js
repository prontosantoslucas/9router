import { getBot } from "@/lib/telegram/bot.js";

export async function POST(request) {
  const bot = getBot();
  if (!bot) {
    return new Response("Bot not configured", { status: 200 });
  }
  const raw = await request.text();
  try {
    const update = JSON.parse(raw);
    await bot.handleUpdate(update);
  } catch {}
  return new Response("OK", { status: 200 });
}
