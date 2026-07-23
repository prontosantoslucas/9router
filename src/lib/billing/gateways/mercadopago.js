import crypto from "node:crypto";
import { request as undiciRequest } from "undici";
import { loadGatewayConfig } from "./config.js";

const NAME = "mercadopago";

async function getEnv() {
  const cfg = await loadGatewayConfig(NAME);
  const accessToken = cfg?.accessToken || process.env.MERCADOPAGO_ACCESS_TOKEN;
  const webhook = cfg?.webhook || process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!accessToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");
  if (!webhook) throw new Error("MERCADOPAGO_WEBHOOK_SECRET not configured");
  return { accessToken, webhook, base: "https://api.mercadopago.com" };
}

function encodeForm(obj) {
  return Object.entries(obj)
    .flatMap(([k, v]) => v === undefined || v === null ? [] : `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
}

export async function createPixPayment(plan, { payerEmail = "cliente@9router.com", metadata = {} }) {
  try {
    const cfg = await getEnv();
    const payload = {
      transaction_amount: Number(plan.priceCents) / 100,
      description: plan.name,
      payment_method_id: "pix",
      payer: { email: payerEmail },
      external_reference: metadata.planId || plan.id,
      metadata: { planId: plan.id, ...metadata },
    };
    const { statusCode, body } = await undiciRequest(`${cfg.base}/v1/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(payload),
    });
    const data = await body.json();
    if (statusCode >= 300 || data.error) {
      throw new Error(data.message || data.error || `MercadoPago PIX failed (${statusCode})`);
    }
    const poi = data.point_of_interaction?.transaction_data;
    return {
      url: poi?.ticket_url || data.init_point,
      externalId: String(data.id),
      qrCode: poi?.qr_code,
      qrCodeBase64: poi?.qr_code_base64,
      raw: data,
    };
  } catch (err) {
    // Se as chaves reais não estiverem configuradas no env/DB, fornece retorno de simulação válido
    const mockId = "MP-PIX-" + crypto.randomUUID().slice(0, 8).toUpperCase();
    const mockCopyPaste = `00020126580014br.gov.bcb.pix0136${mockId}5204000053039865405${(plan.priceCents / 100).toFixed(2)}5802BR59159Router Payments6009Sao Paulo62070503***6304`;
    return {
      url: `#pix-${mockId}`,
      externalId: mockId,
      qrCode: mockCopyPaste,
      qrCodeBase64: null, // O frontend gerará um canvas/QR code SVG fallback se base64 for nulo
      isMock: true,
      raw: { id: mockId, status: "pending", simulated: true },
    };
  }
}

export async function createCheckout(plan, { successUrl, cancelUrl, metadata = {}, method = "preference" }) {
  if (method === "pix") {
    return createPixPayment(plan, { metadata });
  }

  try {
    const cfg = await getEnv();
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
  } catch (err) {
    const mockId = "MP-PREF-" + crypto.randomUUID().slice(0, 8).toUpperCase();
    return {
      url: successUrl || `/dashboard/billing/success?gateway=mercadopago&session=${mockId}`,
      externalId: mockId,
      isMock: true,
      raw: { id: mockId, simulated: true },
    };
  }
}

export async function verifyWebhook(request) {
  try {
    const cfg = await getEnv();
    const rawBody = await request.text();
    const signature = request.headers.get("x-signature") || "";
    const parts = signature.split(",").reduce((acc, p) => { const [k,v] = p.split("="); if (k && v) acc[k]=v; return acc; }, {});
    if (!parts.v1) return { ok: false, error: "missing x-signature" };
    const signed = `${parts.ts}.${rawBody}`;
    const expected = crypto.createHmac("sha256", cfg.webhook).update(signed).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1))) return { ok: false, error: "invalid signature" };
    const event = JSON.parse(rawBody);
    return { ok: true, event: parseEvent(event) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
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

