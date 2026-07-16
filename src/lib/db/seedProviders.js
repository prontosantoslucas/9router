// Auto-seed providers + model ranking combo on first launch
import { getAdapter } from "./driver.js";
import { getProviderConnections, createProviderConnection } from "./repos/connectionsRepo.js";
import { getCombos, createCombo, updateCombo, deleteCombo } from "./repos/combosRepo.js";
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

// Ordered by CODING quality + provider diversification, filtered to providers
// with healthy credentials (per /api/models/availability). Provider prefixes
// are interleaved so a 429/quota-out on one upstream doesn't cascade across
// contiguous entries. Every id must exist in /v1/models.
//
// EXCLUDED (as of 2026-07-16, availability check):
//   - gh/*     → GitHub Copilot not licensed (403)
//   - gc/*     → gemini-cli account 404
//   - gemini/* → model removed 404
//   - kr/*     → Kiro monthly quota exhausted (402)
// Re-add these tiers once their connections come back online.
//
// Fallback tries top-down; each entry is skipped when out of quota / banned by
// the combo cooldown map in open-sse/services/combo.js.
const MODEL_RANKING = [
  // Tier 1 — top-tier frontier coders
  "cc/claude-opus-4-8",                       // Anthropic direct: Opus 4.8
  "cx/gpt-5.6-sol",                           // Cursor: GPT-5.6 flagship
  "cc/claude-sonnet-5",                       // Anthropic direct: Sonnet 5
  "cx/gpt-5.6-terra",
  "cc/claude-opus-4-7",

  // Tier 2 — strong reasoning / coding specialists on different providers
  "cl/anthropic/claude-opus-4.7",             // ClinePass: Opus 4.7
  "cx/gpt-5.6-luna",
  "cl/google/gemini-3.1-pro-preview",         // ClinePass: Gemini 3.1 Pro
  "cx/gpt-5.3-codex-spark",                   // Cursor: codex specialist
  "ag/claude-opus-4-6-thinking",              // Antigravity: Opus 4.6
  "cl/openai/gpt-5.4",
  "cx/gpt-5.5",
  "cl/anthropic/claude-sonnet-4.6",
  "ag/claude-sonnet-4-6",
  "cl/openai/gpt-5.3-codex",                  // ClinePass: codex specialist

  // Tier 3 — fast + cheap fallbacks with usage quotas
  "nvidia/deepseek-ai/deepseek-v4-pro",       // NVIDIA NIM
  "kimchi/kimi-k2.7",                         // Kimi agentic
  "cc/claude-haiku-4-5-20251001",             // Cheap Anthropic
  "ag/gemini-3.1-pro-low",
  "cl/kwaipilot/kat-coder-pro",
  "nvidia/moonshotai/kimi-k2.6",
  "kimchi/minimax-m3",
  "ag/gemini-3-flash-agent",
  "bpm/seed-2-0-pro-260328",

  // Tier 4 — last resort (chronic 429 or weak generalists)
  "ag/gpt-oss-120b-medium",
  "kimchi/deepseek-v4-flash",                 // Chronic 429 → bottom
  "nvidia/deepseek-ai/deepseek-v4-flash",
  "groq/openai/gpt-oss-120b",
  "groq/llama-3.3-70b-versatile",
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

// Combos superseded by the managed `auto` list. Deleted on every boot so stale
// entries pointing at dead providers (e.g. kr/* after quota) can't be picked.
const OBSOLETE_COMBOS = ["auto-fallback", "claude-combo"];

// Runs on EVERY boot (not gated by SEED_KEY): guarantees the router-managed
// combos exist even on already-seeded databases AND syncs the model ranking
// so de-opted/rate-limited models are dropped automatically.
export async function ensureCombos() {
  try {
    const existing = await getCombos();
    const strategies = (await getSettings()).comboStrategies || {};
    let changed = false;
    for (const name of ["auto", "MaxRouter-Ranking"]) {
      const combo = existing.find((c) => c.name === name);
      if (!combo) {
        await createCombo({ name, kind: "llm", models: MODEL_RANKING });
        console.log(`[Combos] Created combo: ${name}`);
      } else if (JSON.stringify(combo.models) !== JSON.stringify(MODEL_RANKING)) {
        await updateCombo(combo.id, { models: MODEL_RANKING });
        console.log(`[Combos] Synced models for combo: ${name}`);
      }
      if (!strategies[name]) { strategies[name] = "fallback"; changed = true; }
    }
    for (const name of OBSOLETE_COMBOS) {
      const combo = existing.find((c) => c.name === name);
      if (combo) {
        await deleteCombo(combo.id);
        console.log(`[Combos] Deleted obsolete combo: ${name}`);
      }
      if (strategies[name]) { delete strategies[name]; changed = true; }
    }
    if (changed) await updateSettings({ comboStrategies: strategies });
  } catch (err) {
    console.warn(`[Combos] ensureCombos failed: ${err.message}`);
  }
}
