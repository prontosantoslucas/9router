import { NextResponse } from "next/server";
import { getAllGatewayConfigs, upsertGatewayConfig } from "@/lib/billing/gatewayConfigRepo.js";

export const dynamic = "force-dynamic";

const SUPPORTED_GATEWAYS = [
  { id: "stripe", name: "Stripe", icon: "credit_card", defaultType: "Cartão / Global" },
  { id: "mercadopago", name: "Mercado Pago", icon: "qr_code_2", defaultType: "PIX / Cartão BR" },
  { id: "opennode", name: "OpenNode", icon: "currency_bitcoin", defaultType: "Bitcoin / USDT Crypto" },
  { id: "paypal", name: "PayPal", icon: "account_balance_wallet", defaultType: "PayPal Express" },
];

export async function GET() {
  try {
    const savedConfigs = await getAllGatewayConfigs();
    const configMap = new Map(savedConfigs.map((c) => [c.gateway, c]));

    const gateways = SUPPORTED_GATEWAYS.map((gw) => {
      const saved = configMap.get(gw.id);
      return {
        id: gw.id,
        name: gw.name,
        icon: gw.icon,
        type: gw.defaultType,
        status: saved ? (saved.enabled ? "active" : "inactive") : "active",
        testMode: saved?.data?.testMode ?? false,
        configured: !!saved?.data?.accessToken || !!saved?.data?.secret || !!process.env[`${gw.id.toUpperCase()}_ACCESS_TOKEN`] || !!process.env[`${gw.id.toUpperCase()}_SECRET_KEY`],
        updatedAt: saved?.updatedAt || null,
      };
    });

    return NextResponse.json({ gateways });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { gateway, enabled, testMode, credentials } = await request.json();
    if (!gateway) {
      return NextResponse.json({ error: "gateway is required" }, { status: 400 });
    }

    const updated = await upsertGatewayConfig(gateway, {
      enabled: enabled ?? true,
      data: {
        testMode: !!testMode,
        ...(credentials || {}),
      },
    });

    return NextResponse.json({ ok: true, gateway: updated });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
