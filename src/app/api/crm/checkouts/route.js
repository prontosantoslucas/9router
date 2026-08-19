import { NextResponse } from "next/server";
import { createCheckout, getIntegrations, getContactById, listCheckouts } from "@/lib/db";

export async function POST(request) {
  try {
    const body = await request.json();
    const { contactId, amountCents, currency, description, dealId } = body;

    if (!contactId || !amountCents) {
      return NextResponse.json({ error: "contactId e amountCents são obrigatórios" }, { status: 400 });
    }

    const contact = await getContactById(contactId);
    if (!contact) return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });

    // Escolhe integração ativa do provider (se especificado) ou a primeira disponível
    const integrations = await getIntegrations();
    let integration = null;

    if (body.provider) {
      integration = integrations.find((i) => i.provider === body.provider && i.isActive);
    }
    if (!integration) {
      integration = integrations.find((i) => i.isActive);
    }

    if (!integration) {
      return NextResponse.json(
        { error: "Nenhum gateway de pagamento configurado. Configure Stripe, PayPal ou Mercado Livre primeiro." },
        { status: 400 }
      );
    }

    const checkout = await createCheckout({
      contactId,
      dealId: dealId || null,
      integrationId: integration.id,
      amountCents,
      currency: currency || "BRL",
      description: description || `Pagamento — ${contact.name}`,
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:20127";
    const checkoutUrl = `${baseUrl}/checkout/${checkout.id}`;

    return NextResponse.json({
      checkout,
      checkoutUrl,
      provider: integration.provider,
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/crm/checkouts error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId") || undefined;
    const status = searchParams.get("status") || undefined;

    const checkouts = await listCheckouts({ contactId, status, limit: 200 });

    // Anexar info do contato
    const enriched = [];
    for (const c of checkouts) {
      const contact = await getContactById(c.contactId).catch(() => null);
      enriched.push({
        ...c,
        contactName: contact?.name || "Desconhecido",
        contactEmail: contact?.email || null,
      });
    }

    return NextResponse.json({ checkouts: enriched });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}