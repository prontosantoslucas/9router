import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

const AGENT_LOOPBACK_URL = process.env.AGENT_LOOPBACK_URL || "http://127.0.0.1:3717";

// Ping curto no agente loopback (sem HMAC — /health é público no Express do agente).
async function pingAgent() {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(`${AGENT_LOOPBACK_URL}/health`, { signal: controller.signal });
    return { reachable: res.ok, status: res.status };
  } catch (err) {
    return { reachable: false, error: err.message };
  } finally {
    clearTimeout(t);
  }
}

// Status agregado dos serviços internos do agente (memória, google, canais, workers).
async function agentSidecars() {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${AGENT_LOOPBACK_URL}/api/status/sidecars`, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function GET(request) {
  const deep = new URL(request.url).searchParams.get("deep") === "1";

  // Default: resposta trivial e rápida — usada pelo healthcheck do Railway.
  if (!deep) {
    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  }

  // Modo profundo: agrega gateway + agente + sidecars, para depuração/uptime.
  const [agent, sidecars] = await Promise.all([pingAgent(), agentSidecars()]);
  return NextResponse.json(
    {
      ok: true,
      gateway: true,
      agent,
      sidecars, // { memory, google, channels, workers } quando o agente responde
      ts: new Date().toISOString(),
    },
    { headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
