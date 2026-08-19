import { NextResponse } from "next/server";
import { getCheckoutById, getIntegrations } from "@/lib/db";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const checkout = await getCheckoutById(id);

    if (!checkout) {
      return NextResponse.json({ error: "Checkout não encontrado" }, { status: 404 });
    }

    // Info do contato (apenas dados públicos)
    const { getContactById } = await import("@/lib/db");
    const contact = await getContactById(checkout.contactId);

    // Gateways disponíveis e ativos
    const integrations = await getIntegrations();
    const providers = integrations
      .filter((i) => i.isActive)
      .map((i) => i.provider);

    return NextResponse.json({
      checkout: {
        id: checkout.id,
        amountCents: checkout.amountCents,
        currency: checkout.currency,
        description: checkout.description,
        status: checkout.status,
        createdAt: checkout.createdAt,
        paidAt: checkout.paidAt,
      },
      contact: contact
        ? { name: contact.name, email: contact.email, company: contact.company }
        : null,
      providers,
    });
  } catch (error) {
    console.error("GET /api/checkout/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}