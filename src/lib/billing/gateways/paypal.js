import { request as undiciRequest } from "undici";

const NAME = "paypal";

function getEnv() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!clientId) throw new Error("PAYPAL_CLIENT_ID not configured");
  if (!secret) throw new Error("PAYPAL_CLIENT_SECRET not configured");
  if (!webhookId) throw new Error("PAYPAL_WEBHOOK_ID not configured");
  const base = process.env.PAYPAL_SANDBOX === "true" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
  return { clientId, secret, webhookId, base };
}

async function getAccessToken(cfg) {
  const { statusCode, body } = await undiciRequest(`${cfg.base}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const data = await body.json();
  if (statusCode >= 300 || data.error) throw new Error(data.error_description || `PayPal auth failed (${statusCode})`);
  return data.access_token;
}

export async function createCheckout(plan, { successUrl, cancelUrl, metadata = {} }) {
  const cfg = getEnv();
  const token = await getAccessToken(cfg);
  const customId = JSON.stringify({ planId: plan.id, ...metadata });
  const payload = {
    intent: "CAPTURE",
    purchase_units: [{
      amount: { currency_code: (plan.currency || "USD"), value: ((plan.priceCents || 0) / 100).toFixed(2) },
      description: plan.name,
      custom_id: customId,
    }],
    payment_source: {
      paypal: { experience_context: { return_url: successUrl, cancel_url: cancelUrl, user_action: "PAY_NOW" } },
    },
  };
  const { statusCode, body } = await undiciRequest(`${cfg.base}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": customId },
    body: JSON.stringify(payload),
  });
  const data = await body.json();
  if (statusCode >= 300 || data.error) throw new Error(data.message || data.error || `PayPal checkout failed (${statusCode})`);
  const approval = data.links?.find(l => l.rel === "approve");
  return { url: approval?.href || data.links?.[0]?.href, externalId: data.id, raw: data };
}

export async function verifyWebhook(request) {
  const cfg = getEnv();
  const rawBody = await request.text();
  const headers = {
    "paypal-auth-algo": request.headers.get("paypal-auth-algo") || "",
    "paypal-cert-url": request.headers.get("paypal-cert-url") || "",
    "paypal-transmission-id": request.headers.get("paypal-transmission-id") || "",
    "paypal-transmission-sig": request.headers.get("paypal-transmission-sig") || "",
    "paypal-transmission-time": request.headers.get("paypal-transmission-time") || "",
  };
  const token = await getAccessToken(cfg);
  const verifyBody = { verification_key: "", ...headers, webhook_id: cfg.webhookId, webhook_event: JSON.parse(rawBody) };
  const { statusCode, body } = await undiciRequest(`${cfg.base}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(verifyBody),
  });
  const result = await body.json();
  if (statusCode >= 300 || result.verification_status !== "SUCCESS") {
    return { ok: false, error: `PayPal webhook verify failed: ${result.verification_status}` };
  }
  const event = JSON.parse(rawBody);
  return { ok: true, event: parseEvent(event) };
}

function parseEvent(event) {
  const resource = event.resource || {};
  let meta = {};
  try {
    const customId = resource.custom_id || resource.purchase_units?.[0]?.custom_id || "";
    meta = customId ? JSON.parse(customId) : {};
  } catch { /* ignore */ }
  const amount = parseFloat(resource.amount?.value || resource.amount?.total || resource.seller_receivable_breakdown?.net_amount?.value || 0);
  const currency = resource.amount?.currency_code || resource.amount?.currency || resource.seller_receivable_breakdown?.net_amount?.currency_code || "USD";
  return {
    type: eventTypeToCanonical(event.event_type, resource.status),
    gateway: NAME,
    externalId: resource.id || event.id,
    amountCents: Math.round(amount * 100),
    currency: currency.toUpperCase(),
    userId: meta.userId || null,
    apiKeyId: meta.apiKeyId || null,
    planId: meta.planId || null,
    customerEmail: resource.payer?.email_address || resource.email_address || null,
    raw: event,
  };
}

function eventTypeToCanonical(type, resourceStatus) {
  if (type === "PAYMENT.CAPTURE.COMPLETED" || (type === "CHECKOUT.ORDER.APPROVED" && resourceStatus === "COMPLETED")) return "paid";
  if (type === "PAYMENT.CAPTURE.REFUNDED") return "refunded";
  if (type === "PAYMENT.CAPTURE.DENIED" || type === "CHECKOUT.ORDER.APPROVED" && resourceStatus === "VOIDED") return "failed";
  return type;
}
