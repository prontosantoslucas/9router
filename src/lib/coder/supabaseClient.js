/**
 * Supabase Integration Client for Coder
 * Manages Supabase configuration, OAuth login flow, and persistent DB state.
 */

const STORAGE_KEY = "9router_coder_supabase_config";

export async function fetchCoderConnections() {
  try {
    const res = await fetch("/api/coder/connections");
    if (!res.ok) return null;
    const data = await res.json();
    return data.connections || null;
  } catch {
    return null;
  }
}

export function getSupabaseConfig() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveSupabaseConfig(config) {
  const supabaseUrl = config.supabaseUrl?.trim() || "";
  const anonKey = config.anonKey?.trim() || "";
  const connectedAt = new Date().toISOString();

  if (typeof window !== "undefined") {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        supabaseUrl,
        anonKey,
        connectedAt,
        user: config.user || null,
      })
    );
  }

  // Persist into SQLite DB
  try {
    await fetch("/api/coder/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supabaseUrl,
        supabaseAnonKey: anonKey,
        supabaseConnectedAt: connectedAt,
      }),
    });
  } catch (e) {
    console.warn("Falha ao salvar configuração do Supabase no banco SQLite:", e);
  }
}

export async function clearSupabaseConfig() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }

  try {
    await fetch("/api/coder/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supabaseUrl: "",
        supabaseAnonKey: "",
        supabaseConnectedAt: null,
      }),
    });
  } catch (e) {
    console.warn("Falha ao limpar configuração do Supabase no banco SQLite:", e);
  }
}

/**
 * Triggers Supabase OAuth authentication flow.
 */
export async function initiateSupabaseOAuth(provider = "github", customUrl = "", customKey = "") {
  const currentConfig = getSupabaseConfig() || {};
  const supabaseUrl = customUrl || currentConfig.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "";

  if (!supabaseUrl) {
    throw new Error("Supabase Project URL não configurada. Por favor, insira a URL do projeto Supabase.");
  }

  const redirectUrl = `${window.location.origin}/coder?supabase_oauth=success`;
  const oauthEndpoint = `${supabaseUrl.replace(/\/$/, "")}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectUrl)}`;

  await saveSupabaseConfig({
    ...currentConfig,
    supabaseUrl,
    anonKey: customKey || currentConfig.anonKey || "",
  });

  window.location.href = oauthEndpoint;
}
