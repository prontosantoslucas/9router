import { Telegraf, Markup } from "telegraf";
import { getPlans } from "@/lib/db/repos/plansRepo.js";
import { getAdapter } from "@/lib/db/driver.js";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_IDS = (process.env.TELEGRAM_ADMIN_IDS || "").split(",").map(s => s.trim()).filter(Boolean).map(Number);

let bot = null;

function isAdmin(ctx) {
  return ADMIN_IDS.length === 0 || ADMIN_IDS.includes(ctx.from?.id);
}

export function getBot() {
  if (!TOKEN) return null;
  if (!bot) {
    bot = new Telegraf(TOKEN);
    registerCommands();
  }
  return bot;
}

function registerCommands() {
  bot.start(async (ctx) => {
    const admin = isAdmin(ctx) ? " (admin)" : "";
    await ctx.reply(`MaxRouter Billing Bot${admin}\n\nCommands:\n/stats — billing overview\n/plans — list plans\n/users — list users (admin)\n/keys — list paid keys (admin)\n/help — this message`);
  });

  bot.help(async (ctx) => {
    await ctx.reply("/stats — billing overview\n/plans — list plans\n/users — list users (admin)\n/keys — list paid keys (admin)");
  });

  bot.command("stats", async (ctx) => {
    if (!isAdmin(ctx)) { await ctx.reply("Unauthorized"); return; }
    try {
      const db = await getAdapter();
      const userCount = db.get(`SELECT COUNT(*) as count FROM users`)?.count || 0;
      const paidKeyCount = db.get(`SELECT COUNT(*) as count FROM apiKeys WHERE planId IS NOT NULL`)?.count || 0;
      const totalRevenue = db.get(`SELECT COALESCE(SUM(amountCents), 0) as total FROM payments WHERE status = 'paid'`)?.total || 0;
      await ctx.reply(`📊 Billing Stats\n\nUsers: ${userCount}\nPaid Keys: ${paidKeyCount}\nRevenue: $${(totalRevenue / 100).toFixed(2)}`);
    } catch (e) {
      await ctx.reply(`Error: ${e.message}`);
    }
  });

  bot.command("plans", async (ctx) => {
    try {
      const plans = await getPlans();
      if (plans.length === 0) { await ctx.reply("No plans configured."); return; }
      let msg = "📋 Plans:\n";
      for (const p of plans.filter(p => p.isActive)) {
        msg += `\n• ${p.name}: $${(p.priceCents / 100).toFixed(2)} / ${p.durationDays}d`;
        if (p.tokenLimit) msg += ` | ${p.tokenLimit.toLocaleString()} tokens`;
      }
      await ctx.reply(msg);
    } catch (e) {
      await ctx.reply(`Error: ${e.message}`);
    }
  });

  bot.command("users", async (ctx) => {
    if (!isAdmin(ctx)) { await ctx.reply("Unauthorized"); return; }
    try {
      const db = await getAdapter();
      const users = db.all(`SELECT email, role, status, createdAt FROM users ORDER BY createdAt DESC LIMIT 20`);
      if (users.length === 0) { await ctx.reply("No users."); return; }
      let msg = "👥 Users (last 20):\n";
      for (const u of users) {
        msg += `\n• ${u.email} [${u.role}] ${u.status}`;
      }
      await ctx.reply(msg);
    } catch (e) {
      await ctx.reply(`Error: ${e.message}`);
    }
  });

  bot.command("keys", async (ctx) => {
    if (!isAdmin(ctx)) { await ctx.reply("Unauthorized"); return; }
    try {
      const db = await getAdapter();
      const keys = db.all(`SELECT k.key, k.label, p.name as plan, u.email FROM apiKeys k LEFT JOIN plans p ON p.id = k.planId LEFT JOIN users u ON u.id = k.userId WHERE k.planId IS NOT NULL ORDER BY k.createdAt DESC LIMIT 20`);
      if (keys.length === 0) { await ctx.reply("No paid keys."); return; }
      let msg = "🔑 Paid Keys (last 20):\n";
      for (const k of keys) {
        msg += `\n• ${k.key?.slice(0, 16)}... | ${k.label || "-"} | ${k.plan || "-"} | ${k.email || "-"}`;
      }
      await ctx.reply(msg);
    } catch (e) {
      await ctx.reply(`Error: ${e.message}`);
    }
  });
}
