import { NextResponse } from "next/server";
import { getIntegrations, createIntegration, updateIntegrationConfig, deleteIntegration } from "@/lib/db";

export async function GET() {
  try {
    const integrations = await getIntegrations();
    return NextResponse.json({ integrations });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { provider, name, config } = body;

    if (!provider) return NextResponse.json({ error: "provider é obrigatório" }, { status: 400 });

    const existing = (await getIntegrations()).find((i) => i.provider === provider);
    if (existing) {
      const updated = await updateIntegrationConfig(existing.id, config || {});
      return NextResponse.json({ integration: updated });
    }

    const integration = await createIntegration({ provider, name: name || provider, config: config || {} });
    return NextResponse.json({ integration }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
    await deleteIntegration(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}