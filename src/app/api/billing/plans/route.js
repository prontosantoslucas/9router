import { NextResponse } from "next/server";
import { getPlans, createPlan, updatePlan, deletePlan } from "@/lib/db/repos/plansRepo.js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const plans = await getPlans();
    return NextResponse.json({ plans });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const plan = await createPlan(data);
    return NextResponse.json({ plan }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function PATCH(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const data = await request.json();
    const plan = await updatePlan(id, data);
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    return NextResponse.json({ plan });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const deleted = await deletePlan(id);
    if (!deleted) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
