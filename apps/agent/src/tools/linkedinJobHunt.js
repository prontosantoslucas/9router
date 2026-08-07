// linkedin_job_hunt — combina profile-builder + linkedin-mcp para descobrir
// vagas alinhadas com os projetos do usuário, rankear, e (opcional) gerar
// cover letter para as top 5.

const { callLinkedin } = require("./linkedinClient");
const { buildProfile, queriesFromProfile } = require("./linkedinProfileBuilder");
const { chatCompletion } = require("../lib/llmGatewayClient");

const DEFAULT_OWNER = "prontosantoslucas";

// Extrai lista/objeto de vagas dos vários formatos que o linkedin-mcp-server
// pode devolver (structuredContent, content.text JSON, etc.)
function normalizeJobs(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.results)) return raw.results;
  if (Array.isArray(raw.jobs)) return raw.jobs;
  if (typeof raw === "string") {
    try { const p = JSON.parse(raw); return normalizeJobs(p); } catch { return []; }
  }
  return [];
}

// Dedup por job_id / URL / (title+company) — evita o mesmo job em queries diferentes
function dedupeJobs(list) {
  const seen = new Set();
  const out = [];
  for (const j of list) {
    const key = j.job_id || j.id || j.url || `${j.title}::${j.company_name || j.company}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(j);
  }
  return out;
}

// Score heurístico rápido — antes do LLM entrar em cena
function heuristicScore(job, profile) {
  const text = `${job.title || ""} ${job.description || ""} ${job.company_name || job.company || ""}`.toLowerCase();
  let score = 0;
  // linguagens
  for (const { lang, share } of profile.languages) {
    if (text.includes(lang.toLowerCase())) score += 10 * share;
  }
  // stacks
  const stackKeywords = {
    react: ["react", "next"], nextjs: ["next.js", "nextjs"],
    nodejs: ["node.js", "nodejs"], python_backend: ["fastapi", "django", "flask"],
    python_ml: ["machine learning", "pytorch", "tensorflow"],
    ai_llm: ["llm", "openai", "anthropic", "genai", "gpt"],
    mcp: ["mcp", "agent", "tool use"],
    postgres: ["postgres", "sql"], docker: ["docker", "kubernetes"],
    puppeteer_playwright: ["playwright", "puppeteer", "scraping"],
  };
  for (const s of profile.stacks) {
    const kws = stackKeywords[s] || [s];
    if (kws.some((k) => text.includes(k))) score += 3;
  }
  // remote bonus
  if (/remote|remoto|home[- ]office/.test(text)) score += 2;
  return +score.toFixed(2);
}

// Rank via LLM — só nas top 20 heurísticas pra economizar tokens
async function rankWithLLM(jobs, profile, wanted = 10) {
  if (jobs.length === 0) return [];
  const short = jobs.slice(0, 20).map((j, i) => ({
    idx: i,
    title: j.title,
    company: j.company_name || j.company,
    location: j.location,
    snippet: (j.description || "").slice(0, 300),
  }));

  const messages = [
    { role: "system", content: "Você é um recrutador técnico que ajuda um dev a filtrar vagas. Responda APENAS com JSON válido, sem markdown, sem prosa." },
    { role: "user", content:
`Perfil do dev:
- Linguagens: ${profile.languages.map((l) => `${l.lang}(${l.share})`).join(", ")}
- Stacks: ${profile.stacks.join(", ")}
- Projetos recentes: ${profile.recent_focus.map((r) => r.name).join(", ")}

Vagas candidatas:
${JSON.stringify(short, null, 2)}

Retorne JSON no formato:
{"ranked":[{"idx":0,"score":0-100,"why":"one-liner"}, ...]}

Rankeie do mais aderente pro menos. Score reflete "esse dev deveria aplicar?" em escala 0-100. "why" explica o match em UMA frase (max 15 palavras).`
    },
  ];

  try {
    const resp = await chatCompletion({ messages, temperature: 0.2, max_tokens: 2500 });
    const text = resp?.choices?.[0]?.message?.content || "";
    // remove ``` cercas se o modelo teimou
    const clean = text.replace(/^```(json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(clean);
    const ranked = Array.isArray(parsed.ranked) ? parsed.ranked : [];
    // aplica scores nos jobs
    const scored = ranked
      .map((r) => ({ ...short[r.idx], llm_score: r.score, why: r.why, original: jobs[r.idx] }))
      .filter((r) => r.original)
      .sort((a, b) => b.llm_score - a.llm_score);
    return scored.slice(0, wanted);
  } catch (err) {
    console.warn(`[job_hunt] LLM rank falhou (${err.message}) — usando só heurística`);
    return jobs.slice(0, wanted).map((j) => ({ ...j, llm_score: null, why: "sem LLM rank", original: j }));
  }
}

async function generateCoverLetter(jobDetail, profile) {
  const messages = [
    { role: "system", content: "Você é o próprio candidato escrevendo cover letter. Tom direto, profissional, em português brasileiro. Sem clichê corporativo." },
    { role: "user", content:
`Perfil (para você entender contexto, não repetir):
Linguagens: ${profile.languages.map((l) => l.lang).join(", ")}
Stacks: ${profile.stacks.join(", ")}
Projetos: ${profile.recent_focus.map((r) => `${r.name}${r.desc ? " (" + r.desc.slice(0, 80) + ")" : ""}`).join("; ")}

Vaga:
${JSON.stringify({
  title: jobDetail.title, company: jobDetail.company_name || jobDetail.company,
  location: jobDetail.location,
  description: (jobDetail.description || "").slice(0, 1500),
}, null, 2)}

Escreva a cover letter em 150-200 palavras. Estrutura:
1. Frase de abertura ligando um projeto seu concreto ao que a vaga faz.
2. Bullet ou frase curta com 2-3 skills técnicas relevantes (não listar TUDO).
3. Fecho curto, com convite para conversa.

NÃO invente experiências. Se a vaga pede algo que você não tem no perfil, ignore em vez de mentir.`
    },
  ];
  try {
    const resp = await chatCompletion({ messages, temperature: 0.6, max_tokens: 500 });
    return resp?.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    return `[cover letter falhou: ${err.message}]`;
  }
}

// Handler principal
async function runJobHunt(args = {}) {
  const owner = args.github_owner || DEFAULT_OWNER;
  const location = args.location || null;
  const seniority = args.seniority || null;
  const maxResults = Math.min(Math.max(Number(args.max_results) || 10, 1), 25);
  const generateCovers = args.cover_letters !== false; // default true

  const lines = [];
  const push = (s) => lines.push(s);

  push(`🔍 Buscando vagas para @${owner}...`);

  // 1. Perfil
  let profile;
  try {
    profile = await buildProfile(owner);
  } catch (err) {
    return `❌ Falha ao construir perfil de ${owner}: ${err.message}`;
  }
  push(`\n📊 Perfil detectado (${profile.total_repos} repos, ${profile.inspected} inspecionados):`);
  push(`   Linguagens: ${profile.languages.map((l) => `${l.lang} ${Math.round(l.share*100)}%`).join(", ")}`);
  push(`   Stacks: ${profile.stacks.join(", ") || "(nenhum detectado)"}`);
  push(`   Focos recentes: ${profile.recent_focus.map((r) => r.name).join(", ")}`);

  // 2. Queries
  const queries = args.queries_override
    ? [].concat(args.queries_override)
    : queriesFromProfile(profile, { seniority, maxQueries: 5 });
  push(`\n🎯 Queries LinkedIn:`);
  queries.forEach((q) => push(`   - "${q}"${location ? ` @ ${location}` : ""}`));

  // 3. Busca
  const all = [];
  for (const q of queries) {
    try {
      const raw = await callLinkedin("search_jobs", {
        keywords: q,
        ...(location ? { location } : {}),
      });
      // callLinkedin devolve string (formatado) — tenta parsear JSON
      let parsed = raw;
      if (typeof raw === "string") {
        try { parsed = JSON.parse(raw); } catch { /* segue com string */ }
      }
      const jobs = normalizeJobs(parsed);
      push(`   → "${q}": ${jobs.length} vagas`);
      all.push(...jobs);
    } catch (err) {
      push(`   ⚠ "${q}" falhou: ${err.message}`);
    }
  }

  const deduped = dedupeJobs(all);
  push(`\n🧹 ${all.length} → ${deduped.length} após dedup`);

  if (deduped.length === 0) return lines.join("\n") + "\n\n❌ Nenhuma vaga encontrada.";

  // 4. Score heurístico + LLM ranking
  const withHeuristic = deduped.map((j) => ({ ...j, heur_score: heuristicScore(j, profile) }))
    .sort((a, b) => b.heur_score - a.heur_score);
  const ranked = await rankWithLLM(withHeuristic, profile, maxResults);

  // 5. Detalhes + cover letter para top 5
  const topForCover = ranked.slice(0, Math.min(5, ranked.length));
  const covers = {};
  if (generateCovers) {
    push(`\n✍️  Gerando cover letters para top ${topForCover.length}...`);
    await Promise.all(topForCover.map(async (r, i) => {
      const jobId = r.original.job_id || r.original.id;
      let detail = r.original;
      if (jobId) {
        try {
          const raw = await callLinkedin("get_job_details", { job_id: String(jobId) });
          let detail2 = raw;
          if (typeof raw === "string") {
            try { detail2 = JSON.parse(raw); } catch { /* segue */ }
          }
          detail = { ...detail, ...(detail2 || {}) };
        } catch { /* segue com o snippet que já temos */ }
      }
      covers[i] = await generateCoverLetter(detail, profile);
    }));
  }

  // 6. Format final
  push(`\n\n═══ TOP ${ranked.length} VAGAS ═══\n`);
  ranked.forEach((r, i) => {
    const j = r.original;
    const jobId = j.job_id || j.id;
    const url = j.url || (jobId ? `https://www.linkedin.com/jobs/view/${jobId}/` : "(sem URL)");
    push(`\n${i + 1}. **${j.title}** — ${j.company_name || j.company || "?"}`);
    if (j.location) push(`   📍 ${j.location}`);
    push(`   ⭐ score: ${r.llm_score ?? "?"} | 🎯 ${r.why || "(sem análise)"}`);
    push(`   🔗 ${url}`);
    if (covers[i]) {
      push(`\n   📝 Cover letter:\n   ─────`);
      covers[i].split("\n").forEach((ln) => push(`   ${ln}`));
      push(`   ─────`);
    }
  });

  return lines.join("\n");
}

module.exports = { runJobHunt };
