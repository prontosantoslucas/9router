// Cliente MCP para o linkedin-mcp-server (fork de eliasbiondo/linkedin-mcp-server).
// Fala JSON-RPC 2.0 sobre streamable HTTP (POST /mcp) ou SSE (GET /mcp).
// Fail-open: qualquer falha (sidecar desligado, sessão expirada, timeout)
// retorna um objeto { ok:false, error } em vez de estourar — assim o LLM
// consegue seguir o turno explicando ao usuário que o LinkedIn está offline.

const cfg = require("../config");

const MCP_PROTOCOL_VERSION = "2025-06-18";
const CLIENT_INFO = { name: "9router-agent", version: "1.0.0" };
const CALL_TIMEOUT_MS = 60_000; // scraping de perfil pode passar de 20s

let requestId = 0;
let sessionId = null;
let initialized = false;
let discoveredTools = null;

function endpoint() {
  const base = cfg.LINKEDIN_MCP_URL;
  if (!base) return null;
  return base.endsWith("/mcp") ? base : `${base.replace(/\/$/, "")}/mcp`;
}

function nextId() {
  requestId += 1;
  return requestId;
}

function baseHeaders(extra = {}) {
  const headers = {
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
    ...extra,
  };
  if (cfg.LINKEDIN_MCP_TOKEN) headers.Authorization = `Bearer ${cfg.LINKEDIN_MCP_TOKEN}`;
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;
  return headers;
}

async function rpc(method, params = {}, { timeoutMs = CALL_TIMEOUT_MS } = {}) {
  const url = endpoint();
  if (!url) throw new Error("LINKEDIN_MCP_URL não configurado");

  const body = { jsonrpc: "2.0", id: nextId(), method, params };
  const headers = baseHeaders({ "Content-Type": "application/json" });

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
  } finally {
    clearTimeout(t);
  }

  const returnedSession = res.headers.get("mcp-session-id");
  if (returnedSession) sessionId = returnedSession;

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    const text = await res.text();
    const line = text.split("\n").find((l) => l.startsWith("data:"));
    if (!line) throw new Error("Resposta MCP SSE vazia");
    let payload;
    try {
      payload = JSON.parse(line.slice(5).trim());
    } catch {
      throw new Error("Formato JSON inválido na mensagem SSE do MCP");
    }
    if (payload.error) throw new Error(`MCP error: ${payload.error.message || JSON.stringify(payload.error)}`);
    return payload.result;
  }

  if (!contentType.includes("application/json")) {
    const raw = await res.text();
    throw new Error(`Content-Type inesperado (${contentType}): ${raw.slice(0, 120)}`);
  }

  const payload = await res.json();
  if (payload.error) throw new Error(`MCP error: ${payload.error.message || JSON.stringify(payload.error)}`);
  return payload.result;
}

async function initialize() {
  if (initialized) return true;
  await rpc("initialize", {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: { tools: {} },
    clientInfo: CLIENT_INFO,
  }, { timeoutMs: 10_000 });
  try {
    await fetch(endpoint(), {
      method: "POST",
      headers: baseHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    }).catch(() => {});
  } catch {
    // notification não retorna body — ok
  }
  initialized = true;
  return true;
}

async function listTools() {
  if (discoveredTools) return discoveredTools;
  await initialize();
  const result = await rpc("tools/list", {}, { timeoutMs: 10_000 });
  discoveredTools = result.tools || [];
  return discoveredTools;
}

// Extrai o payload usável de result.content / result.structuredContent
// e devolve algo que dá para stringificar direto na resposta do LLM.
function unwrap(result) {
  if (!result) return null;
  if (result.structuredContent !== undefined) return result.structuredContent;
  if (Array.isArray(result.content)) {
    const texts = result.content
      .filter((c) => c && c.type === "text" && typeof c.text === "string")
      .map((c) => c.text);
    if (texts.length === 1) {
      const t = texts[0];
      try { return JSON.parse(t); } catch { return t; }
    }
    if (texts.length > 1) return texts.join("\n");
  }
  return result;
}

async function callTool(name, args = {}) {
  await initialize();
  const raw = await rpc("tools/call", { name, arguments: args });
  return unwrap(raw);
}

function isConfigured() {
  return !!endpoint();
}

// Reseta o estado após falha grave (sidecar reiniciou → nova session id).
function resetSession() {
  sessionId = null;
  initialized = false;
  discoveredTools = null;
}

module.exports = { isConfigured, listTools, callTool, resetSession };
