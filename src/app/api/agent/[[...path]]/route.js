import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { verifyDashboardAuthToken } from "@/lib/auth/dashboardSession";

export const runtime = "nodejs";

const AGENT_LOOPBACK_URL = process.env.AGENT_LOOPBACK_URL || "http://127.0.0.1:3717";
const AGENT_INTERNAL_SECRET = process.env.AGENT_INTERNAL_SECRET || "default_internal_secret";

// Endpoints públicos que não exigem auth JWT (ex.: webhook externo do WhatsApp)
const PUBLIC_WEBHOOK_PATHS = [
  "/api/agent/webhook/evolution",
];

// Allowlist explícita dos caminhos permitidos no agente
const ALLOWED_PATHS = [
  "/api/chat",
  "/api/chat/new",
  "/api/upload",
  "/api/imagine",
  "/api/imagine/models",
  "/api/image/",
  "/api/notion/save",
  "/api/notion/search",
  "/api/notion/list",
  "/api/stats",
  "/api/agent/personality/github",
  "/api/agent/memory/status",
  "/api/agent/webhook/evolution",
  "/api/agent/telegram/userbot/start-auth",
  "/api/agent/telegram/userbot/complete-auth",
  "/api/agent/telegram/userbot/status",
  "/api/agent/copilot/approvals",
  "/api/agent/copilot/approve",
  "/api/agent/copilot/reject",
];

function isPathAllowed(targetPath) {
  return ALLOWED_PATHS.some((allowed) => targetPath === allowed || targetPath.startsWith(allowed));
}

function isPublicWebhook(targetPath) {
  return PUBLIC_WEBHOOK_PATHS.some((pub) => targetPath === pub || targetPath.startsWith(pub));
}

function generateHmacSignature() {
  const timestamp = Date.now().toString();
  const hmac = crypto.createHmac("sha256", AGENT_INTERNAL_SECRET);
  hmac.update(`maxrouter:${timestamp}`);
  const signature = hmac.digest("hex");
  return `${timestamp}:${signature}`;
}

async function handleProxy(request, context) {
  const pathSegments = (await context.params)?.path || [];
  const targetPath = pathSegments.length > 0 ? `/api/${pathSegments.join("/")}` : "/api";
  const searchParams = request.nextUrl.search || "";
  const fullTargetPath = `${targetPath}${searchParams}`;

  // 1. Validação de Allowlist
  if (!isPathAllowed(targetPath)) {
    return NextResponse.json(
      { error: `Acesso negado: o caminho '${targetPath}' não está na allowlist do proxy` },
      { status: 403 }
    );
  }

  // 2. Validação de Autenticação JWT (para rotas não-públicas)
  if (!isPublicWebhook(targetPath)) {
    const token = request.cookies.get("auth_token")?.value;
    const isValid = await verifyDashboardAuthToken(token);
    if (!isValid) {
      return NextResponse.json({ error: "Unauthorized — Token de sessão JWT ausente ou inválido" }, { status: 401 });
    }
  }

  // 3. Preparação dos headers e assinatura HMAC
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-9r-real-ip") || "127.0.0.1";
  const hmacHeader = generateHmacSignature();

  const proxyHeaders = new Headers();
  proxyHeaders.set("Content-Type", request.headers.get("content-type") || "application/json");
  proxyHeaders.set("X-9R-Agent-Auth", hmacHeader);
  proxyHeaders.set("x-9r-real-ip", clientIp);
  if (request.headers.get("authorization")) {
    proxyHeaders.set("Authorization", request.headers.get("authorization"));
  }

  // 4. Execução do Proxy para o agente loopback
  const upstreamUrl = `${AGENT_LOOPBACK_URL}${fullTargetPath}`;
  try {
    const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();

    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers: proxyHeaders,
      body: body ? Buffer.from(body) : undefined,
    });

    const responseHeaders = new Headers();
    const contentType = upstreamResponse.headers.get("content-type");
    if (contentType) responseHeaders.set("Content-Type", contentType);

    return new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error(`[Proxy Error] Falha ao comunicar com o Agente Lucas em ${upstreamUrl}:`, err.message);
    return NextResponse.json(
      { error: "Erro de comunicação com o Agente Lucas (loopback indisponível)", details: err.message },
      { status: 502 }
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
