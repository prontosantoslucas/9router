import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/localDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getSettings();
    const notionToken = settings?.notionToken || "";
    const notionDatabaseId = settings?.notionDatabaseId || "";
    return NextResponse.json({
      configured: !!(notionToken && notionDatabaseId),
      hasToken: !!notionToken,
      hasDatabaseId: !!notionDatabaseId,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { token, databaseId } = await request.json();
    const settings = await getSettings();
    await updateSettings({
      ...settings,
      notionToken: token || "",
      notionDatabaseId: databaseId || "",
    });

    // Push config to agent
    const agentUrl = process.env.AGENT_LOOPBACK_URL || "http://127.0.0.1:3717";
    fetch(`${agentUrl}/api/notion/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, databaseId }),
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}