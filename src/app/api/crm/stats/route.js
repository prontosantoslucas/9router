import { NextResponse } from "next/server";
import { getCrmDashboardStats } from "@/lib/db";

export async function GET() {
  try {
    const stats = await getCrmDashboardStats();
    return NextResponse.json({ stats });
  } catch (error) {
    console.error("GET /api/crm/stats error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}