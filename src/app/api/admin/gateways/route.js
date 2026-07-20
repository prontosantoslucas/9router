import { NextResponse } from "next/server";
import { listGateways } from "@/lib/billing/gateways/index.js";
import { getAllGatewayConfigs, upsertGatewayConfig, deleteGatewayConfig } from "@/lib/billing/gatewayConfigRepo.js";

const GATEWAY_FIELDS = {
  stripe:       [{ key: "secret", label: "Secret Key", type: "password" }, { key: "webhook", label: "Webhook Secret", type: "password" }],
  mercadopago:  [{ key: "accessToken", label: "Access Token", type: "password" }, { key: "webhook", label: "Webhook Secret", type: "password" }],
  paypal:       [{ key: "clientId", label: "Client ID", type: "text" }, { key: "secret", label: "Secret", type: "password" }, { key: "webhookId", label: "Webhook ID", type: "text" }, { key: "baseUrl", label: "Environment", type: "select", options: [{ value: "https://api-m.sandbox.paypal.com", label: "Sandbox" }, { value: "https://api-m.paypal.com", label: "Live" }] }],
  nowpayments:  [{ key: "apiKey", label: "API Key", type: "password" }, { key: "ipnSecret", label: "IPN Secret", type: "password" }, { key: "email", label: "Email (optional)", type: "text" }, { key: "password", label: "Password (optional)", type: "password" }],
};

export async function GET() {
  try {
    const gateways = listGateways();
    const configs = await getAllGatewayConfigs();
    const configMap = {};
    for (const c of configs) configMap[c.gateway] = c;
    const result = gateways.map(g => ({
      gateway: g,
      fields: GATEWAY_FIELDS[g] || [],
      enabled: configMap[g]?.enabled || false,
      configured: !!configMap[g] || !!process.env[getEnvVarForGateway(g)],
      data: configMap[g]?.data || {},
    }));
    return NextResponse.json({ gateways: result });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function getEnvVarForGateway(gateway) {
  const map = { stripe: "STRIPE_SECRET_KEY", mercadopago: "MERCADOPAGO_ACCESS_TOKEN", paypal: "PAYPAL_CLIENT_ID", nowpayments: "NOWPAYMENTS_API_KEY" };
  return map[gateway] || "";
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { gateway, enabled, data } = body;
    if (!gateway) return NextResponse.json({ error: "Gateway is required" }, { status: 400 });
    const result = await upsertGatewayConfig(gateway, { enabled, data });
    return NextResponse.json({ gateway: result });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const gateway = searchParams.get("gateway");
    if (!gateway) return NextResponse.json({ error: "Gateway is required" }, { status: 400 });
    await deleteGatewayConfig(gateway);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
