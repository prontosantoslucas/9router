import {
  getIntegrationByProvider, updateCheckoutStatus, createIntegration,
} from "@/lib/db";

// Cria uma sessão de pagamento no gateway configurado e retorna a URL de redirect
export async function createPaymentSession(checkout, baseUrl, requestedProvider = null) {
  const provider = requestedProvider || checkout.provider || (await resolveProvider(checkout)) || "mercadopago";

  switch (provider) {
    case "stripe":
      return createStripeSession(checkout, baseUrl);
    case "paypal":
      return createPayPalSession(checkout, baseUrl);
    case "mercadolivre":
    case "mercadopago":
      return createMercadoPagoSession(checkout, baseUrl);
    default:
      throw new Error(`Gateway de pagamento não suportado: ${provider}`);
  }
}

async function resolveProvider(checkout) {
  if (checkout.integrationId) {
    const integration = await getIntegrationById(checkout.integrationId);
    if (integration?.provider) return integration.provider;
  }
  return null;
}

export async function getIntegrationById(id) {
  if (!id) return null;
  const { getAdapter } = await import("@/lib/db/driver.js");
  const db = await getAdapter();
  const row = db.get("SELECT * FROM crmIntegrations WHERE id = ?", [id]);
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    config: JSON.parse(row.config || "{}"),
    isActive: row.isActive === 1,
  };
}

// ---------- STRIPE ----------
async function createStripeSession(checkout, baseUrl) {
  const integration =
    (checkout.integrationId ? await getIntegrationById(checkout.integrationId) : null) ||
    (await getIntegrationByProvider("stripe"));
  const { secretKey } = integration?.config || {};

  if (!secretKey) {
    throw new Error("Stripe não configurado. Por favor, cadastre a Secret Key (sk_live_... ou sk_test_...) nas configurações de Gateways.");
  }

  const body = {
    mode: "payment",
    line_items: [{
      price_data: {
        currency: (checkout.currency || "BRL").toLowerCase(),
        unit_amount: checkout.amountCents,
        product_data: { name: checkout.description || "Pagamento de Serviços" },
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
  if (!res.ok) {
    throw new Error(`Erro na API do Stripe (${res.status}): ${data.error?.message || "Falha na autenticação"}`);
  }

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
  const integration =
    (checkout.integrationId ? await getIntegrationById(checkout.integrationId) : null) ||
    (await getIntegrationByProvider("paypal"));
  const { clientId, clientSecret, mode } = integration?.config || {};

  if (!clientId || !clientSecret) {
    throw new Error("PayPal não configurado. Por favor, cadastre o Client ID e Client Secret nas configurações de Gateways.");
  }

  // Tenta autenticar primeiro no ambiente configurado (Live padrão, ou Sandbox se especificado)
  const isSandbox = mode === "sandbox" || clientId.startsWith("sb-") || clientId.includes("sandbox");
  let apiBase = isSandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

  let tokenRes = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  let tokenData = await tokenRes.json();

  // Se falhar no Live com invalid_client, tenta no Sandbox automaticamente
  if (!tokenRes.ok && !isSandbox) {
    const sandboxTest = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (sandboxTest.ok) {
      apiBase = "https://api-m.sandbox.paypal.com";
      tokenRes = sandboxTest;
      tokenData = await sandboxTest.json();
    }
  }

  if (!tokenRes.ok) {
    throw new Error(
      `Falha na autenticação do PayPal (${tokenRes.status}): ${tokenData.error_description || tokenData.error || "Client ID ou Secret inválidos"}. Verifique se as credenciais cadastradas são de Produção (Live) no painel do PayPal Developer.`
    );
  }

  const accessToken = tokenData.access_token;

  // 2. Criar pedido real no PayPal
  const currencyCode = checkout.currency === "BRL" || !checkout.currency ? "BRL" : checkout.currency;
  const orderRes = await fetch(`${apiBase}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        amount: {
          currency_code: currencyCode,
          value: (checkout.amountCents / 100).toFixed(2),
        },
        description: checkout.description || "Pagamento",
      }],
      application_context: {
        brand_name: "9Router Checkout",
        user_action: "PAY_NOW",
        return_url: `${baseUrl}/checkout/${checkout.id}?status=success`,
        cancel_url: `${baseUrl}/checkout/${checkout.id}?status=cancelled`,
      },
    }),
  });

  const order = await orderRes.json();
  if (!orderRes.ok) {
    throw new Error(`Erro ao criar ordem no PayPal (${orderRes.status}): ${order.message || JSON.stringify(order.details || order)}`);
  }

  const approveLink = order.links?.find((l) => l.rel === "approve" || l.rel === "payer-action");
  if (!approveLink?.href) {
    throw new Error("PayPal não retornou link de aprovação/redirecionamento.");
  }

  await updateCheckoutStatus(checkout.id, "pending", order.id, { gateway: "paypal", apiBase });
  return { checkoutUrl: approveLink.href, externalRef: order.id };
}

// ---------- MERCADO PAGO ----------
async function createMercadoPagoSession(checkout, baseUrl) {
  const integration =
    (checkout.integrationId ? await getIntegrationById(checkout.integrationId) : null) ||
    (await getIntegrationByProvider("mercadopago")) ||
    (await getIntegrationByProvider("mercadolivre"));

  const { accessToken } = integration?.config || {};

  if (!accessToken) {
    throw new Error("Mercado Pago não configurado. Por favor, cadastre o Access Token (APP_USR-...) nas configurações de Gateways.");
  }

  const body = {
    items: [{
      title: checkout.description || "Pagamento de Serviços",
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
      Authorization: `Bearer ${accessToken.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Erro na API do Mercado Pago (${res.status}): ${data.message || "Token inválido"}`);
  }

  const checkoutUrl = data.init_point || data.sandbox_init_point;
  await updateCheckoutStatus(checkout.id, "pending", data.id, { gateway: "mercadopago" });
  return { checkoutUrl, externalRef: data.id };
}

// ---------- SANDBOX HELPERS ----------
export async function createSandboxIntegration(provider) {
  const sandboxConfigs = {
    stripe: { secretKey: "sk_test_sandbox" },
    paypal: { clientId: "sandbox", clientSecret: "sandbox" },
    mercadopago: { accessToken: "TEST-sandbox" },
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