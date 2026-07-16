import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getOrCreateThread, listThreads } from "@/lib/db/repos/threadsRepo.js";

export async function GET() {
  try {
    const threads = await listThreads();
    return NextResponse.json({ threads });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const id = body.id || uuidv4();
    const thread = await getOrCreateThread(id, body.title);
    return NextResponse.json({ thread }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
