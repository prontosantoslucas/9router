import { v4 as uuidv4 } from "uuid";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { getPlanById } from "@/lib/db/repos/plansRepo.js";
import { getOrCreateUserByEmail, updateUser } from "@/lib/db/repos/usersRepo.js";
import { createPaidApiKey, extendApiKey, getApiKeyById } from "@/lib/db/repos/apiKeysRepo.js";
import { createPayment } from "@/lib/db/repos/paymentsRepo.js";
import { createSubscription, updateSubscription, getSubscriptionByExternal } from "@/lib/db/repos/subscriptionsRepo.js";
import { isWebhookProcessed, markWebhookProcessed } from "@/lib/db/repos/abuseRepo.js";

// Apply a verified gateway webhook event. Idempotent via webhookEvents.
export async function applyWebhookEvent(gateway, event) {
  if (!event || !event.externalId) throw new Error("invalid webhook event");
  const already = await isWebhookProcessed(gateway, event.externalId);
  if (already) return { action: "ignored", reason: "already processed" };

  if (event.type === "paid") return creditPurchase(gateway, event);
  if (event.type === "refunded") return recordRefund(gateway, event);
  if (event.type === "failed") return recordFailure(gateway, event);

  await markWebhookProcessed(gateway, event.externalId, event.type);
  return { action: "noted", type: event.type };
}

async function creditPurchase(gateway, event) {
  const plan = await getPlanById(event.planId);
  if (!plan) throw new Error(`plan not found: ${event.planId}`);

  const { user, password } = await ensureUser(event);

  let key;
  if (event.apiKeyId && (key = await getApiKeyById(event.apiKeyId))) {
    const end = newEnd(key.periodEnd, plan.durationDays);
    key = await extendApiKey(key.id, { periodEnd: end, addTokenBalance: plan.tokenLimit ?? 0, addBalanceCents: 0, planId: plan.id });
  } else {
    const end = newEnd(null, plan.durationDays);
    key = await createPaidApiKey({
      userId: user.id,
      planId: plan.id,
      key: `sk-${uuidv4().replace(/-/g, "").slice(0, 16)}-${uuidv4().replace(/-/g, "").slice(0, 8)}`,
      label: plan.name,
      periodStart: new Date().toISOString(),
      periodEnd: end,
      tokenBalance: plan.tokenLimit ?? null,
      balanceCents: plan.costLimitCents ?? 0,
    });
  }

  const rawPayload = { ...(event.raw || {}), tempPassword: password };

  const { getAdapter } = await import("@/lib/db/driver.js");
  const db = await getAdapter();
  db.transaction(() => {
    const existing = db.get(`SELECT id FROM payments WHERE gateway = ? AND externalId = ?`, [gateway, event.externalId]);
    if (existing) {
      db.run(`UPDATE payments SET userId = ?, apiKeyId = ?, planId = ?, amountCents = ?, currency = ?, status = ?, raw = ? WHERE id = ?`,
        [user.id, key.id, plan.id, event.amountCents || 0, event.currency || "USD", "paid", JSON.stringify(rawPayload), existing.id]);
    } else {
      db.run(`INSERT INTO payments(id, userId, apiKeyId, planId, gateway, externalId, amountCents, currency, status, createdAt, raw) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), user.id, key.id, plan.id, gateway, event.externalId, event.amountCents || 0, event.currency || "USD", "paid", new Date().toISOString(), JSON.stringify(rawPayload)]);
    }
  });

  const sub = await getSubscriptionByExternal(gateway, event.externalId);
  if (sub) {
    await updateSubscription(sub.id, { status: "active", currentPeriodEnd: key.periodEnd, planId: plan.id });
  } else {
    await createSubscription({
      userId: user.id,
      planId: plan.id,
      gateway,
      externalId: event.externalId,
      status: "active",
      currentPeriodEnd: key.periodEnd,
      data: event.raw,
    });
  }

  await markWebhookProcessed(gateway, event.externalId, "paid");
  return { action: "credited", userId: user.id, apiKeyId: key.id, password, keyString: key.key };
}

async function ensureUser(event) {
  // First purchase: create user from the email supplied by the gateway.
  // (Renewals pass apiKeyId and may omit email; we reuse the key''s user.)
    const email = event.customerEmail;
  if (!email) throw new Error("customer email missing");
  const password = generatePassword();
  const user = await getOrCreateUserByEmail(email, await bcrypt.hash(password, 10));
  return { user, password };
}

function generatePassword() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

function newEnd(existingIso, durationDays) {
  const now = Date.now();
  const base = existingIso ? Math.max(now, Date.parse(existingIso) || now) : now;
  return new Date(base + (durationDays || 1) * 86400000).toISOString();
}

async function recordRefund(gateway, event) {
  const p = await findPayment(gateway, event.externalId);
  if (p) {
    const { getAdapter } = await import("@/lib/db/driver.js");
    const db = await getAdapter();
    db.run(`UPDATE payments SET status = ? WHERE id = ?`, ["refunded", p.id]);
  }
  await markWebhookProcessed(gateway, event.externalId, "refunded");
  return { action: "refunded" };
}

async function recordFailure(gateway, event) {
  const p = await findPayment(gateway, event.externalId);
  if (p) {
    const { getAdapter } = await import("@/lib/db/driver.js");
    const db = await getAdapter();
    db.run(`UPDATE payments SET status = ? WHERE id = ?`, ["failed", p.id]);
  }
  await markWebhookProcessed(gateway, event.externalId, "failed");
  return { action: "failed" };
}

async function findPayment(gateway, externalId) {
  const { getAdapter } = await import("@/lib/db/driver.js");
  const db = await getAdapter();
  return db.get(`SELECT * FROM payments WHERE gateway = ? AND externalId = ?`, [gateway, externalId]);
}
