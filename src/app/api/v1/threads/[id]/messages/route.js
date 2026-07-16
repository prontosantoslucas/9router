import { NextResponse } from "next/server";
import { getOrCreateThread, getThreadMessages, addThreadMessage } from "@/lib/db/repos/threadsRepo.js";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    await getOrCreateThread(id);
    const messages = await getThreadMessages(id);
    return NextResponse.json({ messages });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (!body.role || !body.content) {
      return NextResponse.json({ error: "role and content are required" }, { status: 400 });
    }
    await getOrCreateThread(id, body.title);
    const msg = await addThreadMessage(id, body.role, body.content);
    return NextResponse.json({ message: msg }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
