import { NextResponse } from "next/server";
import { getContactById, updateContact, deleteContact, getContactStats } from "@/lib/db";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const contact = await getContactById(id);
    
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const stats = await getContactStats(id);
    return NextResponse.json({ contact, stats });
  } catch (error) {
    console.error("GET /api/crm/contacts/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const contact = await updateContact(id, body);
    
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({ contact });
  } catch (error) {
    console.error("PUT /api/crm/contacts/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await deleteContact(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/crm/contacts/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
