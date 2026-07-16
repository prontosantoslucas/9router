import { NextResponse } from "next/server";
import { getOrCreateThread, getThreadMessages, deleteThread } from "@/lib/db/repos/threadsRepo.js";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const thread = await getOrCreateThread(id);
    return NextResponse.json({ thread });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await deleteThread(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
