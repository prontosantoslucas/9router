import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/db/driver.js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getAdapter();
    const keys = db.all(`SELECT k.*, u.email as userEmail, p.name as planName FROM apiKeys k LEFT JOIN users u ON u.id = k.userId LEFT JOIN plans p ON p.id = k.planId WHERE k.planId IS NOT NULL ORDER BY k.createdAt DESC`);
    return NextResponse.json({ keys });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
