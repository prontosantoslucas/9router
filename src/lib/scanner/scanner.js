import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "@/lib/db/driver.js";

// ── Provider definitions ──────────────────────────────────────────
export const PROVIDERS = {
  openai: {
    name: "OpenAI",
    tier: "paid",
    patterns: [
      /sk-proj-[A-Za-z0-9-_]{74}T3BlbkFJ[A-Za-z0-9-_]{73}A/g,
      /sk-svcacct-[A-Za-z0-9-_]{74}T3BlbkFJ[A-Za-z0-9-_]{73}A/g,
      /sk-proj-[A-Za-z0-9-_]{58}T3BlbkFJ[A-Za-z0-9-_]{58}/g,
      /sk-proj-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}/g,
    ],
    validate: async (key) => {
      // /v1/dashboard/billing/* is deprecated (2024). Auth via /v1/models is
      // cheap and reliable; balance is inferred by attempting a 1-token
      // completion in checkBalance().
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) return "valid";
      if (res.status === 401) return "invalid";
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        if (body?.error?.code === "insufficient_quota") return "valid_no_balance";
        return "rate_limited";
      }
      return "error";
    },
    // Try a 1-token completion. Success → has funding. 429/insufficient_quota → $0.
    checkBalance: async (key) => {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) return { hasBalance: true, source: "completion_ok" };
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        if (body?.error?.code === "insufficient_quota") return { hasBalance: false, source: "insufficient_quota" };
        return { hasBalance: null, source: "rate_limited" };
      }
      return { hasBalance: null, source: `http_${res.status}` };
    },
    searchTokens: ["sk-proj-", "sk-svcacct-"],
  },
  anthropic: {
    name: "Anthropic",
    tier: "paid",
    patterns: [/sk-ant-[A-Za-z0-9-_]{32,100}/g],
    validate: async (key) => {
      // /v1/models is auth-only, doesn't burn credits.
      const res = await fetch("https://api.anthropic.com/v1/models", {
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) return "valid";
      if (res.status === 401 || res.status === 403) return "invalid";
      if (res.status === 429) return "rate_limited";
      return "error";
    },
    checkBalance: async (key) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-3-5-haiku-20241022", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) return { hasBalance: true, source: "message_ok" };
      if (res.status === 400) {
        const body = await res.json().catch(() => ({}));
        // "credit balance is too low" surfaces as 400 invalid_request_error on Anthropic
        if (body?.error?.message?.toLowerCase?.().includes("credit balance")) {
          return { hasBalance: false, source: "credit_balance_too_low" };
        }
        return { hasBalance: true, source: "message_400_but_authed" };
      }
      if (res.status === 429) return { hasBalance: null, source: "rate_limited" };
      return { hasBalance: null, source: `http_${res.status}` };
    },
    searchTokens: ["sk-ant-"],
  },
  deepseek: {
    name: "DeepSeek",
    tier: "paid",
    // Tightened: DeepSeek keys are 32-hex only. Old {32,64} matched hashes/other sk-* junk.
    patterns: [/sk-[a-f0-9]{32}(?![a-f0-9])/g],
    validate: async (key) => {
      const res = await fetch("https://api.deepseek.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) return "valid";
      if (res.status === 401) return "invalid";
      if (res.status === 429) return "rate_limited";
      return "error";
    },
    // DeepSeek exposes a real balance endpoint.
    checkBalance: async (key) => {
      const res = await fetch("https://api.deepseek.com/user/balance", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status !== 200) return { hasBalance: null, source: `http_${res.status}` };
      const data = await res.json().catch(() => ({}));
      const total = Number(data?.balance_infos?.[0]?.total_balance || 0);
      return {
        hasBalance: total > 0,
        amountUsd: total,
        currency: data?.balance_infos?.[0]?.currency,
        source: "user_balance",
      };
    },
    searchTokens: ["sk-"],
  },
  perplexity: {
    name: "Perplexity",
    tier: "paid",
    patterns: [/pplx-[A-Za-z0-9-_]{32,100}/g],
    validate: async (key) => {
      // Perplexity has no /v1/models; ping chat/completions with 1 token instead.
      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "sonar", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) return "valid";
      if (res.status === 401) return "invalid";
      if (res.status === 402) return "valid_no_balance";
      if (res.status === 429) return "rate_limited";
      return "error";
    },
    searchTokens: ["pplx-"],
  },
  groq: {
    name: "Groq",
    tier: "free",
    patterns: [/gsk_[A-Za-z0-9]{40,60}/g],
    validate: async (key) => {
      // Bug fix: Groq mounts OpenAI-compatible API under /openai/v1, not /v1.
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) return "valid";
      if (res.status === 401) return "invalid";
      if (res.status === 429) return "rate_limited";
      return "error";
    },
    searchTokens: ["gsk_"],
  },
  google: {
    name: "Google Gemini",
    tier: "free",
    patterns: [/AIzaSy[A-Za-z0-9_-]{26,40}/g],
    validate: async (key) => {
      // Bug fix: `gemini-pro` was removed. Use the models list endpoint —
      // auth-only, doesn't consume quota.
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (res.status === 200) return "valid";
      if (res.status === 400 || res.status === 403) return "invalid";
      if (res.status === 429) return "rate_limited";
      return "error";
    },
    searchTokens: ["AIzaSy"],
  },
  huggingface: {
    name: "HuggingFace",
    tier: "free",
    patterns: [/hf_[A-Za-z0-9]{20,60}/g],
    validate: async (key) => {
      const res = await fetch("https://huggingface.co/api/whoami-v2", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) return "valid";
      if (res.status === 401) return "invalid";
      return "error";
    },
    searchTokens: ["hf_"],
  },
  mistral: {
    name: "Mistral",
    tier: "paid",
    // Mistral console keys are 32-char alphanumerics with no fixed prefix — can't
    // discriminate from noise via regex alone. Detection here likely near-zero;
    // keeping the tokens for future refinement.
    patterns: [/mistral_[A-Za-z0-9]{30,50}/g, /mi_[A-Za-z0-9]{30,50}/g],
    validate: async (key) => {
      const res = await fetch("https://api.mistral.ai/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) return "valid";
      if (res.status === 401) return "invalid";
      return "error";
    },
    searchTokens: ["mistral_"],
  },
  cohere: {
    name: "Cohere",
    tier: "paid",
    patterns: [/co-[A-Za-z0-9]{30,60}/g],
    validate: async (key) => {
      const res = await fetch("https://api.cohere.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) return "valid";
      if (res.status === 401) return "invalid";
      return "error";
    },
    searchTokens: ["co-"],
  },
  replicate: {
    name: "Replicate",
    tier: "paid",
    patterns: [/r8_[A-Za-z0-9]{30,60}/g],
    validate: async (key) => {
      const res = await fetch("https://api.replicate.com/v1/account", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) return "valid";
      if (res.status === 401) return "invalid";
      return "error";
    },
    // Replicate's /v1/account returns tier: "free" | "hobby" | "team" | ... — hobby+ = paid.
    checkBalance: async (key) => {
      const res = await fetch("https://api.replicate.com/v1/account", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status !== 200) return { hasBalance: null, source: `http_${res.status}` };
      const data = await res.json().catch(() => ({}));
      const type = String(data?.type || "").toLowerCase();
      const isFree = type === "" || type === "free";
      return {
        hasBalance: !isFree,
        accountType: type || "unknown",
        source: "account",
      };
    },
    searchTokens: ["r8_"],
  },
  openrouter: {
    name: "OpenRouter",
    tier: "paid",
    patterns: [/sk-or-v1-[A-Za-z0-9]{40,100}/g, /sk-or-[A-Za-z0-9]{40,80}/g],
    validate: async (key) => {
      const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) return "valid";
      if (res.status === 401) return "invalid";
      if (res.status === 429) return "rate_limited";
      return "error";
    },
    // Best endpoint of the lot: usage + limit + is_free_tier all in one call.
    checkBalance: async (key) => {
      const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status !== 200) return { hasBalance: null, source: `http_${res.status}` };
      const data = await res.json().catch(() => ({}));
      const info = data?.data || {};
      const usage = Number(info.usage || 0);
      const limit = info.limit == null ? null : Number(info.limit);
      const isFree = !!info.is_free_tier;
      // Free tier with no explicit limit → no financial exposure to owner.
      if (isFree) return { hasBalance: false, isFreeTier: true, usage, source: "auth_key" };
      // Paid with no limit set → unbounded, definitely worth notifying.
      if (limit == null) return { hasBalance: true, amountUsd: null, usage, source: "auth_key_unbounded" };
      const remaining = limit - usage;
      return { hasBalance: remaining > 0, amountUsd: remaining, usage, limit, source: "auth_key" };
    },
    searchTokens: ["sk-or-"],
  },
  together: {
    name: "Together AI",
    tier: "paid",
    // Together keys are 64-char hex, no fixed prefix. `tgp-` matches almost
    // nothing in the wild — kept for parity, real detection needs a different approach.
    patterns: [/tgp-[A-Za-z0-9]{30,60}/g],
    validate: async (key) => {
      const res = await fetch("https://api.together.xyz/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) return "valid";
      if (res.status === 401) return "invalid";
      return "error";
    },
    searchTokens: ["tgp-"],
  },
  elevenlabs: {
    name: "ElevenLabs",
    tier: "paid",
    // ElevenLabs xi-api-key is 32-char hex — no `eleven-` prefix in production.
    // Pattern kept but expect zero real hits until it's replaced.
    patterns: [/eleven-[A-Za-z0-9]{30,60}/g],
    validate: async (key) => {
      const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
        headers: { "xi-api-key": key },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) return "valid";
      if (res.status === 401) return "invalid";
      return "error";
    },
    // ElevenLabs' free tier = tier "free"; paid tiers include starter/creator/pro/scale/enterprise.
    checkBalance: async (key) => {
      const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
        headers: { "xi-api-key": key },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status !== 200) return { hasBalance: null, source: `http_${res.status}` };
      const data = await res.json().catch(() => ({}));
      const tier = String(data?.tier || "").toLowerCase();
      const isFree = tier === "" || tier === "free" || tier === "trial";
      return { hasBalance: !isFree, tier: tier || "unknown", source: "subscription" };
    },
    searchTokens: ["eleven-"],
  },
};

