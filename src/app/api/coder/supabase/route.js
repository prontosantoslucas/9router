import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { supabaseUrl, anonKey, provider = "github" } = body;

    if (!supabaseUrl) {
      return NextResponse.json({ error: "Missing supabaseUrl parameter" }, { status: 400 });
    }

    const redirectUri = `${request.nextUrl.origin}/coder?supabase_oauth=success`;
    const authorizeUrl = `${supabaseUrl.replace(/\/$/, "")}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectUri)}`;

    return NextResponse.json({
      success: true,
      authorizeUrl,
      config: {
        supabaseUrl,
        hasAnonKey: !!anonKey,
        provider,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
