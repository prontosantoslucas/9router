import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/db/driver.js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getAdapter();
    const userCount = db.get(`SELECT COUNT(*) as count FROM users`)?.count || 0;
    const paidKeyCount = db.get(`SELECT COUNT(*) as count FROM apiKeys WHERE planId IS NOT NULL`)?.count || 0;
    const totalRevenue = db.get(`SELECT COALESCE(SUM(amountCents), 0) as total FROM payments WHERE status = 'paid'`)?.total || 0;
    const recentPayments = db.all(`SELECT p.amountCents, p.currency, p.status, p.createdAt, u.email FROM payments p LEFT JOIN users u ON u.id = p.userId ORDER BY p.createdAt DESC LIMIT 5`);
    return NextResponse.json({
      userCount,
      paidKeyCount,
      totalRevenueCents: totalRevenue,
      recentPayments,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
