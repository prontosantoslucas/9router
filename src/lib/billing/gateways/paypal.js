import crypto from "node:crypto";
import { request as undiciRequest } from "undici";
import { loadGatewayConfig } from "./config.js";

const NAME = "paypal";

async function getEnv() {
  const cfg = await loadGatewayConfig(NAME);
  const clientId = cfg?.clientId || process.env.PAYPAL_CLIENT_ID;
  const secret = cfg?.secret || process.env.PAYPAL_SECRET;
  const webhookId = cfg?.webhookId || process.env.PAYPAL_WEBHOOK_ID;
  const base = cfg?.baseUrl || process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com";
  if (!clientId || !secret) throw new Error("PAYPAL_CLIENT_ID and PAYPAL_SECRET required");
  if (!webhookId) throw new Error("PAYPAL_WEBHOOK_ID required");
  return { clientId, secret, webhookId, base };
}

async function getAccessToken(cfg) {
  const { statusCode, body } = await undiciRequest(`${cfg.base}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const data = await body.json();
  if (statusCode >= 300) throw new Error(data.error_description || `PayPal token failed ${statusCode}`);
  return data.access_token;
}

export async function createCheckout(plan, { successUrl, cancelUrl, metadata = {} }) {
  const cfg = await getEnv();
  const token = await getAccessToken(cfg);
  const payload = {
    intent: "CAPTURE",
    purchase_units: [{
      amount: { currency_code: (plan.currency || "USD").toUpperCase(), value: (Number(plan.priceCents) / 100).toFixed(2) },
      custom_id: plan.id,
      description: plan.name,
      payee: {},
    }],
    application_context: { return_url: successUrl, cancel_url: cancelUrl },
  };
  const { statusCode, body } = await undiciRequest(`${cfg.base}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Prefer": "return=representation" },
    body: JSON.stringify(payload),
  });
  const data = await body.json();
  if (statusCode >= 300 || data.error) throw new Error(data.message || data.error || `PayPal order failed (${statusCode})`);
  const approve = data.links?.find(l => l.rel === "approve")?.href;
  return { url: approve, externalId: data.id, raw: data };
}

export async function verifyWebhook(request) {
  const cfg = await getEnv();
  const rawBody = await request.text();
  const headers = { "auth-algo": request.headers.get("paypal-auth-algo"), "cert-url": request.headers.get("paypal-cert-url"), "transmission-id": request.headers.get("paypal-transmission-id"), "transmission-sig": request.headers.get("paypal-transmission-sig"), "transmission-time": request.headers.get("paypal-transmission-time") };
  if (Object.values(headers).some(h => !h)) return { ok: false, error: "missing PayPal webhook headers" };
  const token = await getAccessToken(cfg);
  const { statusCode, body } = await undiciRequest(`${cfg.base}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ auth_algo: headers["auth-algo"], cert_url: headers["cert-url"], transmission_id: headers["transmission-id"], transmission_sig: headers["transmission-sig"], transmission_time: headers["transmission-time"], webhook_id: cfg.webhookId, webhook_event: JSON.parse(rawBody) }),
  });
  const data = await body.json();
  if (statusCode >= 300 || data.verification_status !== "SUCCESS") return { ok: false, error: "PayPal webhook verification failed" };
  const event = JSON.parse(rawBody);
  return { ok: true, event: parseEvent(event) };
}

function parseEvent(event) {
  const res = event.resource || {};
  const unit = res.purchase_units?.[0] || {};
  const meta = res.metadata || {};
  const capture = res.purchase_units?.[0]?.payments?.captures?.[0] || {};
  const amount = capture.amount || unit.amount || {};
  return {
    type: eventTypeToCanonical(event.event_type),
    gateway: NAME,
    externalId: res.id || capture.id || event.id,
    amountCents: Math.round((Number(amount.value) || 0) * 100),
    currency: (amount.currency_code || "USD").toUpperCase(),
    userId: meta.user_id || meta.userId || null,
    apiKeyId: meta.api_key_id || meta.apiKeyId || null,
    planId: meta.plan_id || meta.planId || unit.custom_id || null,
    customerEmail: res.payer?.email_address || null,
    raw: event,
  };
}

function eventTypeToCanonical(type) {
  if (type === "CHECKOUT.ORDER.APPROVED" || type === "PAYMENT.CAPTURE.COMPLETED") return "paid";
  return type;
}
