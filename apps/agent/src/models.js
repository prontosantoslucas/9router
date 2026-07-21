const { ROUTER_BASE_URL, QUOTA_RETRY_SEC } = require("./config");
const keyrotator = require("./keyrotator");

const OPENAI = require("openai");

const openai = new OPENAI({
  baseURL: ROUTER_BASE_URL,
  apiKey: keyrotator.getKey(),
});

const RANKING = (process.env.MODEL_RANKING || "").split(",").map((m) => m.trim()).filter(Boolean);
const QUOTA_RETRY_MS = (parseInt(process.env.QUOTA_RETRY_SEC) || 300) * 1000; // 5 min base
const FETCH_INTERVAL = 5 * 60 * 1000;

const state = {
  available: [],
  exhausted: new Map(),
  lastFetch: 0,
  capabilities: {}, // modelId -> { vision, reasoning, contextWindow }
};

async function fetchModels() {
  try {
    const list = await openai.models.list();
    state.available = list.data.map((m) => m.id);
    state.capabilities = {};
    for (const m of list.data) {
      if (m.capabilities) {
        state.capabilities[m.id] = {
          vision: m.capabilities.vision || false,
          reasoning: m.capabilities.reasoning || false,
          contextWindow: m.capabilities.contextWindow || 0,
        };
      }
    }
    state.lastFetch = Date.now();
    console.log(`[Models] ${state.available.length} modelos disponiveis`);
    return state.available;
  } catch (err) {
    console.error("[Models] Erro ao buscar:", err.message);
    return state.available;
  }
}

function markExhausted(modelId) {
  const prevBlock = state.exhausted.get(modelId);
  const prevDuration = prevBlock ? prevBlock - Date.now() : 0;
  // Backoff exponencial: dobra o tempo a cada bloqueio consecutivo
  const duration = Math.min(
    Math.max(prevDuration * 2, QUOTA_RETRY_MS),
    3600000 // max 1h
  );
  state.exhausted.set(modelId, Date.now() + duration);
  console.log(`[Quota] ${modelId} bloqueado por ${(duration / 1000).toFixed(0)}s`);
}

function getBlocked() {
  const now = Date.now();
  const blocked = [];
  for (const [modelId, expiry] of state.exhausted) {
    if (now < expiry) {
      blocked.push({ modelId, retryIn: Math.round((expiry - now) / 1000) });
    } else {
      state.exhausted.delete(modelId);
    }
  }
  return blocked;
}

function hasCapability(modelId, required) {
  const caps = state.capabilities[modelId];
  if (!caps) return true; // unknown capability = assume yes
  if (required.vision && !caps.vision) return false;
  if (required.reasoning && !caps.reasoning) return false;
  return true;
}

function getPriorityList(required) {
  const now = Date.now();
  const ranked = [];

  const filter = (id) => {
    if (!state.available.includes(id) && state.available.length > 0) return false;
    const blockExpiry = state.exhausted.get(id);
    if (blockExpiry && now < blockExpiry) return false;
    if (blockExpiry) state.exhausted.delete(id);
    if (required && !hasCapability(id, required)) return false;
    return true;
  };

  for (const modelId of RANKING) {
    if (!filter(modelId)) continue;
    const idx = RANKING.indexOf(modelId);
    ranked.push({ id: modelId, priority: idx });
  }

  // Auto-incluir modelos nao-listados como fallback
  const basePriority = RANKING.length;
  for (const modelId of state.available) {
    if (RANKING.includes(modelId)) continue;
    if (!filter(modelId)) continue;
    ranked.push({ id: modelId, priority: basePriority });
  }

  ranked.sort((a, b) => a.priority - b.priority);
  return ranked.map((m) => m.id);
}

function getStatus() {
  const fetched = state.available.length;
  const loaded = fetched > 0;
  const usable = getPriorityList().length;
  // Antes do primeiro fetch bem-sucedido (ou router inacessivel), state.available
  // fica vazio e getPriorityList() libera todo o RANKING, o que fazia total (0)
  // parecer menor que available (tamanho do RANKING). Reporta total como o total
  // real quando carregado, senao o tamanho do RANKING, para total nunca ser menor
  // que available; loaded sinaliza quando o fetch falhou.
  const total = loaded ? fetched : RANKING.length;
  return {
    total,
    available: usable,
    loaded,
    lastFetch: state.lastFetch || 0,
    blocked: getBlocked(),
    ranking: RANKING,
    byCapability: {
      vision: getPriorityList({ vision: true }).length,
      reasoning: getPriorityList({ reasoning: true }).length,
    },
  };
}

async function init() {
  await fetchModels();
  setInterval(fetchModels, FETCH_INTERVAL);
}

module.exports = { init, getPriorityList, markExhausted, getStatus, fetchModels, hasCapability };
