import { request as undiciRequest } from "undici";

const NAME = "mercadopago";

function getEnv() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");
  return { token, base: "https://api.mercadopago.com" };
}

export async function createCheckout(plan, { successUrl, cancelUrl, metadata = {} }) {
  const cfg = getEnv();
  const payload = {
    items: [{ title: plan.name, quantity: 1, unit_price: (plan.priceCents || 0) / 100, currency_id: (plan.currency || "USD").toUpperCase() }],
    back_urls: { success: successUrl, failure: cancelUrl, pending: cancelUrl },
    auto_return: "approved",
    notification_url: metadata.webhookUrl || process.env.MERCADOPAGO_WEBHOOK_URL || "",
    metadata: { planId: plan.id, ...metadata },
  };
  const { statusCode, body } = await undiciRequest(`${cfg.base}/checkout/preferences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await body.json();
  if (statusCode >= 300 || data.error) {
    throw new Error(data.message || data.error || `MercadoPago checkout failed (${statusCode})`);
  }
  return { url: data.init_point, externalId: data.id, raw: data };
}

export async function verifyWebhook(request) {
  const cfg = getEnv();
  const rawBody = await request.text();
  let body;
  try { body = JSON.parse(rawBody); } catch { return { ok: false, error: "invalid JSON" }; }
  if (body.type !== "payment") return { ok: false, error: "not a payment event" };
  const paymentId = body.data?.id;
  if (!paymentId) return { ok: false, error: "missing payment id" };
  const { statusCode, body: resp } = await undiciRequest(`${cfg.base}/v1/payments/${paymentId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${cfg.token}` },
  });
  if (statusCode >= 300) return { ok: false, error: `payment not found (${statusCode})` };
  const payment = await resp.json();
  return { ok: true, event: parseEvent(payment) };
}

function parseEvent(payment) {
  const meta = payment.metadata || {};
  const status = String(payment.status || "").toLowerCase();
  return {
    type: statusToCanonical(status),
    gateway: NAME,
    externalId: payment.id,
    amountCents: Math.round((parseFloat(payment.transaction_amount) || 0) * 100),
    currency: (payment.currency_id || "USD").toUpperCase(),
    userId: meta.userId || null,
    apiKeyId: meta.apiKeyId || null,
    planId: meta.planId || null,
    customerEmail: payment.payer?.email || null,
    raw: payment,
  };
}

function statusToCanonical(status) {
  if (status === "approved") return "paid";
  if (status === "refunded" || status === "charged_back" || status === "cancelled") return "refunded";
  if (status === "rejected") return "failed";
  return status;
}
