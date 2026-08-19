import { NextResponse } from "next/server";
import { getContacts, getContactByEmail, createContact, updateContact } from "@/lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (email) {
      const contact = await getContactByEmail(email);
      return NextResponse.json({ contact: contact || null });
    }

    const search = searchParams.get("search") || undefined;
    const tags = searchParams.get("tags")?.split(",").filter(Boolean) || undefined;
    const status = searchParams.get("status") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const contacts = await getContacts({ search, tags, status, limit, offset });
    return NextResponse.json({ contacts });
  } catch (error) {
    console.error("GET /api/crm/contacts error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    if (!body.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    if (body.email) {
      const existing = await getContactByEmail(body.email);
      if (existing) {
        const updated = await updateContact(existing.id, body);
        return NextResponse.json({ contact: updated || existing }, { status: 200 });
      }
    }

    const contact = await createContact(body);
    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    console.error("POST /api/crm/contacts error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

