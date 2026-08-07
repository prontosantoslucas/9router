// Cliente LinkedIn unificado para o agent.
//
// Rotas de execução:
//   1. EXTENSÃO (preferida): enfileira job no extensionBridge → a extensão
//      Chrome do usuário executa no browser real (sessão nativa) → resolve.
//   2. MCP sidecar (fallback): linkedin-mcp-server via HTTP.
//
// A extensão é preferida porque roda com o IP residencial + cookies reais
// (LinkedIn não detecta). O MCP fica como fallback para setups sem extensão.

const { EXTENSION_TOKEN, LINKEDIN_MCP_URL, LINKEDIN_MCP_TOKEN } = require("../config");

// Job types suportados pela extensão (background.js HANDLERS)
const EXTENSION_HANDLERS = {
  get_person_profile: "person_profile",
  search_jobs: "search_jobs",
  linkedin_edit_profile: "edit_profile",
};

let extensionBridge = null;
function getBridge() {
  if (!EXTENSION_TOKEN) return null;
  if (!extensionBridge) extensionBridge = require("../extensionBridge");
  return extensionBridge;
}

function extensionConfigured() {
  return !!EXTENSION_TOKEN;
}

// Map a MCP tool name to extension job type; null = extensão não cobre
function toExtensionType(toolName) {
  return EXTENSION_HANDLERS[toolName] || null;
}

async function callViaExtension(toolName, args) {
  const type = toExtensionType(toolName);
  if (!type) return { supported: false };
  const bridge = getBridge();
  if (!bridge) return { supported: false };
  try {
    const result = await bridge.enqueue({ type, params: args || {} });
    return { supported: true, result };
  } catch (err) {
    // Extensão configurada mas offline/travada — enqueue() só rejeita depois
    // de esperar o timeout inteiro (90s). Sem esse catch, o erro subia direto
    // e quebrava callLinkedin antes de tentar o fallback MCP, anulando o
    // propósito de ter um fallback.
    console.warn(`[linkedinClient] extensão falhou pra ${toolName}: ${err.message} — tentando MCP`);
    return { supported: false };
  }
}

async function callViaMcp(toolName, args) {
  const linkedinMcp = require("./linkedinMcpClient");
  if (!linkedinMcp.isConfigured()) {
    return {
      supported: false,
      reason:
        "LinkedIn não configurado: nem EXTENSION_TOKEN nem LINKEDIN_MCP_URL no .env. " +
        "Suba a extensão MAXROUTER LinkedIn Helper (apps/extension/linkedin-helper) e defina EXTENSION_TOKEN.",
    };
  }
  try {
    const out = await linkedinMcp.callTool(toolName, args);
    if (out == null) return { supported: true, result: "⚠️ LinkedIn retornou vazio." };
    return { supported: true, result: out };
  } catch (err) {
    linkedinMcp.resetSession();
    return { supported: false, reason: `❌ Erro no LinkedIn: ${err.message}` };
  }
}

// API pública usada pelas tools
async function callLinkedin(toolName, args) {
  // 1. Extensão primeiro (browser real)
  const ext = await callViaExtension(toolName, args);
  if (ext.supported) return formatResult(ext.result);

  // 2. Fallback MCP
  const mcp = await callViaMcp(toolName, args);
  if (mcp.supported) return formatResult(mcp.result);

  return `❌ ${mcp.reason || "Sem rota de execução para LinkedIn."}`;
}

function formatResult(out) {
  if (out == null) return "⚠️ LinkedIn retornou vazio.";
  if (typeof out === "string") return out;
  try {
    return JSON.stringify(out, null, 2);
  } catch {
    return String(out);
  }
}

module.exports = { callLinkedin, extensionConfigured };
