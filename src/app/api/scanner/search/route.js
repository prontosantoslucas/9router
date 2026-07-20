import { NextResponse } from "next/server";
import { runScan, PROVIDERS } from "@/lib/scanner/scanner.js";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await runScan({ providers: body.providers || Object.keys(PROVIDERS), sources: body.sources });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ providers: Object.fromEntries(Object.entries(PROVIDERS).map(([k, v]) => [k, v.name])) });
}
