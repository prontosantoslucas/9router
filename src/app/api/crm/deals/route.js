import { NextResponse } from "next/server";
import { getDeals, getDeal, createDeal, updateDealStage, deleteDeal, getPipelineSummary, DEFAULT_STAGES } from "@/lib/crm/crmRepo.js";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const stage = searchParams.get("stage");
    const summary = searchParams.get("summary");
    // Bug fix (2026-07-22): quando o frontend pede ?summary=1 ele espera
    // renderizar o Kanban COM os deals + os totais. A versão antiga só
    // devolvia { summary, stages } e o board ficava vazio para sempre.
    if (summary) {
      const [deals, pipelineSummary] = await Promise.all([
        getDeals(stage || undefined),
        getPipelineSummary(),
      ]);
      return NextResponse.json({ deals, summary: pipelineSummary, stages: DEFAULT_STAGES });
    }
    if (id) return NextResponse.json({ deal: await getDeal(id) });
    return NextResponse.json({ deals: await getDeals(stage || undefined) });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const deal = await createDeal(data);
    return NextResponse.json({ deal }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}

export async function PATCH(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const { stage } = await request.json();
    if (!stage) return NextResponse.json({ error: "stage required" }, { status: 400 });
    const deal = await updateDealStage(id, stage);
    return NextResponse.json({ deal });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await deleteDeal(id);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
