import { NextResponse } from "next/server";
import { getPlanById } from "@/lib/db/repos/plansRepo.js";
import { getGateway } from "@/lib/billing/gateways/index.js";

function baseUrl(request) {
  return process.env.NEXT_PUBLIC_BASE_URL || `http://${request.headers.get("host") || "localhost:20128"}`;
}

export async function POST(request) {
  try {
    const { planId, gateway, apiKeyId, method = "credit_card", amountCents, title } = await request.json();

    if (!gateway) {
      return NextResponse.json({ error: "gateway is required" }, { status: 400 });
    }

    let plan;
    if (planId) {
      plan = await getPlanById(planId);
      if (!plan) {
        // Fallback para planos padrão se não estiver no DB
        if (planId === "starter") {
          plan = { id: "starter", name: "Starter Gratuito", priceCents: 0, tokenLimit: 100000 };
        } else if (planId === "pro" || planId === "pro-developer") {
          plan = { id: "pro-developer", name: "Pro Developer", priceCents: 2990, tokenLimit: 5000000 };
        } else if (planId === "enterprise") {
          plan = { id: "enterprise", name: "Enterprise AI", priceCents: 9990, tokenLimit: 25000000 };
        } else {
          return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });
        }
      }
    } else if (amountCents) {
      // Recarga de Saldo Avulso (Top-up)
      plan = {
        id: `topup-${amountCents}`,
        name: title || `Recarga de Saldo - R$ ${(amountCents / 100).toFixed(2)}`,
        priceCents: amountCents,
        tokenLimit: Math.round((amountCents / 100) * 100000), // ex: 1 R$ = 100k tokens
      };
    } else {
      return NextResponse.json({ error: "planId or amountCents required" }, { status: 400 });
    }

    const driver = getGateway(gateway);
    const base = baseUrl(request);

    let session;
    if (gateway === "mercadopago" && method === "pix" && driver.createPixPayment) {
      session = await driver.createPixPayment(plan, { metadata: apiKeyId ? { apiKeyId } : {} });
    } else {
      session = await driver.createCheckout(plan, {
        successUrl: `${base}/dashboard/billing/success?gateway=${gateway}&session={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${base}/dashboard/billing/cancel`,
        metadata: apiKeyId ? { apiKeyId } : {},
        method,
      });
    }

    return NextResponse.json({
      url: session.url,
      checkoutId: session.externalId,
      qrCode: session.qrCode || null,
      qrCodeBase64: session.qrCodeBase64 || null,
      isMock: session.isMock || false,
    });
  } catch (e) {
    console.error("[billing/checkout]", e);
    return NextResponse.json({ error: e.message || "Checkout failed" }, { status: 500 });
  }
}
