import { NextResponse } from "next/server";
import {
  getCheckoutById, updateCheckoutStatus,
  getIntegrationByProvider,
} from "@/lib/db";

// Webhook unificado: Stripe, PayPal, Mercado Pago
export async function POST(request, { params }) {
  try {
    const { provider } = await params;
    const rawBody = await request.text();
    const body = JSON.parse(rawBody || "{}");

    // Stripe: verificar assinatura (se Stripe-Signature presente)
    if (provider === "stripe") {
      const integration = await getIntegrationByProvider("stripe");
      const { webhookSecret } = integration?.config || {};
      const signature = request.headers.get("stripe-signature");
      if (webhookSecret && signature) {
        const crypto = await import("crypto");
        const expected = crypto
          .createHmac("sha256", webhookSecret)
          .update(rawBody)
          .digest("hex");
        // Stripe usa formato t=...,v1=... — validação simplificada
        const v1 = signature.split(",").find((p) => p.startsWith("v1="))?.slice(3);
        if (v1 && v1 !== expected) {
          return NextResponse.json({ error: "invalid signature" }, { status: 400 });
        }
      }
    }

    const eventType = body.type || body.event_type || body.topic || "";
    let checkoutId = null;
    let status = null;

    // Stripe
    if (provider === "stripe") {
      checkoutId = body.data?.object?.metadata?.checkoutId || null;
      if (eventType === "checkout.session.completed") {
        status = "paid";
      } else if (eventType === "checkout.session.expired") {
        status = "expired";
      } else if (eventType === "checkout.session.async_payment_failed") {
        status = "failed";
      }
    }

    // PayPal
    if (provider === "paypal") {
      checkoutId = body.resource?.purchase_units?.[0]?.reference_id || body.reference_id || null;
      if (eventType === "CHECKOUT.ORDER.COMPLETED" || eventType === "PAYMENT.CAPTURE.COMPLETED") {
        status = "paid";
      } else if (eventType === "CHECKOUT.ORDER.CANCELLED") {
        status = "cancelled";
      }
      // PayPal envia external_reference — buscar por externalRef
      if (!checkoutId) {
        const { listCheckouts } = await import("@/lib/db");
        const externalRef = body.resource?.id || body.resource?.supplementary_data?.related_ids?.order_id || null;
        if (externalRef) {
          const matches = (await listCheckouts({ limit: 200 })).filter(
            (c) => c.externalRef === externalRef
          );
          checkoutId = matches[0]?.id || null;
        }
      }
    }

    // Mercado Pago
    if (provider === "mercadolivre") {
      checkoutId = body.data?.id || body.external_reference || null;
      // Para payment topics, buscar por external_reference
      if (body.data?.id && !body.external_reference) {
        const { getAdapter } = await import("@/lib/db/driver.js");
        const db = await getAdapter();
        const row = db.get("SELECT id FROM crmCheckouts WHERE externalRef = ?", [body.data.id]);
        checkoutId = row?.id || null;
      }
      if (eventType === "payment.created" || eventType === "payment.approved" || eventType === "merchant_order") {
        status = "paid";
      } else if (eventType === "payment.rejected") {
        status = "failed";
      } else if (eventType === "payment.cancelled") {
        status = "cancelled";
      }
    }

    if (checkoutId && status) {
      await updateCheckoutStatus(checkoutId, status, body.id || body.data?.id || null, {
        webhookEvent: eventType,
        gateway: provider,
      });

      // Registrar atividade no CRM
      try {
        const { getCheckoutById, createActivity } = await import("@/lib/db");
        const checkout = await getCheckoutById(checkoutId);
        if (checkout?.contactId) {
          await createActivity({
            contactId: checkout.contactId,
            type: "payment",
            description: `Pagamento ${status} via ${provider} — ${(checkout.amountCents / 100).toFixed(2)} ${checkout.currency}`,
            metadata: { checkoutId, event: eventType },
          });
        }
      } catch { /* fail-open */ }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`Webhook ${provider} error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}