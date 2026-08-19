import { NextResponse } from "next/server";
import { getContacts, createContact } from "@/lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const tags = searchParams.get("tags")?.split(",").filter(Boolean) || undefined;
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const contacts = await getContacts({ search, tags, limit, offset });
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

    const contact = await createContact(body);
    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    console.error("POST /api/crm/contacts error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
