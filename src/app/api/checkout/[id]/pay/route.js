import { NextResponse } from "next/server";
import { getCheckoutById } from "@/lib/db";
import { createPaymentSession, createSandboxIntegration } from "@/lib/payments";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const provider = body.provider || "mercadopago";

    const checkout = await getCheckoutById(id);
    if (!checkout) {
      return NextResponse.json({ error: "Checkout não encontrado" }, { status: 404 });
    }

    if (checkout.status === "paid") {
      return NextResponse.json({ error: "Este checkout já foi pago." }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:20127";

    try {
      // Cria a sessão real de pagamento no gateway configurado
      const result = await createPaymentSession(checkout, baseUrl, provider);
      return NextResponse.json({ checkoutUrl: result.checkoutUrl, externalRef: result.externalRef });
    } catch (err) {
      console.warn(`[Payment Pay Route] Falha ao criar sessão no gateway (${provider}):`, err.message);

      // Se explicitamente solicitado modo sandbox/mock
      if (body.mock === true) {
        await createSandboxIntegration(provider);
        const { updateCheckoutStatus } = await import("@/lib/db");
        await updateCheckoutStatus(id, "paid", `sandbox_${Date.now()}`, {
          gateway: provider,
          sandbox: true,
        });
        return NextResponse.json({ mock: true, message: "Pagamento simulado (modo teste/sandbox)" });
      }

      // Retorna o erro real com instrução clara para o usuário
      return NextResponse.json(
        { error: err.message },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("POST /api/checkout/[id]/pay error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}