// ── Helpers ───────────────────────────────────────────────────────
function token() {
  return process.env.GITHUB_SCANNER_TOKEN || process.env.GITHUB_TOKEN;
}

async function ghFetch(url) {
  const t = token();
  const headers = t ? { Authorization: `token ${t}` } : {};
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
  if (res.status === 403) return null;
  if (!res.ok) return null;
  return res.json();
}

async function getDefaultBranch(owner, repo) {
  const data = await ghFetch(`https://api.github.com/repos/${owner}/${repo}`);
  return data?.default_branch || "main";
}

function rawUrl(owner, repo, branch, path) {
  const encoded = path.split("/").map(p => encodeURIComponent(p)).join("/");
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encoded}`;
}

async function fetchRaw(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return res.text();
  } catch { return null; }
}

// ── Key extraction ────────────────────────────────────────────────
function matchKeys(text, enabledProviders) {
  const results = [];
  for (const p of enabledProviders) {
    const cfg = PROVIDERS[p];
    if (!cfg) continue;
    for (const pattern of cfg.patterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const key of new Set(matches)) {
          results.push({ key, provider: p });
        }
      }
    }
  }
  return results;
}

// ── GitHub source ─────────────────────────────────────────────────
async function scanGithub(providers) {
  const allKeys = new Map();
  let scanned = 0;

  // Targeted queries that yield actual leaked keys (not docs/examples)
  const queries = [];
  for (const p of providers) {
    const cfg = PROVIDERS[p];
    if (!cfg) continue;
    for (const tok of cfg.searchTokens) {
      // Real env files, configs, source files
      queries.push(`"${tok}" path:.env NOT .env.example`);
      queries.push(`"${tok}" language:dotenv`);
      queries.push(`"${tok}" path:.env`);
      queries.push(`"${tok}" path:.config`);
      queries.push(`"${tok}" path:.json`);
      queries.push(`"${tok}" path:.yml NOT example`);
      queries.push(`"${tok}" path:.yaml NOT example`);
      queries.push(`"${tok}" path:.txt`);
      queries.push(`"${tok}" path:.log`);
      queries.push(`"${tok}" path:.conf`);
      queries.push(`"${tok}" path:.ini`);
      queries.push(`"${tok}" path:.secret`);
      queries.push(`"${tok}" path:.bak`);
      queries.push(`"${tok}" path:.backup`);
      // Language-specific
      queries.push(`"${tok}" language:python`);
      queries.push(`"${tok}" language:javascript`);
      queries.push(`"${tok}" language:typescript`);
      queries.push(`"${tok}" language:go`);
      queries.push(`"${tok}" language:java`);
      queries.push(`"${tok}" language:shell`);
      queries.push(`"${tok}" language:dockerfile`);
    }
  }

  // Deduplicate and limit
  const unique = [...new Set(queries)];
  const t = token();

  for (const query of unique.slice(0, 80)) {
    for (let page = 1; page <= 2; page++) {
      try {
        const data = await ghFetch(`https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=100&page=${page}`);
        if (!data?.items?.length) break;
        scanned += data.items.length;

        // Process in parallel batches
        const batch = data.items.slice(0, page === 1 ? 100 : 50);
        const results = await Promise.allSettled(batch.map(async (item) => {
          const [owner, repoName] = item.repository.full_name.split("/");
          try {
            const branch = await getDefaultBranch(owner, repoName);
            const url = rawUrl(owner, repoName, branch, item.path);
            const content = await fetchRaw(url);
            if (!content) return;
            const matched = matchKeys(content, providers);
            for (const m of matched) {
              if (!allKeys.has(m.key)) {
                allKeys.set(m.key, {
                  key: m.key, provider: m.provider,
                  source: item.repository.full_name,
                  repoUrl: item.html_url,
                  filePath: item.path,
                  sourceType: "github",
                });
              }
            }
          } catch { /* skip */ }
        }));

        await new Promise(r => setTimeout(r, 150));
      } catch { break; }
    }
  }

  // Also search gists if token available
  if (t) {
    for (const p of providers) {
      const cfg = PROVIDERS[p];
      if (!cfg) continue;
      for (const tok of cfg.searchTokens) {
        try {
          const data = await ghFetch(`https://api.github.com/search/code?q=${encodeURIComponent(tok)}+org:gist&per_page=50`);
          if (!data?.items?.length) continue;
          scanned += data.items.length;
          for (const item of data.items.slice(0, 30)) {
            try {
              const [owner, repoName] = item.repository.full_name.split("/");
              const branch = "main";
              const url = rawUrl(owner, repoName, branch, item.path);
              const content = await fetchRaw(url);
              if (!content) continue;
              const matched = matchKeys(content, providers);
              for (const m of matched) {
                if (!allKeys.has(m.key)) {
                  allKeys.set(m.key, {
                    key: m.key, provider: m.provider,
                    source: `gist:${item.repository.full_name}`,
                    repoUrl: `https://gist.github.com/${item.repository.full_name}`,
                    filePath: item.path,
                    sourceType: "gist",
                  });
                }
              }
            } catch { /* skip */ }
          }
        } catch { /* skip */ }
        await new Promise(r => setTimeout(r, 200));
      }
    }
  }

  return { keys: allKeys, scanned };
}

