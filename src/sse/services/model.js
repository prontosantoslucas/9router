import { getModelAliases, getComboByName, getProviderNodes, getProviderConnections } from "@/lib/localDb";
import { parseModel as parseModelCore, resolveModelAliasFromMap, getModelInfoCore } from "open-sse/services/model.js";
import REGISTRY from "open-sse/providers/registry/index.js";

// Local provider alias overrides (HMR-friendly, applied on top of open-sse map)
const LOCAL_PROVIDER_ALIASES = {
  xmtp: "xiaomi-tokenplan",
  "xiaomi-tokenplan": "xiaomi-tokenplan",
};

const RESERVED_PROVIDER_PREFIXES = new Set(Object.keys(LOCAL_PROVIDER_ALIASES));
for (const entry of REGISTRY) {
  RESERVED_PROVIDER_PREFIXES.add(entry.id);
  if (entry.alias) RESERVED_PROVIDER_PREFIXES.add(entry.alias);
  for (const alias of entry.aliases || []) RESERVED_PROVIDER_PREFIXES.add(alias);
}

export function parseModel(modelStr) {
  const parsed = parseModelCore(modelStr);
  if (parsed?.providerAlias && LOCAL_PROVIDER_ALIASES[parsed.providerAlias]) {
    return { ...parsed, provider: LOCAL_PROVIDER_ALIASES[parsed.providerAlias] };
  }
  return parsed;
}

/**
 * Resolve model alias from localDb
 */
export async function resolveModelAlias(alias) {
  const aliases = await getModelAliases();
  return resolveModelAliasFromMap(alias, aliases);
}

/**
 * Resolve "auto" model alias to a real model.
 * Priority: AUTO_MODEL env → MODEL_RANKING env → active providerConnections → providerNodes with defaultModel → first registry entry
 */
async function resolveAutoModel() {
  // 1. Explicit AUTO_MODEL env var (e.g., "openai/gpt-4o" or "kr/auto-thinking")
  const envModel = process.env.AUTO_MODEL;
  if (envModel) {
    const info = await getModelInfo(envModel);
    if (info && info.provider) return info;
  }

  // 2. Try MODEL_RANKING env var (same format as 9router-agent, comma-separated model IDs)
  const ranking = (process.env.MODEL_RANKING || "")
    .split(",")
    .map(m => m.trim())
    .filter(Boolean);
  for (const modelId of ranking) {
    const info = await getModelInfo(modelId);
    if (info && info.provider) return info;
  }

  // 3. First configured active provider connection (standard UI providers)
  try {
    const activeConns = await getProviderConnections({ isActive: true });
    if (activeConns && activeConns.length > 0) {
      // Priority 3a: active connection with an explicit defaultModel
      const connWithDefault = activeConns.find(c => c.defaultModel);
      if (connWithDefault) {
        return { provider: connWithDefault.provider, model: connWithDefault.defaultModel };
      }
      // Priority 3b: first active connection whose provider exists in REGISTRY
      for (const conn of activeConns) {
        const regEntry = REGISTRY.find(e => e.id === conn.provider || e.alias === conn.provider);
        const models = regEntry?.models || [];
        if (models.length > 0 && models[0].id) {
          return { provider: conn.provider, model: models[0].id };
        }
      }
    }
  } catch (err) {
    // Ignore error if DB query fails during startup or test
  }

  // 4. First configured provider node with a defaultModel
  try {
    const allNodes = await getProviderNodes();
    const withDefault = allNodes.find(n => n.defaultModel);
    if (withDefault) {
      return { provider: withDefault.id, model: withDefault.defaultModel };
    }
  } catch (err) {
    // Ignore error if DB query fails
  }

  // 5. First registry entry with a model
  for (const entry of REGISTRY) {
    const models = entry.models || [];
    if (models.length > 0 && models[0].id) {
      return { provider: entry.id, model: models[0].id };
    }
  }

  return null;
}

/**
 * Get full model info (parse or resolve)
 */
export async function getModelInfo(modelStr) {
  const parsed = parseModel(modelStr);

  if (!parsed.isAlias) {
    // Provider-node prefixes are user-defined. They must not override built-in
    // provider ids/aliases such as `cf`, `cloudflare-ai`, `openai`, or `hf`.
    if (!RESERVED_PROVIDER_PREFIXES.has(parsed.providerAlias)) {
      const openaiNodes = await getProviderNodes({ type: "openai-compatible" });
      const matchedOpenAI = openaiNodes.find((node) => node.prefix === parsed.providerAlias);
      if (matchedOpenAI) {
        return { provider: matchedOpenAI.id, model: parsed.model };
      }

      const anthropicNodes = await getProviderNodes({ type: "anthropic-compatible" });
      const matchedAnthropic = anthropicNodes.find((node) => node.prefix === parsed.providerAlias);
      if (matchedAnthropic) {
        return { provider: matchedAnthropic.id, model: parsed.model };
      }

      const embeddingNodes = await getProviderNodes({ type: "custom-embedding" });
      const matchedEmbedding = embeddingNodes.find((node) => node.prefix === parsed.providerAlias);
      if (matchedEmbedding) {
        return { provider: matchedEmbedding.id, model: parsed.model };
      }
    }
    return {
      provider: parsed.provider,
      model: parsed.model
    };
  }

  // Check if this is a combo name before resolving as alias
  // This prevents combo names from being incorrectly routed to providers
  let combo = await getComboByName(parsed.model);
  if (!combo) {
    // Fallback: alias may point at a combo (e.g. "gpt-5-codex" → "auto" so
    // codex CLI's rewritten model name still lands in the router-managed combo).
    const aliases = await getModelAliases();
    const target = aliases?.[parsed.model];
    if (target && typeof target === "string" && !target.includes("/")) {
      combo = await getComboByName(target);
    }
  }
  if (combo) {
    // Return null provider to signal this should be handled as combo
    // The caller (handleChat) will detect this and handle it as combo
    return { provider: null, model: parsed.model };
  }

  // Handle "auto" alias — resolve via environment or first available model
  if (parsed.model === "auto") {
    const resolved = await resolveAutoModel();
    if (resolved) return resolved;
    // If nothing configured, signal combo path (will show error msg)
    return { provider: null, model: "auto" };
  }

  return getModelInfoCore(modelStr, getModelAliases);
}

/**
 * Check if model is a combo and get models list
 * @returns {Promise<string[]|null>} Array of models or null if not a combo
 */
export async function getComboModels(modelStr) {
  // Only check if it's not in provider/model format
  if (modelStr.includes("/")) return null;

  let combo = await getComboByName(modelStr);
  if (!combo) {
    // Fallback: alias-to-combo (e.g. "gpt-5-codex" → "auto") so CLI clients
    // that rewrite the model name client-side still hit the managed combo.
    const aliases = await getModelAliases();
    const target = aliases?.[modelStr];
    if (target && typeof target === "string" && !target.includes("/")) {
      combo = await getComboByName(target);
    }
  }
  if (combo && combo.models && combo.models.length > 0) {
    return combo.models;
  }
  return null;
}
