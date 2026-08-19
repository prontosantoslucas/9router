import { NextResponse } from "next/server";
import { getApiKeysByContact, linkApiKeyToContact, createApiKey } from "@/lib/db";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const apiKeys = await getApiKeysByContact(id);
    return NextResponse.json({ apiKeys });
  } catch (error) {
    console.error("GET /api/crm/contacts/[id]/apikeys error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    if (body.existingKeyId) {
      await linkApiKeyToContact(body.existingKeyId, id);
      return NextResponse.json({ success: true });
    }
    
    if (body.name && body.machineId) {
      const apiKey = await createApiKey(body.name, body.machineId);
      await linkApiKeyToContact(apiKey.id, id);
      return NextResponse.json({ apiKey }, { status: 201 });
    }
    
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/crm/contacts/[id]/apikeys error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
