import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/db/driver.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const db = await getAdapter();
    let rows;
    if (userId) {
      rows = db.all(`SELECT * FROM payments WHERE userId = ? ORDER BY createdAt DESC LIMIT ?`, [userId, limit]);
    } else {
      rows = db.all(`SELECT p.*, u.email as userEmail FROM payments p LEFT JOIN users u ON u.id = p.userId ORDER BY p.createdAt DESC LIMIT ?`, [limit]);
    }
    return NextResponse.json({ payments: rows.map(r => ({ ...r, raw: r.raw ? JSON.parse(r.raw) : null })) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