// ── Pastebin source ───────────────────────────────────────────────
async function scanPastebin(providers) {
  const allKeys = new Map();
  let scanned = 0;

  try {
    const res = await fetch("https://scrape.pastebin.com/api_scraping.php?limit=50", { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const pastes = await res.json();
      for (const paste of pastes.slice(0, 30)) {
        try {
          const content = await fetchRaw(paste.scrape_url);
          if (!content) continue;
          scanned++;
          const matched = matchKeys(content, providers);
          for (const m of matched) {
            if (!allKeys.has(m.key)) {
              allKeys.set(m.key, {
                key: m.key, provider: m.provider,
                source: `pastebin:${paste.key || "unknown"}`,
                repoUrl: paste.full_url || `https://pastebin.com/${paste.key}`,
                filePath: "",
                sourceType: "pastebin",
              });
            }
          }
        } catch { /* skip */ }
        await new Promise(r => setTimeout(r, 50));
      }
    }
  } catch { /* pastebin non-critical */ }

  return { keys: allKeys, scanned };
}

// ── Public API ────────────────────────────────────────────────────
export async function validateKey(key, provider) {
  const cfg = PROVIDERS[provider];
  if (!cfg?.validate) return "unknown";
  try {
    return await cfg.validate(key);
  } catch {
    return "error";
  }
}

/**
 * Probe whether a valid key actually has spendable balance. Returns:
 *   { hasBalance: true|false|null, ...providerSpecific }
 * `null` = provider has no balance endpoint (indeterminate — assume worst-case
 * for paid tier, safe-case for free tier when deciding to notify).
 */
export async function checkBalance(key, provider) {
  const cfg = PROVIDERS[provider];
  if (!cfg?.checkBalance) return { hasBalance: null, source: "no_balance_endpoint" };
  try {
    return await cfg.checkBalance(key);
  } catch (e) {
    return { hasBalance: null, source: "error", error: e.message };
  }
}

/**
 * Predicate: is this key worth alerting the repo owner about?
 * Signal is `real financial exposure`, not `key is valid`.
 *  - paid provider + confirmed balance > 0 → yes
 *  - paid provider + no balance endpoint (unknown) → yes (safe default)
 *  - paid provider + confirmed $0 → no
 *  - free provider (any state)             → no
 *  - status invalid / valid_no_balance     → no
 */
export function isWorthNotifying({ provider, status, balance }) {
  const cfg = PROVIDERS[provider];
  if (!cfg || cfg.tier !== "paid") return false;
  if (status !== "valid" && status !== "rate_limited") return false;
  if (balance?.hasBalance === false) return false;
  return true;
}

export async function runScan({ providers: enabledProviders, sources: enabledSources } = {}) {
  const db = await getAdapter();
  const providers = enabledProviders || Object.keys(PROVIDERS);
  const sources = enabledSources || ["github", "pastebin"];
  const allKeys = new Map();
  const sourceResults = [];
  let totalScanned = 0;

  if (sources.includes("github")) {
    const r = await scanGithub(providers);
    for (const [k, v] of r.keys) allKeys.set(k, v);
    totalScanned += r.scanned;
    sourceResults.push({ source: "github", found: r.keys.size, scanned: r.scanned });
  }

  if (sources.includes("pastebin")) {
    const r = await scanPastebin(providers);
    for (const [k, v] of r.keys) allKeys.set(k, v);
    totalScanned += r.scanned;
    sourceResults.push({ source: "pastebin", found: r.keys.size, scanned: r.scanned });
  }

  const results = [];
  let idx = 0;
  for (const [key, meta] of allKeys) {
    const status = await validateKey(key, meta.provider);

    // Only spend a balance probe when a paid-tier key is potentially usable.
    // Rate-limited also gets probed — the key is still real, owner is still
    // exposed once cooldown expires.
    const cfg = PROVIDERS[meta.provider];
    let balance = null;
    if (cfg?.tier === "paid" && (status === "valid" || status === "rate_limited")) {
      balance = await checkBalance(key, meta.provider);
    }

    const worthNotify = isWorthNotifying({ provider: meta.provider, status, balance });

    const id = uuidv4();
    const now = new Date().toISOString();
    try {
      await db.run(
        `INSERT INTO scannedKeys(id, key, provider, status, source, repoUrl, filePath, scanDate, balanceInfo, worthNotify)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET status=excluded.status, provider=excluded.provider, scanDate=excluded.scanDate,
                                        balanceInfo=excluded.balanceInfo, worthNotify=excluded.worthNotify`,
        [id, key, meta.provider, status, meta.source, meta.repoUrl, meta.filePath, now,
         balance ? JSON.stringify(balance) : null, worthNotify ? 1 : 0]
      );
    } catch { /* dup */ }
    results.push({
      key: key.slice(0, 24) + "...",
      provider: meta.provider,
      status,
      source: meta.source,
      repoUrl: meta.repoUrl,
      balance,
      worthNotify,
    });
    idx++;
    if (idx % 5 === 0) await new Promise(r => setTimeout(r, 100));
  }

  return {
    total: results.length,
    valid: results.filter(r => r.status === "valid").length,
    valid_no_balance: results.filter(r => r.status === "valid_no_balance" || r.balance?.hasBalance === false).length,
    worth_notifying: results.filter(r => r.worthNotify).length,
    scanned: totalScanned,
    sources: sourceResults,
    results,
  };
}

export async function getScannedKeys(filters = {}) {
  try {
    const db = await getAdapter();
    const where = [];
    const params = [];
    if (filters.status) { where.push("status = ?"); params.push(filters.status); }
    if (filters.provider) { where.push("provider = ?"); params.push(filters.provider); }
    if (filters.source) { where.push("source LIKE ?"); params.push(`%${filters.source}%`); }
    const sql = "SELECT * FROM scannedKeys" + (where.length ? " WHERE " + where.join(" AND ") : "") + " ORDER BY CASE status WHEN 'valid' THEN 0 WHEN 'insufficient_quota' THEN 1 ELSE 2 END, scanDate DESC LIMIT 500";
    return await db.all(sql, params);
  } catch (err) {
    if (err?.message?.includes("no such table")) return [];
    console.error("[Scanner] Error fetching scanned keys:", err);
    return [];
  }
}

export async function deleteScannedKey(id) {
  const db = await getAdapter();
  return db.run("DELETE FROM scannedKeys WHERE id = ?", [id]);
}
