import { NextResponse } from "next/server";
import { getContacts, getDeals, getActivities, listCheckouts } from "@/lib/db";

function escapeCsv(value) {
  const s = String(value ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(headers, rows) {
  const lines = [headers.map(escapeCsv).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsv(row[h] ?? "")).join(","));
  }
  return lines.join("\n");
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "contacts";

    let filename = "";
    let csv = "";
    let headers = [];

    if (type === "contacts") {
      const contacts = await getContacts({ limit: 10000 });
      headers = ["id", "name", "email", "phone", "company", "tags", "notes", "source", "createdAt", "updatedAt"];
      csv = toCsv(headers, contacts.map((c) => ({
        ...c,
        tags: Array.isArray(c.tags) ? c.tags.join(" | ") : c.tags,
      })));
      filename = "contatos.csv";
    } else if (type === "deals") {
      const deals = await getDeals({ limit: 10000 });
      headers = ["id", "contactId", "title", "valueCents", "currency", "stage", "source", "notes", "createdAt", "updatedAt"];
      csv = toCsv(headers, deals);
      filename = "deals.csv";
    } else if (type === "activities") {
      const activities = await getActivities({ limit: 10000 });
      headers = ["id", "contactId", "dealId", "type", "description", "createdAt"];
      csv = toCsv(headers, activities);
      filename = "atividades.csv";
    } else if (type === "checkouts") {
      const checkouts = await listCheckouts({ limit: 10000 });
      headers = ["id", "contactId", "amountCents", "currency", "description", "status", "externalRef", "createdAt", "paidAt"];
      csv = toCsv(headers, checkouts);
      filename = "checkouts.csv";
    } else {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/crm/export error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}