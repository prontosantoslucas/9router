import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/db/driver.js";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const db = await getAdapter();
    const row = db.get(
      `SELECT p.*, u.email as userEmail, pl.name as planName 
       FROM payments p 
       LEFT JOIN users u ON u.id = p.userId 
       LEFT JOIN plans pl ON pl.id = p.planId 
       WHERE p.id = ? OR p.externalId = ?`,
      [id, id]
    );

    if (!row) {
      return NextResponse.json({ error: "Comprovante/Fatura não encontrada" }, { status: 404 });
    }

    return NextResponse.json({
      invoice: {
        id: row.id,
        externalId: row.externalId,
        date: row.createdAt,
        amountCents: row.amountCents,
        currency: row.currency,
        gateway: row.gateway,
        status: row.status,
        userEmail: row.userEmail || "cliente@9router.com",
        planName: row.planName || "Recarga de Saldo / Assinatura",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
