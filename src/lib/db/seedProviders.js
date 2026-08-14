// Auto-seed providers + model ranking combo on first launch
import { getAdapter } from "./driver.js";
import { getProviderConnections, createProviderConnection } from "./repos/connectionsRepo.js";
import { getCombos, createCombo, updateCombo, deleteCombo } from "./repos/combosRepo.js";
import { getSettings, updateSettings } from "./repos/settingsRepo.js";
import { getModelAliases, setModelAlias } from "./repos/aliasRepo.js";

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
  // Tier 1 — Active, verified ultra-fast & high-performance models
  "gemini/gemini-3-flash-preview",
  "gemini/gemini-3.1-flash-lite-preview",
  "kimchi/kimi-k2.7",
  "kimchi/minimax-m3",
  "kimchi/nemotron-3-ultra-fp4",
  "groq/llama-3.3-70b-versatile",
  "gemini-2.5-flash",

  // Tier 2 — Antigravity & Frontier models (when quota/OAuth active)
  "ag/gemini-3-flash",
  "ag/gemini-3.6-flash",
  "ag/claude-sonnet-4-6",
  "ag/claude-opus-4-6-thinking",
  "ag/gemini-3.1-pro-low",
  "ag/gemini-3-flash-agent",
  "ag/gpt-oss-120b-medium",

  // Tier 3 — OAuth frontier coders (fallback when tokens refreshed)
  "cc/claude-opus-4-8",
  "cx/gpt-5.6-sol",
  "cc/claude-sonnet-5",
  "cx/gpt-5.6-terra",
  "cc/claude-opus-4-7",
  "cx/gpt-5.6-luna",
  "cx/gpt-5.3-codex-spark",
  "cx/gpt-5.5",
  "cc/claude-haiku-4-5-20251001",

  // Tier 4 — ClinePass & other providers
  "cl/anthropic/claude-opus-4.7",
  "cl/google/gemini-3.1-pro-preview",
  "cl/openai/gpt-5.4",
  "cl/anthropic/claude-sonnet-4.6",
  "cl/openai/gpt-5.3-codex",
  "cl/kwaipilot/kat-coder-pro",
  "bpm/seed-2-0-pro-260328",
  "kimchi/deepseek-v4-flash",
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

// Codex / OpenAI-style CLI clients rewrite the `model` field client-side to a
// known OpenAI family name (e.g. `gpt-5-codex`) even when the config says
// `model = "auto"`. Aliasing these names → the `auto` combo makes the router
// route through the managed fallback instead of 404-ing on missing openai creds.
// Only aliases pointing at a combo NAME (bare, no slash) are picked up by
// `getComboModels()` / `getModelInfo()` in src/sse/services/model.js.
const AUTO_ALIASES = {
  "gpt-5":         "auto",
  "gpt-5-mini":    "auto",
  "gpt-5-nano":    "auto",
  "gpt-5-codex":   "auto",
  "o1":            "auto",
  "o1-mini":       "auto",
  "o3":            "auto",
  "o3-mini":       "auto",
  "claude-opus-4-8":       "auto",
  "claude-sonnet-5":       "auto",
  "claude-haiku-4-5":      "auto",
};

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

    // Ensure alias → combo entries exist so CLI clients that rewrite the model
    // name (codex, etc.) still land in the managed combo.
    const existingAliases = (await getModelAliases()) || {};
    for (const [alias, target] of Object.entries(AUTO_ALIASES)) {
      if (existingAliases[alias] !== target) {
        await setModelAlias(alias, target);
        console.log(`[Combos] Set model alias: ${alias} → ${target}`);
      }
    }
  } catch (err) {
    console.warn(`[Combos] ensureCombos failed: ${err.message}`);
  }
}
