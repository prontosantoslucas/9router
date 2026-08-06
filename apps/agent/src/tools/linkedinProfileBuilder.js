// Perfil profissional derivado dos repositórios do usuário no GitHub.
// Usado pelo linkedin_job_hunt para gerar queries de busca no LinkedIn.
//
// Fontes:
//  - GET /users/{owner}/repos      → lista, linguagens principais, tópicos, fork? público?
//  - GET /repos/{o}/{r}/languages  → bytes por linguagem (só para top N repos)
//  - GET /repos/{o}/{r}/contents/  → package.json / requirements.txt / Cargo.toml / go.mod
//                                     → extrai frameworks/libs de peso
//
// Cache em memória: chama uma vez por proc; refetch se force=true.

const { GITHUB_TOKEN } = require("../config");

const GH_API = "https://api.github.com";
const MAX_REPOS_TO_INSPECT = 20;        // teto pra não estourar rate limit
const REPO_INSPECT_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 30 * 60_000;       // 30 min

let cache = null; // { owner, ts, profile }

function ghHeaders() {
  const h = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (GITHUB_TOKEN) h.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return h;
}

async function ghGet(path, { timeout = REPO_INSPECT_TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${GH_API}${path}`, { headers: ghHeaders(), signal: ctrl.signal });
    if (!res.ok) throw new Error(`GitHub ${path} → HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// Palavras-chave que aparecem em package.json/requirements/etc e são "stacks reais"
// worth flagging para o LinkedIn (evita ruído de deps triviais como chalk/lodash).
const STACK_SIGNALS = {
  react: /^react$|^react-dom$|^next$/i,
  nextjs: /^next$/i,
  vue: /^vue$|^nuxt$/i,
  svelte: /^svelte$|^@sveltejs/i,
  angular: /^@angular\//i,
  nodejs: /^express$|^koa$|^fastify$|^nest$/i,
  typescript: /^typescript$/i,
  python_backend: /^fastapi$|^flask$|^django$|^starlette$/i,
  python_ml: /^torch$|^tensorflow$|^scikit-learn$|^pandas$|^numpy$/i,
  ai_llm: /^openai$|^anthropic$|^langchain|^langgraph|^llamaindex$|^ollama$/i,
  mcp: /^@modelcontextprotocol\/sdk$|^fastmcp$/i,
  postgres: /^pg$|^postgres$|^psycopg2$|^sqlalchemy$/i,
  redis: /^redis$|^ioredis$/i,
  mongodb: /^mongodb$|^mongoose$/i,
  aws: /^aws-sdk$|^@aws-sdk\//i,
  docker: null, // detectado por Dockerfile
  kubernetes: null,
  rust: /^serde$|^tokio$|^actix-web$|^axum$/i,
  golang: null,
  puppeteer_playwright: /^puppeteer$|^playwright$|^patchright$/i,
  scraping: /^cheerio$|^beautifulsoup4$|^lxml$/i,
  telegram: /^telegraf$|^python-telegram-bot$/i,
  whatsapp: /^@whiskeysockets\/baileys$|^venom-bot$/i,
  notion: /^@notionhq\/client$/i,
  google_apis: /^googleapis$|^google-auth-library$/i,
  ocr: /^tesseract|^pdf-parse$|^mammoth$/i,
};

function extractStacksFromManifest(manifest, filename) {
  const stacks = new Set();
  try {
    if (filename.endsWith("package.json")) {
      const obj = JSON.parse(manifest);
      const deps = { ...(obj.dependencies || {}), ...(obj.devDependencies || {}) };
      const names = Object.keys(deps);
      for (const [tag, re] of Object.entries(STACK_SIGNALS)) {
        if (re && names.some((n) => re.test(n))) stacks.add(tag);
      }
    } else if (filename === "requirements.txt" || filename === "pyproject.toml") {
      // Extrai só os nomes dos pacotes, ignorando versões e comentários
      const pkgs = manifest
        .split(/\r?\n/)
        .map((l) => l.trim().split(/[=<>~!#\[]/)[0].trim())
        .filter((l) => l && !l.startsWith("#"));
      for (const [tag, re] of Object.entries(STACK_SIGNALS)) {
        if (re && pkgs.some((n) => re.test(n))) stacks.add(tag);
      }
    } else if (filename === "Cargo.toml") {
      stacks.add("rust");
      for (const [tag, re] of Object.entries(STACK_SIGNALS)) {
        if (re && re.test(manifest)) stacks.add(tag);
      }
    } else if (filename === "go.mod") {
      stacks.add("golang");
    }
  } catch {
    // manifesto inválido — ignora
  }
  return [...stacks];
}

// Sondagens paralelas de package.json / requirements etc num repo
const MANIFEST_PROBES = [
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "Dockerfile",
];

async function probeRepo(owner, repo) {
  const stacks = new Set();
  await Promise.all(
    MANIFEST_PROBES.map(async (path) => {
      try {
        const body = await ghGet(`/repos/${owner}/${repo}/contents/${path}`, { timeout: 5000 });
        if (path === "Dockerfile") { stacks.add("docker"); return; }
        if (!body?.content) return;
        const decoded = Buffer.from(body.content, "base64").toString("utf-8");
        for (const s of extractStacksFromManifest(decoded, path)) stacks.add(s);
      } catch {
        // 404 é o esperado quando o arquivo não existe — engole
      }
    })
  );
  return [...stacks];
}

// Constrói o perfil consolidado
async function buildProfile(owner, { force = false } = {}) {
  if (!owner) throw new Error("buildProfile: owner obrigatório");
  const now = Date.now();
  if (!force && cache && cache.owner === owner && (now - cache.ts) < CACHE_TTL_MS) {
    return cache.profile;
  }

  // Lista repos. Se o token pertence ao próprio owner, /user/repos traz privados
  // também. Fallback para /users/{owner}/repos (só públicos) se auth falhar.
  let repos;
  try {
    const who = GITHUB_TOKEN ? await ghGet("/user", { timeout: 5000 }) : null;
    if (who && who.login && who.login.toLowerCase() === owner.toLowerCase()) {
      repos = await ghGet(`/user/repos?per_page=100&sort=pushed&direction=desc&affiliation=owner&visibility=all`);
    } else {
      repos = await ghGet(`/users/${owner}/repos?per_page=100&sort=pushed&direction=desc`);
    }
  } catch {
    repos = await ghGet(`/users/${owner}/repos?per_page=100&sort=pushed&direction=desc`);
  }
  const nonForks = repos.filter((r) => !r.fork && !r.archived);

  const languageWeights = {}; // linguagem → bytes acumulados
  const topics = new Set();
  const nameFragments = new Set(); // palavras dos nomes de repo → sinais de domínio
  const stacksAll = new Set();
  const recentFocus = [];

  // Sondagem paralela (top N mais recentes)
  const top = nonForks.slice(0, MAX_REPOS_TO_INSPECT);
  await Promise.all(
    top.map(async (r) => {
      if (r.language) languageWeights[r.language] = (languageWeights[r.language] || 0) + (r.size || 1);
      (r.topics || []).forEach((t) => topics.add(t));
      // fragmenta nome do repo em tokens úteis (min 3 chars, alfa)
      String(r.name)
        .toLowerCase()
        .split(/[-_/\s.]+/)
        .filter((w) => w.length >= 3 && /^[a-z]+$/.test(w))
        .forEach((w) => nameFragments.add(w));

      try {
        const stacks = await probeRepo(owner, r.name);
        stacks.forEach((s) => stacksAll.add(s));
        if (recentFocus.length < 5) {
          recentFocus.push({
            name: r.name,
            desc: r.description || null,
            stacks,
            pushed_at: r.pushed_at,
          });
        }
      } catch {
        // ignora falha individual
      }
    })
  );

  // Ordena linguagens por peso relativo
  const totalBytes = Object.values(languageWeights).reduce((a, b) => a + b, 0) || 1;
  const languages = Object.entries(languageWeights)
    .map(([lang, bytes]) => ({ lang, share: +(bytes / totalBytes).toFixed(3) }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 8);

  const profile = {
    owner,
    total_repos: nonForks.length,
    inspected: top.length,
    generated_at: new Date().toISOString(),
    languages,
    stacks: [...stacksAll].sort(),
    topics: [...topics].sort(),
    signal_words: [...nameFragments]
      .filter((w) => !["main", "app", "test", "old", "new", "bot", "api"].includes(w))
      .sort(),
    recent_focus: recentFocus,
  };

  cache = { owner, ts: now, profile };
  return profile;
}

// Gera queries de busca no LinkedIn a partir do perfil.
// Heurística: combina top languages × stacks × palavra-guia genérica ("engineer", "developer").
// Retorna até maxQueries strings de busca.
function queriesFromProfile(profile, { maxQueries = 5, seniority = null } = {}) {
  const q = new Set();
  // Ignora "linguagens" que são markup/style/config — LinkedIn não busca por elas
  const NOISE_LANGS = new Set(["html", "css", "scss", "sass", "less", "json", "yaml", "yml", "makefile", "dockerfile", "batchfile", "shell"]);
  const topLangs = profile.languages
    .filter((l) => !NOISE_LANGS.has(l.lang.toLowerCase()))
    .slice(0, 3)
    .map((l) => l.lang.toLowerCase());
  const topStacks = profile.stacks.slice(0, 6);
  const roleWord = seniority ? `${seniority} engineer` : "engineer";

  // (1) linguagem sozinha
  topLangs.forEach((l) => q.add(`${l} ${roleWord}`));

  // (2) stack forte + linguagem
  const priorityStacks = ["nextjs", "react", "ai_llm", "python_ml", "python_backend", "mcp", "nodejs"];
  priorityStacks
    .filter((s) => topStacks.includes(s))
    .forEach((s) => {
      const label = ({
        nextjs: "Next.js",
        react: "React",
        ai_llm: "AI LLM",
        python_ml: "Machine Learning",
        python_backend: "Python Backend",
        mcp: "MCP Agent",
        nodejs: "Node.js",
      })[s];
      q.add(`${label} ${roleWord}`);
    });

  // (3) tema de domínio se aparecer (fintech, ocr, scraping, etc.)
  if (topStacks.includes("scraping") || topStacks.includes("puppeteer_playwright")) q.add("web scraping engineer");
  if (topStacks.includes("ocr")) q.add("OCR engineer");
  if (profile.signal_words.some((w) => ["credito", "fintech", "banco"].includes(w))) q.add("fintech engineer");

  return [...q].slice(0, maxQueries);
}

module.exports = { buildProfile, queriesFromProfile };
