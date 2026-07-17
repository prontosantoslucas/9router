import { NextResponse } from "next/server";
import { getPlans } from "@/lib/db/repos/plansRepo.js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const plans = await getPlans();
    return NextResponse.json({ plans });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
