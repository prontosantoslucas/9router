import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/db/driver.js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getAdapter();
    const users = db.all(`SELECT u.*, (SELECT COUNT(*) FROM apiKeys WHERE userId = u.id AND planId IS NOT NULL) as keyCount, (SELECT COALESCE(SUM(amountCents), 0) FROM payments WHERE userId = u.id AND status = 'paid') as totalPaid FROM users u ORDER BY u.createdAt DESC`);
    return NextResponse.json({ users });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
