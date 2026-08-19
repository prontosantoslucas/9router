import { NextResponse } from "next/server";
import { getDeals, createDeal, updateDeal, getContactById } from "@/lib/db";

const DEFAULT_STAGES = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId") || undefined;
    const stage = searchParams.get("stage") || undefined;
    const priority = searchParams.get("priority") || undefined;
    const summary = searchParams.get("summary");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    let deals = await getDeals({ contactId, stage, priority, limit, offset });

    if (summary === "1") {
      // Anexar contactName aos deals
      const enrichedDeals = await Promise.all(
        deals.map(async (d) => {
          let contactName = d.contactName;
          if (!contactName && d.contactId) {
            try {
              const c = await getContactById(d.contactId);
              contactName = c?.name || null;
            } catch (_) {}
          }
          return {
            ...d,
            contactName: contactName || "Contato",
          };
        })
      );

      const stageCounts = {};
      DEFAULT_STAGES.forEach((s) => (stageCounts[s] = 0));
      enrichedDeals.forEach((d) => {
        if (stageCounts[d.stage] !== undefined) stageCounts[d.stage]++;
      });

      return NextResponse.json({
        deals: enrichedDeals,
        summary: {
          stages: stageCounts,
          total: enrichedDeals.length,
        },
        stages: DEFAULT_STAGES,
      });
    }

    return NextResponse.json({ deals });
  } catch (error) {
    console.error("GET /api/crm/deals error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    if (!body.contactId || !body.title) {
      return NextResponse.json({ error: "contactId and title are required" }, { status: 400 });
    }

    const deal = await createDeal(body);
    return NextResponse.json({ deal }, { status: 201 });
  } catch (error) {
    console.error("POST /api/crm/deals error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required in query params" }, { status: 400 });
    }

    const body = await request.json();
    if (!body.stage) {
      return NextResponse.json({ error: "stage is required in body" }, { status: 400 });
    }

    const deal = await updateDeal(id, { stage: body.stage });
    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    return NextResponse.json({ deal }, { status: 200 });
  } catch (error) {
    console.error("PATCH /api/crm/deals error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

