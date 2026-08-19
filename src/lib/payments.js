import {
  getIntegrationByProvider, updateCheckoutStatus, createIntegration,
} from "@/lib/db";

// Cria uma sessão de pagamento no gateway configurado e retorna a URL de redirect
export async function createPaymentSession(checkout, baseUrl) {
  const provider = checkout.provider || (await resolveProvider(checkout));

  switch (provider) {
    case "stripe": return createStripeSession(checkout, baseUrl);
    case "paypal": return createPayPalSession(checkout, baseUrl);
    case "mercadolivre": return createMercadoLivreSession(checkout, baseUrl);
    default: throw new Error(`Provider não suportado: ${provider}`);
  }
}

async function resolveProvider(checkout) {
  const integration = await getIntegrationById(checkout.integrationId);
  return integration?.provider;
}

export async function getIntegrationById(id) {
  const { getAdapter } = await import("@/lib/db/driver.js");
  const db = await getAdapter();
  const row = db.get("SELECT * FROM crmIntegrations WHERE id = ?", [id]);
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    config: JSON.parse(row.config),
    isActive: row.isActive === 1,
  };
}

// ---------- STRIPE ----------
async function createStripeSession(checkout, baseUrl) {
  const integration = await getIntegrationById(checkout.integrationId);
  const { secretKey } = integration?.config || {};

  if (!secretKey) throw new Error("Stripe não configurado (secretKey ausente)");

  const body = {
    mode: "payment",
    line_items: [{
      price_data: {
        currency: (checkout.currency || "BRL").toLowerCase(),
        unit_amount: checkout.amountCents,
        product_data: { name: checkout.description || "Pagamento" },
      },
      quantity: 1,
    }],
    success_url: `${baseUrl}/checkout/${checkout.id}?status=success`,
    cancel_url: `${baseUrl}/checkout/${checkout.id}?status=cancelled`,
    metadata: { checkoutId: checkout.id },
  };

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(flattenObject(body)).toString(),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe error: ${data.error?.message || res.status}`);

  await updateCheckoutStatus(checkout.id, "pending", data.id, { gateway: "stripe" });
  return { checkoutUrl: data.url, externalRef: data.id };
}

function flattenObject(obj, prefix = "", res = {}) {
  for (const [key, val] of Object.entries(obj)) {
    const k = prefix ? `${prefix}[${key}]` : key;
    if (val && typeof val === "object" && !Array.isArray(val)) flattenObject(val, k, res);
    else res[k] = val;
  }
  return res;
}

// ---------- PAYPAL ----------
async function createPayPalSession(checkout, baseUrl) {
  const integration = await getIntegrationById(checkout.integrationId);
  const { clientId, clientSecret } = integration?.config || {};

  if (!clientId || !clientSecret) throw new Error("PayPal não configurado (clientId/clientSecret ausentes)");

  // 1. Obter access token
  const tokenRes = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(`PayPal auth error: ${tokenData.error_description || tokenRes.status}`);
  const accessToken = tokenData.access_token;

  // 2. Criar pedido
  const orderRes = await fetch("https://api-m.paypal.com/v2/checkout/orders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        amount: {
          currency_code: checkout.currency || "BRL",
          value: (checkout.amountCents / 100).toFixed(2),
        },
        description: checkout.description || "Pagamento",
      }],
      application_context: {
        return_url: `${baseUrl}/checkout/${checkout.id}?status=success`,
        cancel_url: `${baseUrl}/checkout/${checkout.id}?status=cancelled`,
      },
    }),
  });
  const order = await orderRes.json();
  if (!orderRes.ok) throw new Error(`PayPal order error: ${order.message || orderRes.status}`);

  const approveLink = order.links?.find((l) => l.rel === "approve");
  await updateCheckoutStatus(checkout.id, "pending", order.id, { gateway: "paypal" });
  return { checkoutUrl: approveLink?.href, externalRef: order.id };
}

// ---------- MERCADO LIVRE (Mercado Pago Checkout Pro) ----------
async function createMercadoLivreSession(checkout, baseUrl) {
  const integration = await getIntegrationById(checkout.integrationId);
  const { accessToken } = integration?.config || {};

  if (!accessToken) throw new Error("Mercado Livre não configurado (accessToken ausente)");

  const body = {
    items: [{
      title: checkout.description || "Pagamento",
      quantity: 1,
      currency_id: checkout.currency || "BRL",
      unit_price: checkout.amountCents / 100,
    }],
    back_urls: {
      success: `${baseUrl}/checkout/${checkout.id}?status=success`,
      failure: `${baseUrl}/checkout/${checkout.id}?status=failed`,
      pending: `${baseUrl}/checkout/${checkout.id}?status=pending`,
    },
    auto_return: "approved",
    external_reference: checkout.id,
  };

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Mercado Pago error: ${data.message || res.status}`);

  await updateCheckoutStatus(checkout.id, "pending", data.id, { gateway: "mercadolivre" });
  return { checkoutUrl: data.init_point, externalRef: data.id };
}

// ---------- SANDBOX HELPERS ----------
export async function createSandboxIntegration(provider) {
  // Permite gerar link de checkout mesmo sem gateway configurado (modo dev)
  const sandboxConfigs = {
    stripe: { secretKey: "sk_test_sandbox" },
    paypal: { clientId: "sandbox", clientSecret: "sandbox" },
    mercadolivre: { accessToken: "TEST-sandbox" },
  };
  const existing = await getIntegrationByProvider(provider);
  if (existing) return existing;
  return createIntegration({
    provider,
    name: `${provider} (Sandbox)`,
    config: sandboxConfigs[provider] || {},
  });
}