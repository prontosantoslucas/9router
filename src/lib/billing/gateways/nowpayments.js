import crypto from "node:crypto";
import { request as undiciRequest } from "undici";
import { loadGatewayConfig } from "./config.js";

const NAME = "nowpayments";

async function getEnv() {
  const cfg = await loadGatewayConfig(NAME);
  const apiKey = cfg?.apiKey || process.env.NOWPAYMENTS_API_KEY;
  const ipnSecret = cfg?.ipnSecret || process.env.NOWPAYMENTS_IPN_SECRET;
  const email = cfg?.email || process.env.NOWPAYMENTS_EMAIL;
  const password = cfg?.password || process.env.NOWPAYMENTS_PASSWORD;
  if (!apiKey || !ipnSecret) throw new Error("NOWPAYMENTS_API_KEY and NOWPAYMENTS_IPN_SECRET required");
  return { apiKey, ipnSecret, email, password, base: "https://api.nowpayments.io/v1" };
}

async function getAuthHeader(cfg) {
  // Bearer key for most calls; optional JWT if email/password set.
  if (cfg.email && cfg.password) {
    try {
      const { statusCode, body } = await undiciRequest(`${cfg.base}/auth`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cfg.email, password: cfg.password }),
      });
      const data = await body.json();
      if (statusCode < 300 && data.token) return `Bearer ${data.token}`;
    } catch { /* fall back to static key */ }
  }
  return cfg.apiKey;
}

export async function createCheckout(plan, { successUrl, cancelUrl, metadata = {} }) {
  const cfg = await getEnv();
  const auth = await getAuthHeader(cfg);
  const payload = {
    price_amount: Number(plan.priceCents) / 100,
    price_currency: (plan.currency || "USD").toUpperCase(),
    pay_currency: "BTC", // user can change on widget
    order_id: metadata.planId || plan.id,
    order_description: plan.name,
    success_url: successUrl,
    cancel_url: cancelUrl,
    is_fee_paid_by_user: false,
  };
  const { statusCode, body } = await undiciRequest(`${cfg.base}/payment`, {
    method: "POST",
    headers: { "x-api-key": cfg.apiKey, Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await body.json();
  if (statusCode >= 300 || data.error) throw new Error(data.message || data.error || `NOWPayments payment failed (${statusCode})`);
  return { url: data.invoice_url, externalId: String(data.payment_id || data.id), raw: data };
}

export async function verifyWebhook(request) {
  const cfg = await getEnv();
  const rawBody = await request.text();
  const hmac = request.headers.get("x-nowpayments-sig") || "";
  const expected = crypto.createHmac("sha512", cfg.ipnSecret).update(rawBody).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hmac))) return { ok: false, error: "invalid signature" };
  const event = JSON.parse(rawBody);
  return { ok: true, event: parseEvent(event) };
}

function parseEvent(event) {
  const meta = event.payment_metadata || {};
  return {
    type: eventTypeToCanonical(event.payment_status),
    gateway: NAME,
    externalId: String(event.payment_id || event.id || ""),
    amountCents: Math.round((Number(event.price_amount) || 0) * 100),
    currency: (event.price_currency || "USD").toUpperCase(),
    userId: meta.userId || null,
    apiKeyId: meta.apiKeyId || null,
    planId: meta.planId || event.order_id || null,
    customerEmail: event.customer_email || null,
    raw: event,
  };
}

function eventTypeToCanonical(status) {
  if (status === "finished" || status === "confirmed" || status === "sending") return "paid";
  if (status === "failed" || status === "expired" || status === "refunded") return "failed";
  return status;
}
