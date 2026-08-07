// Fontes de vaga públicas, sem login/sessão — usadas por linkedin_job_hunt
// pra reduzir dependência do LinkedIn (sessão que desloga com scraping).
//
// Todas as fontes aqui são JSON público, sem API key, sem cookie. Cada
// fetcher é fail-open: qualquer erro devolve [] em vez de derrubar o hunt.
//
// job_id de cada fonte é prefixado (`remoteok:`, `remotive:`, `arbeitnow:`,
// `jobicy:`, `workingnomads:`) pra nunca colidir com IDs numéricos do
// LinkedIn no dedupe.

const FETCH_TIMEOUT_MS = 8000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

async function getJson(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// Palavra de cargo genérica demais pra ser sinal por si só — quase todo
// título de vaga tem "engineer"/"developer", então ela não entra na decisão.
const ROLE_STOPWORDS = new Set(["engineer", "engineering", "developer", "dev", "programmer"]);

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Match por "palavra inteira", não substring — senão token curto tipo "go"
// bate em "Django"/"Mongo", "r" bate em qualquer palavra com R, etc. Usa
// lookaround em vez de \b puro pra token com pontuação ("node.js", "c++")
// continuar casando: só rejeita se o char vizinho for letra/dígito.
function wordMatches(text, word) {
  const re = new RegExp(`(?<![a-z0-9])${escapeRegex(word)}(?![a-z0-9])`, "i");
  return re.test(text);
}

// Uma query "casa" com o texto se TODAS as palavras "significativas" (ou
// seja, tirando as genéricas de cargo acima) aparecerem no texto (AND).
// Várias queries são OR entre si (basta uma bater cheio). Se a query só tiver
// palavra genérica (ex: query "engineer" sozinha), usa ela mesma como sinal.
function matchesAnyQuery(text, queries) {
  const qs = [].concat(queries).filter(Boolean);
  if (!qs.length) return true;
  return qs.some((q) => {
    const words = String(q).toLowerCase().split(/\s+/).filter(Boolean);
    const significant = words.filter((w) => !ROLE_STOPWORDS.has(w));
    const required = significant.length ? significant : words;
    return required.length > 0 && required.every((w) => wordMatches(text, w));
  });
}

// RemoteOK — GET https://remoteok.com/api devolve array; primeiro elemento é
// legal notice (sem campo `id`), não filtra por keyword server-side.
async function fetchRemoteOK(queries) {
  try {
    const data = await getJson("https://remoteok.com/api");
    if (!Array.isArray(data)) return [];
    // Casa só pelo título — descrição E tags têm ruído real: vagas de agência
    // de recrutamento "empilham" dezenas de tags não relacionadas ao cargo
    // (ex: "Procurement Specialist" com tags incluindo "engineer" e "react")
    // pra aparecer em mais buscas. Título é o único campo confiável aqui.
    return data
      .filter((j) => j && j.id)
      .filter((j) => matchesAnyQuery(j.position || "", queries))
      .map((j) => ({
        job_id: `remoteok:${j.id}`,
        title: j.position || j.title || "",
        company: j.company || "",
        location: j.location || "Remote",
        url: j.url || (j.slug ? `https://remoteok.com/remote-jobs/${j.slug}` : null),
        description: j.description || "",
        source: "remoteok",
      }));
  } catch (err) {
    console.warn(`[externalJobSources] remoteok falhou: ${err.message}`);
    return [];
  }
}

// Remotive — GET https://remotive.com/api/remote-jobs?search=<kw> tem busca
// server-side, mas na prática é bem solta (devolveu "Sales Jedi" pra query
// "react engineer" em teste manual) — refiltra por título localmente.
async function fetchRemotive(keywords) {
  try {
    const params = new URLSearchParams();
    if (keywords) params.set("search", keywords);
    params.set("limit", "40");
    const data = await getJson(`https://remotive.com/api/remote-jobs?${params.toString()}`);
    const jobs = data?.jobs;
    if (!Array.isArray(jobs)) return [];
    return jobs
      .filter((j) => matchesAnyQuery(j.title || "", keywords))
      .map((j) => ({
      job_id: `remotive:${j.id}`,
      title: j.title || "",
      company: j.company_name || "",
      location: j.candidate_required_location || "Remote",
      url: j.url || null,
      description: j.description || "",
      source: "remotive",
    }));
  } catch (err) {
    console.warn(`[externalJobSources] remotive falhou: ${err.message}`);
    return [];
  }
}

// Arbeitnow — GET https://www.arbeitnow.com/api/job-board-api, sem busca
// server-side, filtra localmente por keyword em título/tags.
async function fetchArbeitnow(queries) {
  try {
    const data = await getJson("https://www.arbeitnow.com/api/job-board-api");
    const jobs = data?.data;
    if (!Array.isArray(jobs)) return [];
    // Mesmo motivo do RemoteOK: só título, tags podem ter ruído de SEO.
    return jobs
      .filter((j) => matchesAnyQuery(j.title || "", queries))
      .map((j) => ({
        job_id: `arbeitnow:${j.slug}`,
        title: j.title || "",
        company: j.company_name || "",
        location: j.location || (j.remote ? "Remote" : ""),
        url: j.url || null,
        description: j.description || "",
        source: "arbeitnow",
      }));
  } catch (err) {
    console.warn(`[externalJobSources] arbeitnow falhou: ${err.message}`);
    return [];
  }
}

// Jobicy — GET https://jobicy.com/api/v2/remote-jobs?count=100. Tem filtro
// `tag=` server-side, mas é 1 tag por vez e não documentado o bastante pra
// confiar (não testamos todas as combinações) — pede um lote grande recente
// e filtra por título localmente, igual às fontes sem busca confiável.
async function fetchJobicy(queries) {
  try {
    const data = await getJson("https://jobicy.com/api/v2/remote-jobs?count=100");
    const jobs = data?.jobs;
    if (!Array.isArray(jobs)) return [];
    return jobs
      .filter((j) => matchesAnyQuery(j.jobTitle || "", queries))
      .map((j) => ({
        job_id: `jobicy:${j.id}`,
        title: j.jobTitle || "",
        company: j.companyName || "",
        location: j.jobGeo || "Remote",
        url: j.url || null,
        description: j.jobExcerpt || "",
        source: "jobicy",
      }));
  } catch (err) {
    console.warn(`[externalJobSources] jobicy falhou: ${err.message}`);
    return [];
  }
}

// WorkingNomads — GET .../api/exposed_jobs/, catálogo pequeno (~40-50 vagas
// no ar), sem paginação nem busca — fetch completo, filtra por título.
async function fetchWorkingNomads(queries) {
  try {
    const jobs = await getJson("https://www.workingnomads.com/api/exposed_jobs/");
    if (!Array.isArray(jobs)) return [];
    return jobs
      .filter((j) => matchesAnyQuery(j.title || "", queries))
      .map((j) => {
        // sem campo de id — usa o número no final da URL (/job/go/<id>/) ou a
        // própria URL como fallback pra ainda ter uma chave estável.
        const idFromUrl = String(j.url || "").match(/(\d+)\/?$/)?.[1];
        return {
          job_id: `workingnomads:${idFromUrl || j.url}`,
          title: j.title || "",
          company: j.company_name || "",
          location: j.location || "Remote",
          url: j.url || null,
          description: j.description || "",
          source: "workingnomads",
        };
      });
  } catch (err) {
    console.warn(`[externalJobSources] workingnomads falhou: ${err.message}`);
    return [];
  }
}

const SOURCE_FETCHERS = {
  remoteok: fetchRemoteOK,
  remotive: fetchRemotive,
  arbeitnow: fetchArbeitnow,
  jobicy: fetchJobicy,
  workingnomads: fetchWorkingNomads,
};

// Fontes que fazem busca server-side por query individual (1 request por
// query, até 3, pra não abusar da API pública). As demais não têm busca
// confiável — 1 fetch do catálogo (ou lote recente) inteiro, filtrado
// localmente pela lista completa de queries (matchesAnyQuery).
const PER_QUERY_SOURCES = new Set(["remotive"]);

// Busca em paralelo nas fontes pedidas (default: todas), a partir de uma
// lista de queries (mesmas geradas pro LinkedIn via queriesFromProfile).
async function fetchExternalJobs(queries, sources = Object.keys(SOURCE_FETCHERS)) {
  const list = [].concat(queries).filter(Boolean);
  const enabled = sources.filter((s) => SOURCE_FETCHERS[s]);

  const tasks = enabled.map((s) => {
    if (PER_QUERY_SOURCES.has(s)) {
      return Promise.all(list.slice(0, 3).map((q) => SOURCE_FETCHERS[s](q))).then((r) => r.flat());
    }
    return SOURCE_FETCHERS[s](list);
  });

  const results = await Promise.all(tasks);
  return results.flat();
}

module.exports = { fetchExternalJobs, SOURCE_FETCHERS };
