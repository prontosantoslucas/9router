import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "@/lib/db/driver.js";
import { getPlanById } from "@/lib/db/repos/plansRepo.js";
import { extendApiKey, getApiKeyByUserId } from "@/lib/db/repos/apiKeysRepo.js";
import { createPayment } from "@/lib/db/repos/paymentsRepo.js";
import { generateInvoice } from "./invoicing.js";
import { sendPaymentReceipt } from "@/lib/email/emailService.js";

export async function getSubscriptions(filters = {}) {
  const db = await getAdapter();
  const where = [];
  const params = [];
  if (filters.userId) { where.push("s.userId = ?"); params.push(filters.userId); }
  if (filters.status) { where.push("s.status = ?"); params.push(filters.status); }
  if (filters.gateway) { where.push("s.gateway = ?"); params.push(filters.gateway); }
  const sql = "SELECT s.*, p.name as planName, p.priceCents, p.currency, u.email FROM subscriptions s LEFT JOIN plans p ON p.id = s.planId LEFT JOIN users u ON u.id = s.userId" + (where.length ? " WHERE " + where.join(" AND ") : "") + " ORDER BY s.createdAt DESC";
  return db.all(sql, params);
}

export async function getSubscription(id) {
  const db = await getAdapter();
  return db.get("SELECT s.*, p.name as planName, p.priceCents, p.currency FROM subscriptions s LEFT JOIN plans p ON p.id = s.planId WHERE s.id = ?", [id]);
}

export async function cancelSubscription(id, reason) {
  const db = await getAdapter();
  const sub = db.get("SELECT * FROM subscriptions WHERE id = ?", [id]);
  if (!sub) throw new Error("subscription not found");
  db.run("UPDATE subscriptions SET status = 'cancelled', updatedAt = ? WHERE id = ?", [new Date().toISOString(), id]);
  return { ok: true };
}

export async function pauseSubscription(id) {
  const db = await getAdapter();
  db.run("UPDATE subscriptions SET status = 'paused', updatedAt = ? WHERE id = ?", [new Date().toISOString(), id]);
  return { ok: true };
}

export async function resumeSubscription(id) {
  const db = await getAdapter();
  db.run("UPDATE subscriptions SET status = 'active', updatedAt = ? WHERE id = ?", [new Date().toISOString(), id]);
  return { ok: true };
}

// Check for expiring subscriptions and auto-renew or notify
export async function processSubscriptionRenewals() {
  const db = await getAdapter();
  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 86400000).toISOString(); // 3 days from now
  const expired = new Date(now.getTime() - 86400000).toISOString(); // 1 day ago

  // Find active subs ending within 3 days or already expired
  const expiring = db.all(
    "SELECT s.*, p.name as planName, p.priceCents, p.durationDays, p.currency FROM subscriptions s LEFT JOIN plans p ON p.id = s.planId WHERE s.status = 'active' AND (s.currentPeriodEnd <= ? OR s.currentPeriodEnd <= ?)",
    [soon, expired]
  );

  const results = [];
  for (const sub of expiring) {
    const plan = await getPlanById(sub.planId);
    if (!plan || !plan.isActive) {
      // Plan no longer available — mark as expired
      db.run("UPDATE subscriptions SET status = 'expired', updatedAt = ? WHERE id = ?", [now.toISOString(), sub.id]);
      results.push({ subId: sub.id, action: "expired", reason: "plan inactive" });
      continue;
    }

    const periodEnd = new Date(sub.currentPeriodEnd);
    if (periodEnd < now) {
      // Expired — try to generate invoice and notify
      try {
        const inv = await generateInvoice(sub.userId, {
          subscriptionId: sub.id,
          periodStart: new Date(periodEnd.getTime() - plan.durationDays * 86400000).toISOString(),
          periodEnd: sub.currentPeriodEnd,
          description: `Auto-invoice — ${plan.name}`,
        });
        results.push({ subId: sub.id, action: "invoiced", invoiceTotal: inv.invoice?.totalCents });
      } catch (e) {
        results.push({ subId: sub.id, action: "error", error: e.message });
      }

      // Extend if still active (will need payment to truly continue)
      const newEnd = new Date(now.getTime() + plan.durationDays * 86400000).toISOString();
      db.run("UPDATE subscriptions SET currentPeriodEnd = ?, updatedAt = ? WHERE id = ?", [newEnd, now.toISOString(), sub.id]);

      // Extend the associated API key
      const keys = db.all("SELECT id FROM apiKeys WHERE userId = ? AND planId = ? AND isActive = 1", [sub.userId, sub.planId]);
      for (const key of keys) {
        await extendApiKey(key.id, { periodEnd: newEnd, addTokenBalance: plan.tokenLimit || 0 });
      }

      results.push({ subId: sub.id, action: "renewed", periodEnd: newEnd });
    } else {
      // Expiring soon — just notify (send reminder)
      results.push({ subId: sub.id, action: "reminder_due", expiresAt: sub.currentPeriodEnd });
    }
  }
  return results;
}
