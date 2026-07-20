import crypto from "node:crypto";
import { request as undiciRequest } from "undici";
import { loadGatewayConfig } from "./config.js";

const NAME = "stripe";

async function getEnv() {
  const cfg = await loadGatewayConfig(NAME);
  const secret = cfg?.secret || process.env.STRIPE_SECRET_KEY;
  const webhook = cfg?.webhook || process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_SECRET_KEY not configured");
  if (!webhook) throw new Error("STRIPE_WEBHOOK_SECRET not configured");
  return { secret, webhook, base: "https://api.stripe.com/v1" };
}

function base64url(str) {
  return Buffer.from(str).toString("base64url");
}

function encodeForm(obj) {
  return Object.entries(obj)
    .flatMap(([k, v]) => v === undefined || v === null ? [] : [`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`])
    .join("&");
}

export async function createCheckout(plan, { successUrl, cancelUrl, metadata = {} }) {
  const cfg = await getEnv();
  const payload = {
    mode: "payment",
    "line_items[0][price_data][currency]": (plan.currency || "USD").toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(plan.priceCents),
    "line_items[0][price_data][product_data][name]": plan.name,
    "line_items[0][quantity]": "1",
    success_url: successUrl,
    cancel_url: cancelUrl,
    "metadata[planId]": plan.id,
    ...Object.fromEntries(Object.entries(metadata).map(([k,v]) => [`metadata[${k}]`, v])),
  };
  const { statusCode, body } = await undiciRequest(`${cfg.base}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encodeForm(payload),
  });
  const data = await body.json();
  if (statusCode >= 300 || data.error) {
    throw new Error(data.error?.message || `Stripe checkout failed (${statusCode})`);
  }
  return { url: data.url, externalId: data.id, raw: data };
}

export async function verifyWebhook(request) {
  const cfg = await getEnv();
  const signature = request.headers.get("stripe-signature") || "";
  const rawBody = await request.text();
  return verifySignature(rawBody, signature, cfg.webhook);
}

function verifySignature(payload, signature, secret) {
  const parts = signature.split(",").reduce((acc, p) => {
    const [k, v] = p.split("=");
    if (k && v !== undefined) acc[k] = v;
    return acc;
  }, {});
  const timestamp = parts.t;
  const sig = parts.v1;
  if (!timestamp || !sig) return { ok: false, error: "missing stripe-signature fields" };
  const signed = `${timestamp}.${payload}`;
  const expected = crypto.createHmac("sha256", secret).update(signed).digest("hex");
  if (expected.length !== sig.length) return { ok: false, error: "signature length mismatch" };
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return { ok: false, error: "invalid signature" };
  const event = JSON.parse(payload);
  const object = event?.data?.object || {};
  return { ok: true, event: parseEvent(event, object) };
}

function parseEvent(event, object) {
  const meta = object.metadata || {};
  return {
    type: eventTypeToCanonical(event.type),
    gateway: NAME,
    externalId: object.id,
    amountCents: object.amount_total ?? (object.amount ? object.amount / 100 : 0),
    currency: (object.currency || "USD").toUpperCase(),
    userId: meta.userId || null,
    apiKeyId: meta.apiKeyId || null,
    planId: meta.planId || null,
    customerEmail: object.customer_details?.email || object.customer_email || object.receipt_email || null,
    raw: event,
  };
}

function eventTypeToCanonical(type) {
  if (type === "checkout.session.completed") return "paid";
  if (type === "charge.refunded") return "refunded";
  if (type === "charge.failed") return "failed";
  return type;
}
