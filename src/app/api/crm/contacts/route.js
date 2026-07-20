import { NextResponse } from "next/server";
import { getContacts, getContact, upsertContact, deleteContact } from "@/lib/crm/crmRepo.js";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const email = searchParams.get("email");
    if (id) return NextResponse.json({ contact: await getContact(id) });
    if (email) return NextResponse.json({ contact: await getContact(email) });
    return NextResponse.json({ contacts: await getContacts({ email: searchParams.get("email") || undefined }) });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const contact = await upsertContact(data);
    return NextResponse.json({ contact }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await deleteContact(id);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
