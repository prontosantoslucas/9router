import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/db/driver.js";
import { createApiKey } from "@/lib/localDb.js";
import { getConsistentMachineId } from "@/shared/utils/machineId.js";

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

export async function POST(request) {
  try {
    const body = await request.json();
    const name = body.label || body.name || "Chave de Produção";
    const machineId = await getConsistentMachineId();
    const apiKey = await createApiKey(name, machineId);

    return NextResponse.json({
      key: apiKey.key,
      name: apiKey.name,
      id: apiKey.id,
      machineId: apiKey.machineId,
      apiKey,
    }, { status: 201 });
  } catch (e) {
    console.error("POST /api/billing/api-keys error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

