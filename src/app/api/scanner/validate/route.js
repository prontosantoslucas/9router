import { NextResponse } from "next/server";
import { validateKey } from "@/lib/scanner/scanner.js";

export async function POST(request) {
  try {
    const { key, provider } = await request.json();
    if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
    const status = await validateKey(key, provider || "openai");
    return NextResponse.json({ key: key.slice(0, 30) + "...", provider: provider || "openai", status });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
