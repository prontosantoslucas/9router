import crypto from "node:crypto";
import { request as undiciRequest } from "undici";

const NAME = "mercadopago";

function getEnv() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const webhook = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!accessToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");
  if (!webhook) throw new Error("MERCADOPAGO_WEBHOOK_SECRET not configured");
  return { accessToken, webhook, base: "https://api.mercadopago.com" };
}

function encodeForm(obj) {
  return Object.entries(obj)
    .flatMap(([k, v]) => v === undefined || v === null ? [] : `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
}

export async function createCheckout(plan, { successUrl, cancelUrl, metadata = {} }) {
  const cfg = getEnv();
  const payload = {
    items: [{ title: plan.name, quantity: 1, unit_price: Number(plan.priceCents) / 100, currency_id: (plan.currency || "USD").toUpperCase() }],
    back_urls: { success: successUrl, failure: cancelUrl, pending: successUrl },
    auto_return: "approved",
    external_reference: metadata.planId || plan.id,
    metadata: { planId: plan.id, ...metadata },
  };
  const { statusCode, body } = await undiciRequest(`${cfg.base}/checkout/preferences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await body.json();
  if (statusCode >= 300 || data.error) throw new Error(data.message || data.error || `MercadoPago preference failed (${statusCode})`);
  return { url: data.init_point, externalId: data.id, raw: data };
}

export async function verifyWebhook(request) {
  const cfg = getEnv();
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature") || "";
  const ts = request.headers.get("x-request-id");
  // MercadoPago sends `ts=...,v1=...` in x-signature; secret is the signing secret.
  const parts = signature.split(",").reduce((acc, p) => { const [k,v] = p.split("="); if (k && v) acc[k]=v; return acc; }, {});
  if (!parts.v1) return { ok: false, error: "missing x-signature" };
  const signed = `${parts.ts}.${rawBody}`;
  const expected = crypto.createHmac("sha256", cfg.webhook).update(signed).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1))) return { ok: false, error: "invalid signature" };
  const event = JSON.parse(rawBody);
  return { ok: true, event: parseEvent(event) };
}

function parseEvent(event) {
  const data = event.data || {};
  const payment = data.id ? data : event;
  const meta = payment.metadata || {};
  return {
    type: eventTypeToCanonical(event.type || (payment.status === "approved" ? "payment.created" : "unknown")),
    gateway: NAME,
    externalId: String(payment.id || ""),
    amountCents: Math.round((payment.transaction_amount || 0) * 100),
    currency: (payment.currency_id || "USD").toUpperCase(),
    userId: meta.userId || null,
    apiKeyId: meta.apiKeyId || null,
    planId: meta.planId || payment.external_reference || null,
    customerEmail: payment.payer?.email || payment.additional_info?.payer?.email || null,
    raw: event,
  };
}

function eventTypeToCanonical(type) {
  if (type === "payment.created" || type === "payment.updated") return "paid";
  return type;
}
