import { NextResponse } from "next/server";
import { listLeads, addLead, updateLead, addManyLeads, stats } from "@/lib/prospeccao/store.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/prospeccao/leads?status=&niche=&q=
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const leads = listLeads({
    status: searchParams.get("status") || undefined,
    niche: searchParams.get("niche") || undefined,
    q: searchParams.get("q") || undefined,
  });
  return NextResponse.json({ leads, stats: stats() });
}

// POST /api/prospeccao/leads  — adiciona 1 lead, ou {bulk:[...]} pra importar vários
export async function POST(req) {
  const body = await req.json();
  if (Array.isArray(body.bulk)) {
    const added = addManyLeads(body.bulk);
    return NextResponse.json({ added: added.length, stats: stats() });
  }
  if (!body.name && !body.instagram && !body.whatsapp) {
    return NextResponse.json({ error: "Informe ao menos nome, instagram ou whatsapp" }, { status: 400 });
  }
  const lead = addLead(body);
  return NextResponse.json({ lead });
}

// PATCH /api/prospeccao/leads  — {id, ...patch} atualiza status/campos
export async function PATCH(req) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const { id, ...patch } = body;
  const lead = updateLead(id, patch);
  if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  return NextResponse.json({ lead });
}
