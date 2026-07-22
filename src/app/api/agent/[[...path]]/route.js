import { NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { verifyDashboardAuthToken } from "@/lib/auth/dashboardSession";
import { getSettings } from "@/lib/localDb";

export const runtime = "nodejs";
// Necessário para streamar bodies grandes (uploads) sem bufferizar em RAM.
export const dynamic = "force-dynamic";

const AGENT_LOOPBACK_URL = process.env.AGENT_LOOPBACK_URL || "http://127.0.0.1:3717";

// ─────────────────────────────────────────────────────────────
// Resolve o segredo HMAC. Ordem: env → arquivo persistido → gera+persiste.
// MESMO ALGORITMO do apps/agent/src/hmacAuth.js#resolveInternalSecret,
// duplicado aqui porque Next não pode importar de apps/agent (bundling / diff runtime).
// Ambos os processos convergem no MESMO arquivo `$DATA_DIR/.agent-internal-secret`.
// ─────────────────────────────────────────────────────────────
function resolveInternalSecret() {
  const envValue = process.env.AGENT_INTERNAL_SECRET;
  if (envValue && envValue !== "default_internal_secret" && envValue.length >= 16) {
    return envValue;
  }
  const baseDir = process.env.DATA_DIR || path.join(os.homedir(), ".9router");
  const file = path.join(baseDir, ".agent-internal-secret");
  try {
    if (fs.existsSync(file)) {
      const v = fs.readFileSync(file, "utf8").trim();
      if (v && v.length >= 32) return v;
    }
  } catch {}
  const generated = crypto.randomBytes(48).toString("hex");
  try {
    fs.mkdirSync(baseDir, { recursive: true });
    fs.writeFileSync(file, generated, { mode: 0o600 });
    console.log(`[Proxy] AGENT_INTERNAL_SECRET gerado e persistido em ${file}`);
  } catch (err) {
    console.warn(`[Proxy] Falha ao persistir segredo em ${file}: ${err.message}`);
  }
  return generated;
}

// Lazy — resolvido no primeiro request (não no import) para dar tempo do
// agente popular o arquivo se ele subir primeiro.
let _cachedSecret = null;
function getInternalSecret() {
  if (_cachedSecret) return _cachedSecret;
  _cachedSecret = resolveInternalSecret();
  return _cachedSecret;
}

// Endpoints públicos que não exigem auth JWT.
// - webhook Evolution (WhatsApp) é chamado direto pela Evolution/Meta cloud, valida com apikey própria.
// - Google OAuth callback recebe o redirect do usuário no browser (com state validado no handler).
const PUBLIC_WEBHOOK_PATHS = [
  "/api/agent/webhook/evolution",
  "/api/webhook/evolution",
  "/api/agent/google/callback",
  "/api/google/callback",
];

// Allowlist explícita dos caminhos permitidos no agente.
// Match exato OU prefixo. Manter estritamente sincronizado com o Express do agente.
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
  "/api/personality/github",
  "/api/agent/memory/status",
  "/api/memory/status",
  "/api/agent/webhook/evolution",
  "/api/webhook/evolution",
  "/api/agent/evolution/",
  "/api/evolution/",
  "/api/agent/telegram/userbot/",
  "/api/telegram/userbot/",
  "/api/agent/copilot/",
  "/api/copilot/",
  "/api/agent/status",
  "/api/status",
  "/api/agent/google/",
  "/api/google/",
];

function isPathAllowed(targetPath) {
  return ALLOWED_PATHS.some((allowed) => targetPath === allowed || targetPath.startsWith(allowed));
}

function isPublicWebhook(targetPath) {
  return PUBLIC_WEBHOOK_PATHS.some((pub) => targetPath === pub || targetPath.startsWith(pub));
}

function generateHmacSignature() {
  const timestamp = Date.now().toString();
  const hmac = crypto.createHmac("sha256", getInternalSecret());
  hmac.update(`maxrouter:${timestamp}`);
  const signature = hmac.digest("hex");
  return `${timestamp}:${signature}`;
}

// Métodos HTTP sem body — mantidos como no fetch spec para não passar body vazio.
const NO_BODY_METHODS = new Set(["GET", "HEAD"]);

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

  // 2. Validação de Autenticação JWT (para rotas não-públicas quando requireLogin está ativado)
  if (!isPublicWebhook(targetPath)) {
    const settings = await getSettings().catch(() => ({}));
    const requireLogin = settings?.requireLogin !== false;
    if (requireLogin) {
      const token = request.cookies.get("auth_token")?.value;
      const isValid = await verifyDashboardAuthToken(token);
      if (!isValid) {
        return NextResponse.json({ error: "Unauthorized — Token de sessão JWT ausente ou inválido" }, { status: 401 });
      }
    }
  }

  // 3. Preparação dos headers e assinatura HMAC
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-9r-real-ip") ||
    "127.0.0.1";
  const hmacHeader = generateHmacSignature();

  const proxyHeaders = new Headers();
  // Preserva Content-Type de uploads / SSE / multipart
  const originalCT = request.headers.get("content-type");
  if (originalCT) proxyHeaders.set("Content-Type", originalCT);
  proxyHeaders.set("X-9R-Agent-Auth", hmacHeader);
  proxyHeaders.set("x-9r-real-ip", clientIp);
  if (request.headers.get("authorization")) {
    proxyHeaders.set("Authorization", request.headers.get("authorization"));
  }
  // Passa apikey pro webhook Evolution (o agente valida)
  if (request.headers.get("apikey")) {
    proxyHeaders.set("apikey", request.headers.get("apikey"));
  }

  // 4. Streaming do body — NUNCA bufferizar em RAM.
  //    request.body é ReadableStream; passamos direto ao upstream fetch.
  //    (undici, backend do fetch do Node, aceita ReadableStream com duplex:"half".)
  const upstreamUrl = `${AGENT_LOOPBACK_URL}${fullTargetPath}`;
  const hasBody = !NO_BODY_METHODS.has(request.method);

  const fetchInit = {
    method: request.method,
    headers: proxyHeaders,
    // Redirects são feitos aqui, agente é loopback trusted.
    redirect: "manual",
  };
  if (hasBody && request.body) {
    fetchInit.body = request.body;
    fetchInit.duplex = "half";
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, fetchInit);

    // Preserva headers relevantes da resposta (Content-Type, Content-Length, Cache-Control, etc.)
    const responseHeaders = new Headers();
    const passthroughHeaders = ["content-type", "cache-control", "etag", "last-modified"];
    for (const h of passthroughHeaders) {
      const v = upstreamResponse.headers.get(h);
      if (v) responseHeaders.set(h, v);
    }

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
export const PATCH = handleProxy;
export const DELETE = handleProxy;
