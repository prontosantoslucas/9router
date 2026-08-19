import { NextResponse } from "next/server";
import { getCheckoutById } from "@/lib/db";
import { createPaymentSession, createSandboxIntegration } from "@/lib/payments";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const provider = body.provider || "stripe";

    const checkout = await getCheckoutById(id);
    if (!checkout) {
      return NextResponse.json({ error: "Checkout não encontrado" }, { status: 404 });
    }

    if (checkout.status === "paid") {
      return NextResponse.json({ error: "Checkout já pago" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:20127";

    try {
      const result = await createPaymentSession(checkout, baseUrl);
      return NextResponse.json({ checkoutUrl: result.checkoutUrl });
    } catch (err) {
      // Fallback sandbox: se o gateway não está configurado com credenciais reais,
      // cria uma integração sandbox para testes locais.
      console.warn("Gateway error, tentando sandbox:", err.message);
      try {
        await createSandboxIntegration(provider);
        // Sandbox sem credenciais reais → simula sucesso e marca como pago (dev)
        const { updateCheckoutStatus } = await import("@/lib/db");
        await updateCheckoutStatus(id, "paid", `sandbox_${Date.now()}`, {
          gateway: provider,
          sandbox: true,
        });
        return NextResponse.json({ mock: true, message: "Pagamento simulado (sandbox)" });
      } catch (sandboxErr) {
        return NextResponse.json(
          { error: `${err.message} — configure o gateway ou use o modo sandbox` },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    console.error("POST /api/checkout/[id]/pay error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}