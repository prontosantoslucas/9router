// Cliente MCP para o servidor ai-memory (fork Rust de akitaonrails/ai-memory).
// Protocolo real: JSON-RPC 2.0 via streamable HTTP (POST /mcp) ou SSE (GET /mcp).
// Fallback: se AI_MEMORY_URL não estiver configurado ou o servidor não responder,
// caímos num "no-op safe" que retorna vazio ao invés de quebrar o chat.
//
// Referência: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
const cfg = require("../config");

const MCP_PROTOCOL_VERSION = "2025-06-18";
const CLIENT_INFO = { name: "9router-agent", version: "1.0.0" };

let requestId = 0;
let sessionId = null;
let initialized = false;
let discoveredTools = null;

function endpoint() {
  const base = cfg.AI_MEMORY_URL;
  if (!base) return null;
  return base.endsWith("/mcp") ? base : `${base.replace(/\/$/, "")}/mcp`;
}

function nextId() {
  requestId += 1;
  return requestId;
}

async function rpc(method, params = {}) {
  const url = endpoint();
  if (!url) throw new Error("AI_MEMORY_URL não configurado");
  const body = {
    jsonrpc: "2.0",
    id: nextId(),
    method,
    params,
  };
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);
  let res;
  try {
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
  } finally {
    clearTimeout(t);
  }

  // Captura sessão nova retornada pelo servidor
  const returnedSession = res.headers.get("mcp-session-id");
  if (returnedSession) sessionId = returnedSession;

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    // Streaming — pegamos apenas a primeira mensagem "data:"
    const text = await res.text();
    const line = text.split("\n").find((l) => l.startsWith("data:"));
    if (!line) throw new Error("Resposta MCP SSE vazia");
    const payload = JSON.parse(line.slice(5).trim());
    if (payload.error) throw new Error(`MCP error: ${payload.error.message || JSON.stringify(payload.error)}`);
    return payload.result;
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
  });
  // MCP requer notification "initialized" após handshake
  try {
    await fetch(endpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
        ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    }).catch(() => {});
  } catch {
    // notification pode não ter resposta — ignora
  }
  initialized = true;
  return true;
}

async function listTools() {
  if (discoveredTools) return discoveredTools;
  await initialize();
  const result = await rpc("tools/list");
  discoveredTools = result.tools || [];
  return discoveredTools;
}

async function callTool(name, args = {}) {
  await initialize();
  const result = await rpc("tools/call", { name, arguments: args });
  return result;
}

// ── API pública (mesma shape do cliente antigo — non-breaking) ──────

const superbrain = require("../superbrain");

/**
 * Busca semântica na memória. Tenta MCP server primeiro.
 * Se o MCP não estiver configurado/ativo, usa o GitHub Superbrain (nortelucas/meueulucas).
 */
async function searchMemory(query, limit = 5) {
  if (endpoint()) {
    try {
      const tools = await listTools();
      const searchTool = tools.find((t) =>
        ["memory_recall", "search_memory", "recall", "search"].includes(t.name)
      );
      if (searchTool) {
        const result = await callTool(searchTool.name, { query, limit, max_results: limit });
        if (result?.structuredContent?.results) return result.structuredContent.results;
        if (Array.isArray(result?.structuredContent)) return result.structuredContent;
        if (result?.content?.[0]?.text) {
          try {
            const parsed = JSON.parse(result.content[0].text);
            return Array.isArray(parsed) ? parsed : parsed.results || [];
          } catch {
            return [{ text: result.content[0].text }];
          }
        }
      }
    } catch (err) {
      console.warn(`[ai-memory] searchMemory MCP error (${err.message}) — tentando GitHub Superbrain fallback`);
    }
  }

  // GitHub Superbrain fallback
  return superbrain.searchMemoryInMarkdown(query, limit);
}

/**
 * Grava fato / interação na memória. Tenta MCP server primeiro.
 * Se o MCP não estiver ativo, faz commit direto no GitHub (nortelucas/meueulucas).
 */
async function recordMemory(content, metadata = {}) {
  if (endpoint()) {
    try {
      const tools = await listTools();
      const writeTool = tools.find((t) =>
        ["memory_write", "write_memory", "remember", "write_page", "record"].includes(t.name)
      );
      if (writeTool) {
        await callTool(writeTool.name, {
          content,
          text: content,
          metadata,
          timestamp: Date.now(),
        });
        return true;
      }
    } catch (err) {
      console.warn(`[ai-memory] recordMemory MCP error (${err.message}) — tentando GitHub Superbrain commit`);
    }
  }

  // GitHub Superbrain fallback (commit no repositório do usuário)
  const result = await superbrain.appendMemory(content);
  return result.ok;
}

/**
 * Handoff — busca o "bloco de resumo" da última sessão para injetar no prompt inicial.
 */
async function getSessionHandoff({ workspaceId, projectId, chatId } = {}) {
  if (endpoint()) {
    try {
      const tools = await listTools();
      const t = tools.find((x) =>
        ["memory_handoff_accept", "session_handoff", "get_handoff"].includes(x.name)
      );
      if (t) {
        const result = await callTool(t.name, { workspace_id: workspaceId, project_id: projectId });
        if (result?.structuredContent?.handoff) return result.structuredContent.handoff;
        if (result?.content?.[0]?.text) return result.content[0].text;
      }
    } catch (err) {
      console.warn(`[ai-memory] getSessionHandoff fallback (${err.message})`);
    }
  }

  // Fallback: busca trechos de resumo recentes no Superbrain
  const recent = superbrain.searchMemoryInMarkdown("resumo sessão histórico", 1);
  return recent.length > 0 ? recent[0].content : null;
}

/**
 * Health check para `/api/agent/memory/status` e `/api/status/sidecars`.
 */
async function ping() {
  if (endpoint()) {
    try {
      const tools = await listTools();
      return { configured: true, reachable: true, mode: "mcp", tools: tools.length };
    } catch (err) {
      // Se MCP falhar, informa modo GitHub ativo
    }
  }

  const superbrainContent = superbrain.getContent();
  return {
    configured: true,
    reachable: true,
    mode: "github",
    repo: "nortelucas/meueulucas",
    file: "Superbrain-Lucas.md",
    hasContent: !!superbrainContent,
    length: superbrainContent.length,
  };
}

/**
 * Reseta cache de sessão / tools — chamado quando o servidor cai e reconectamos.
 */
function reset() {
  sessionId = null;
  initialized = false;
  discoveredTools = null;
}

module.exports = {
  searchMemory,
  recordMemory,
  getSessionHandoff,
  listTools,
  callTool,
  ping,
  reset,
};
