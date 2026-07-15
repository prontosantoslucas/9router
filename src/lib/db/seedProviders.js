// Auto-seed providers + model ranking combo on first launch
import { getAdapter } from "./driver.js";
import { getProviderConnections, createProviderConnection } from "./repos/connectionsRepo.js";
import { getCombos, createCombo } from "./repos/combosRepo.js";
import { getSettings, updateSettings } from "./repos/settingsRepo.js";

const SEED_KEY = "maxrouter_seed_v1";

// Env vars that can auto-seed provider connections
// providerId → { envVar, name, category }
const SEEDABLE_PROVIDERS = {
  groq:    { envVar: "GROQ_API_KEY",    name: "Groq",       priority: 2 },
  nvidia:  { envVar: "NVIDIA_API_KEY",  name: "NVIDIA NIM", priority: 3 },
  openai:  { envVar: "OPENAI_API_KEY",  name: "OpenAI",     priority: 4 },
  deepseek:{ envVar: "DEEPSEEK_API_KEY",name: "DeepSeek",   priority: 5 },
  anthropic:{envVar: "ANTHROPIC_API_KEY",name: "Anthropic",  priority: 6 },
};

// Ordered by CODING quality (best free coding models, 2026 community consensus):
// DeepSeek V4 -> Kimi K2 (agentic) -> Qwen3-Coder (long context) -> GLM.
// Generic chat models (Llama 3.3, qwen3-32b) are weaker at code -> kept last.
// Fallback tries top-down; each entry is skipped automatically when out of quota.
const MODEL_RANKING = [
  // DeepSeek V4 — best overall free coder (SWE-Bench / LiveCodeBench leader)
  "kimchi/deepseek-v4-flash",
  "nvidia/deepseek-ai/deepseek-v4-pro",
  "nvidia/deepseek-ai/deepseek-v4-flash",
  // Kimi K2 — strongest for agentic / tool-loop coding
  "kimchi/kimi-k2.7",
  // Qwen3-Coder — best for large codebases (long context)
  "kr/qwen3-coder-next-thinking",
  // GLM 5 — tops SWE-Bench Pro, long autonomous runs
  "kr/glm-5-thinking",
  // Other strong coders / reasoning fallbacks
  "kr/deepseek-3.2-thinking",
  "kr/claude-sonnet-4.5-thinking",
  "kr/claude-haiku-4.5-thinking",
  "kr/auto-thinking",
  "kimchi/minimax-m3",
  // Generic chat models — weaker at code, last resort
  "groq/llama-3.3-70b-versatile",
  "groq/qwen/qwen3-32b",
];

export async function seedProviders() {
  const db = await getAdapter();

  // Check if already seeded
  const existing = db.get(`SELECT value FROM _meta WHERE key = ?`, [SEED_KEY]);
  if (existing) return;

  console.log("[Seed] First launch — auto-seeding providers + model ranking...");

  // 1. Seed API-key provider connections
  for (const [providerId, cfg] of Object.entries(SEEDABLE_PROVIDERS)) {
    const apiKey = process.env[cfg.envVar];
    if (!apiKey) continue;

    const existingConns = await getProviderConnections({ provider: providerId });
    if (existingConns.length > 0) continue;

    try {
      await createProviderConnection({
        provider: providerId,
        authType: "apikey",
        name: cfg.name,
        apiKey,
        priority: cfg.priority,
        isActive: true,
        testStatus: "unknown",
      });
      console.log(`[Seed] Created provider: ${cfg.name}`);
    } catch (err) {
      console.warn(`[Seed] Failed to create ${cfg.name}: ${err.message}`);
    }
  }

  // 2. Seed combos. "auto" is the router-managed entry (like openrouter/free):
  // point any client at model "auto" and the router handles fallback across
  // the whole ranking. "MaxRouter-Ranking" is kept as an explicit alias.
  const existingCombos = await getCombos();
  const SEED_COMBOS = ["auto", "MaxRouter-Ranking"];
  for (const comboName of SEED_COMBOS) {
    if (existingCombos.some(c => c.name === comboName)) continue;
    try {
      await createCombo({
        name: comboName,
        kind: "llm",
        models: MODEL_RANKING,
      });
      console.log(`[Seed] Created combo: ${comboName}`);
    } catch (err) {
      console.warn(`[Seed] Failed to create combo ${comboName}: ${err.message}`);
    }
  }

  // 3. Set combo strategy to fallback for the seeded combos
  const settings = await getSettings();
  const strategies = settings.comboStrategies || {};
  let strategiesChanged = false;
  for (const comboName of SEED_COMBOS) {
    if (!strategies[comboName]) {
      strategies[comboName] = "fallback";
      strategiesChanged = true;
    }
  }
  if (strategiesChanged) {
    await updateSettings({ comboStrategies: strategies });
    console.log("[Seed] Set combo strategies → fallback (auto, MaxRouter-Ranking)");
  }

  // Mark seeded
  db.run(`INSERT INTO _meta(key, value) VALUES(?, ?)`, [SEED_KEY, "1"]);
  console.log("[Seed] Complete.");
}

// Runs on EVERY boot (not gated by SEED_KEY): guarantees the router-managed
// combos exist even on already-seeded databases. Idempotent — only creates
// what is missing, never touches provider connections. This is what makes the
// "auto" model (used by OpenCode) resolve on existing production instances.
export async function ensureCombos() {
  try {
    const existing = await getCombos();
    const strategies = (await getSettings()).comboStrategies || {};
    let changed = false;
    for (const name of ["auto", "MaxRouter-Ranking"]) {
      if (!existing.some((c) => c.name === name)) {
        await createCombo({ name, kind: "llm", models: MODEL_RANKING });
        console.log(`[Combos] Ensured combo: ${name}`);
      }
      if (!strategies[name]) { strategies[name] = "fallback"; changed = true; }
    }
    if (changed) await updateSettings({ comboStrategies: strategies });
  } catch (err) {
    console.warn(`[Combos] ensureCombos failed: ${err.message}`);
  }
}
