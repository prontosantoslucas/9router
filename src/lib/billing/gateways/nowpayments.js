import crypto from "node:crypto";
import { request as undiciRequest } from "undici";

const NAME = "nowpayments";

function getEnv() {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!apiKey) throw new Error("NOWPAYMENTS_API_KEY not configured");
  if (!ipnSecret) throw new Error("NOWPAYMENTS_IPN_SECRET not configured");
  return { apiKey, ipnSecret, base: "https://api.nowpayments.io/v1" };
}

export async function createCheckout(plan, { successUrl, cancelUrl, metadata = {} }) {
  const cfg = getEnv();
  const payload = {
    price_amount: (plan.priceCents || 0) / 100,
    price_currency: (plan.currency || "USD").toUpperCase(),
    pay_currency: metadata.payCurrency || "USDT",
    order_id: `${plan.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    order_description: plan.name,
    ipn_callback_url: metadata.webhookUrl || process.env.NOWPAYMENTS_WEBHOOK_URL || "",
    success_url: successUrl,
    cancel_url: cancelUrl || successUrl,
    is_fixed_rate: true,
    is_fee_paid_by_user: true,
    ...Object.fromEntries(Object.entries(metadata).filter(([k]) => !["webhookUrl", "payCurrency"].includes(k)).map(([k, v]) => [`metadata[${k}]`, v])),
  };
  const { statusCode, body } = await undiciRequest(`${cfg.base}/invoice`, {
    method: "POST",
    headers: { "x-api-key": cfg.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await body.json();
  if (statusCode >= 300 || data.error || data.message) {
    throw new Error(data.message || data.error || `NOWPayments invoice failed (${statusCode})`);
  }
  return { url: data.invoice_url, externalId: data.id, raw: data };
}

export async function verifyWebhook(request) {
  const cfg = getEnv();
  const rawBody = await request.text();
  const sig = request.headers.get("x-nowpayments-sig") || "";
  if (!sig) return { ok: false, error: "missing x-nowpayments-sig header" };
  const expected = crypto.createHmac("sha512", cfg.ipnSecret).update(rawBody).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return { ok: false, error: "invalid signature" };
  let body;
  try { body = JSON.parse(rawBody); } catch { return { ok: false, error: "invalid JSON" }; }
  if (!body.invoice_id) return { ok: false, error: "missing invoice_id" };
  return { ok: true, event: parseEvent(body) };
}

function parseEvent(body) {
  const meta = body.metadata || {};
  return {
    type: statusToCanonical(body.payment_status || body.status),
    gateway: NAME,
    externalId: body.invoice_id || body.payment_id,
    amountCents: Math.round((parseFloat(body.price_amount || body.actually_paid || 0)) * 100),
    currency: (body.price_currency || "USD").toUpperCase(),
    userId: meta.userId || null,
    apiKeyId: meta.apiKeyId || null,
    planId: meta.planId || body.order_id?.split("-")[0] || null,
    customerEmail: null,
    raw: body,
  };
}

function statusToCanonical(status) {
  const s = String(status || "").toLowerCase();
  if (s === "finished") return "paid";
  if (s === "failed" || s === "expired") return "failed";
  if (s === "refunded") return "refunded";
  return s;
}
