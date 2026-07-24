import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/localDb";

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json({
      success: true,
      connections: {
        supabaseUrl: settings.coder_supabase_url || "",
        supabaseAnonKey: settings.coder_supabase_anon_key || "",
        supabaseConnectedAt: settings.coder_supabase_connected_at || null,
        githubToken: settings.coder_github_token || "",
        githubRepo: settings.coder_github_repo || "",
        githubBranch: settings.coder_github_branch || "main",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const currentSettings = await getSettings();

    const updates = {};

    if (body.supabaseUrl !== undefined) updates.coder_supabase_url = body.supabaseUrl.trim();
    if (body.supabaseAnonKey !== undefined) updates.coder_supabase_anon_key = body.supabaseAnonKey.trim();
    if (body.supabaseConnectedAt !== undefined) updates.coder_supabase_connected_at = body.supabaseConnectedAt;
    if (body.githubToken !== undefined) updates.coder_github_token = body.githubToken.trim();
    if (body.githubRepo !== undefined) updates.coder_github_repo = body.githubRepo.trim();
    if (body.githubBranch !== undefined) updates.coder_github_branch = body.githubBranch.trim();

    await updateSettings({
      ...currentSettings,
      ...updates,
    });

    return NextResponse.json({
      success: true,
      message: "Conexões salvas com sucesso no banco de dados (SQLite).",
      connections: {
        supabaseUrl: updates.coder_supabase_url ?? currentSettings.coder_supabase_url ?? "",
        supabaseAnonKey: updates.coder_supabase_anon_key ?? currentSettings.coder_supabase_anon_key ?? "",
        supabaseConnectedAt: updates.coder_supabase_connected_at ?? currentSettings.coder_supabase_connected_at ?? null,
        githubToken: updates.coder_github_token ?? currentSettings.coder_github_token ?? "",
        githubRepo: updates.coder_github_repo ?? currentSettings.coder_github_repo ?? "",
        githubBranch: updates.coder_github_branch ?? currentSettings.coder_github_branch ?? "main",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
