import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "@/lib/db/driver.js";

// ── Provider definitions ──────────────────────────────────────────
export const PROVIDERS = {
  openai: {
    name: "OpenAI",
    patterns: [
      /sk-proj-[A-Za-z0-9-_]{74}T3BlbkFJ[A-Za-z0-9-_]{73}A/g,
      /sk-svcacct-[A-Za-z0-9-_]{74}T3BlbkFJ[A-Za-z0-9-_]{73}A/g,
      /sk-proj-[A-Za-z0-9-_]{58}T3BlbkFJ[A-Za-z0-9-_]{58}/g,
      /sk-proj-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}/g,
    ],
    validate: async (key) => {
      const res = await fetch("https://api.openai.com/v1/dashboard/billing/credit_grants", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) {
        const data = await res.json();
        return data.total_granted > 0 ? "valid" : "insufficient_quota";
      }
      if (res.status === 401) {
        const body = await res.json().catch(() => ({}));
        if (body.code === "insufficient_quota") return "insufficient_quota";
      }
      // Fallback: try models endpoint (works for some restricted key types)
      try {
        const res2 = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(5000),
        });
        if (res2.status === 200) return "valid";
        if (res2.status === 401) {
          const body2 = await res2.json().catch(() => ({}));
          if (body2.code === "insufficient_quota") return "insufficient_quota";
        }
        if (res2.status === 429) return "rate_limited";
      } catch {}
      return res.status === 401 ? "invalid" : res.status === 429 ? "rate_limited" : "error";
    },
    searchTokens: ["sk-proj-", "sk-svcacct-"],
  },
  anthropic: {
    name: "Anthropic",
    patterns: [/sk-ant-[A-Za-z0-9-_]{32,100}/g],
    validate: async (key) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-3-haiku-20240307", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200 || res.status === 400) return "valid";
      if (res.status === 401) return "invalid";
      if (res.status === 429) return "rate_limited";
      return "error";
    },
    searchTokens: ["sk-ant-"],
  },
  deepseek: {
    name: "DeepSeek",
    patterns: [/sk-[a-f0-9]{32,64}/g],
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
    searchTokens: ["sk-"],
  },
  perplexity: {
    name: "Perplexity",
    patterns: [/pplx-[A-Za-z0-9-_]{32,100}/g],
    validate: async (key) => {
      const res = await fetch("https://api.perplexity.ai/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) return "valid";
      if (res.status === 401) return "invalid";
      if (res.status === 429) return "rate_limited";
      return "error";
    },
    searchTokens: ["pplx-"],
  },
  groq: {
    name: "Groq",
    patterns: [/gsk_[A-Za-z0-9]{40,60}/g],
    validate: async (key) => {
      const res = await fetch("https://api.groq.com/v1/models", {
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
    patterns: [/AIzaSy[A-Za-z0-9_-]{26,40}/g],
    validate: async (key) => {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "say ok" }] }] }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) return "valid";
      if (res.status === 403 || res.status === 400) return "invalid";
      if (res.status === 429) return "rate_limited";
      return "error";
    },
    searchTokens: ["AIzaSy"],
  },
  huggingface: {
    name: "HuggingFace",
    patterns: [/hf_[A-Za-z0-9]{20,60}/g],
    validate: async (key) => {
      const res = await fetch("https://huggingface.co/api/models?limit=1", {
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
    patterns: [/r8_[A-Za-z0-9]{30,60}/g],
    validate: async (key) => {
      const res = await fetch("https://api.replicate.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) return "valid";
      if (res.status === 401) return "invalid";
      return "error";
    },
    searchTokens: ["r8_"],
  },
  openrouter: {
    name: "OpenRouter",
    patterns: [/sk-or-v1-[A-Za-z0-9]{40,100}/g, /sk-or-[A-Za-z0-9]{40,80}/g],
    validate: async (key) => {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) return "valid";
      if (res.status === 401) return "invalid";
      if (res.status === 429) return "rate_limited";
      return "error";
    },
    searchTokens: ["sk-or-"],
  },
  together: {
    name: "Together AI",
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
    patterns: [/eleven-[A-Za-z0-9]{30,60}/g],
    validate: async (key) => {
      const res = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": key },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) return "valid";
      if (res.status === 401) return "invalid";
      return "error";
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
    const id = uuidv4();
    const now = new Date().toISOString();
    try {
      await db.run(
        `INSERT INTO scannedKeys(id, key, provider, status, source, repoUrl, filePath, scanDate)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET status=excluded.status, provider=excluded.provider, scanDate=excluded.scanDate`,
        [id, key, meta.provider, status, meta.source, meta.repoUrl, meta.filePath, now]
      );
    } catch { /* dup */ }
    results.push({ key: key.slice(0, 24) + "...", provider: meta.provider, status, source: meta.source, repoUrl: meta.repoUrl });
    idx++;
    if (idx % 5 === 0) await new Promise(r => setTimeout(r, 100));
  }

  return {
    total: results.length,
    valid: results.filter(r => r.status === "valid").length,
    insufficient_quota: results.filter(r => r.status === "insufficient_quota").length,
    scanned: totalScanned,
    sources: sourceResults,
    results,
  };
}

export async function getScannedKeys(filters = {}) {
  const db = await getAdapter();
  const where = [];
  const params = [];
  if (filters.status) { where.push("status = ?"); params.push(filters.status); }
  if (filters.provider) { where.push("provider = ?"); params.push(filters.provider); }
  if (filters.source) { where.push("source LIKE ?"); params.push(`%${filters.source}%`); }
  const sql = "SELECT * FROM scannedKeys" + (where.length ? " WHERE " + where.join(" AND ") : "") + " ORDER BY CASE status WHEN 'valid' THEN 0 WHEN 'insufficient_quota' THEN 1 ELSE 2 END, scanDate DESC LIMIT 500";
  return db.all(sql, params);
}

export async function deleteScannedKey(id) {
  const db = await getAdapter();
  return db.run("DELETE FROM scannedKeys WHERE id = ?", [id]);
}
