import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/db/driver.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const db = await getAdapter();
    let rows;
    if (userId) {
      rows = db.all(`SELECT * FROM apiKeys WHERE userId = ? ORDER BY createdAt DESC`, [userId]);
    } else {
      rows = db.all(`SELECT k.*, u.email as userEmail FROM apiKeys k LEFT JOIN users u ON u.id = k.userId ORDER BY k.createdAt DESC`);
    }
    return NextResponse.json({ keys: rows });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
