// 9router LinkedIn Helper — service worker
//
// Polling em /api/extension/next-job do agent a cada POLL_INTERVAL_MS.
// Ao receber job: executa via fetch direto nas APIs internas do LinkedIn
// (usa cookies da sessao logada) OU abre aba se precisar renderizar DOM.
// Devolve resultado via POST /api/extension/job-result.

const POLL_INTERVAL_MS = 8000; // 8s
const REQUEST_TIMEOUT_MS = 60000;

// Via online (gateway Next.js): proxy exige prefixo /api/agent/.
// Via local (agent direto na porta 3717): rotas são /api/extension/.
function extPath(agentUrl, sub) {
  const host = (agentUrl || "").replace(/^https?:\/\//, "").split(":")[0].toLowerCase();
  const loopback = host === "localhost" || host === "127.0.0.1" || host === "::1";
  return loopback ? `/api/extension${sub}` : `/api/agent/extension${sub}`;
}

// ── Config storage ────────────────────────────────────────────────────────

async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["agentUrl", "token", "enabled"], (r) => resolve({
      agentUrl: r.agentUrl || "",
      token: r.token || "",
      enabled: r.enabled !== false, // default true
    }));
  });
}

async function setStatus(patch) {
  const cur = await new Promise((r) => chrome.storage.local.get(["status"], (x) => r(x.status || {})));
  const status = { ...cur, ...patch, updatedAt: Date.now() };
  chrome.storage.local.set({ status });
}

// ── Extract CSRF token do cookie JSESSIONID ─────────────────────────────
// LinkedIn expõe JSESSIONID como cookie; o valor precisa ir como header
// `csrf-token` nas chamadas /voyager/api.

async function getLinkedInCsrf() {
  return new Promise((resolve) => {
    chrome.cookies.getAll({ domain: "linkedin.com", name: "JSESSIONID" }, (cookies) => {
      const c = cookies.find((k) => k.name === "JSESSIONID");
      if (!c) return resolve(null);
      // valor vem entre aspas ("ajax:xxxxx") — strip
      const val = String(c.value).replace(/^"|"$/g, "");
      resolve(val);
    });
  });
}

// ── HTTP client pra LinkedIn API interna ────────────────────────────────

async function linkedinFetch(pathOrUrl, opts = {}) {
  const csrf = await getLinkedInCsrf();
  if (!csrf) throw new Error("Nao logado no LinkedIn (JSESSIONID cookie ausente)");
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `https://www.linkedin.com${pathOrUrl}`;
  const headers = {
    "Accept": "application/vnd.linkedin.normalized+json+2.1",
    "csrf-token": csrf,
    "x-restli-protocol-version": "2.0.0",
    "x-li-lang": "pt_BR",
    ...(opts.headers || {}),
  };
  const res = await fetch(url, { credentials: "include", ...opts, headers });
  if (!res.ok) throw new Error(`LinkedIn ${res.status}: ${res.statusText}`);
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("json")) return res.json();
  return res.text();
}

// ── Handlers de job por tipo ─────────────────────────────────────────────

const HANDLERS = {
  async search_jobs({ keywords, location, count = 25 }) {
    const params = new URLSearchParams({
      keywords: keywords || "",
      ...(location ? { location } : {}),
      start: "0",
    });
    const url = `https://www.linkedin.com/jobs/search/?${params.toString()}`;
    // Abre aba invisivelmente pra renderizar (LinkedIn tem defesas contra
    // chamar API direta sem DOM). Usa content script pra scrapar.
    const tab = await chrome.tabs.create({ url, active: false });
    try {
      // aguarda carregar
      await new Promise((resolve) => {
        const listener = (tabId, changeInfo) => {
          if (tabId === tab.id && changeInfo.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
        setTimeout(resolve, 10_000); // fallback
      });
      // aguarda mais 3s pro lazyload da lista
      await new Promise((r) => setTimeout(r, 3000));
      // executa scraper no tab
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scrapeJobsFromPage,
        args: [count],
      });
      return result;
    } finally {
      chrome.tabs.remove(tab.id).catch(() => {});
    }
  },

  async person_profile({ linkedin_username }) {
    if (!linkedin_username) throw new Error("linkedin_username obrigatorio");
    const url = `https://www.linkedin.com/in/${encodeURIComponent(linkedin_username)}/`;
    const tab = await chrome.tabs.create({ url, active: false });
    try {
      await new Promise((resolve) => {
        const listener = (tabId, changeInfo) => {
          if (tabId === tab.id && changeInfo.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
        setTimeout(resolve, 10_000);
      });
      await new Promise((r) => setTimeout(r, 3000));
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scrapeProfileFromPage,
      });
      return result;
    } finally {
      chrome.tabs.remove(tab.id).catch(() => {});
    }
  },

  async edit_profile({ headline, about }) {
    if (!headline && !about) throw new Error("Envie headline e/ou about para editar");
    const url = "https://www.linkedin.com/in/me/edit";
    const tab = await chrome.tabs.create({ url, active: false });
    try {
      await new Promise((resolve) => {
        const listener = (tabId, changeInfo) => {
          if (tabId === tab.id && changeInfo.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
        setTimeout(resolve, 10_000);
      });
      // espera os campos da página de edição renderizarem
      await new Promise((r) => setTimeout(r, 4000));
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: editProfileFromPage,
        args: [{ headline, about }],
      });
      // dá tempo do save commitar antes de fechar a aba
      await new Promise((r) => setTimeout(r, 2500));
      return result;
    } finally {
      chrome.tabs.remove(tab.id).catch(() => {});
    }
  },

  async ping() {
    return { pong: true, ts: Date.now() };
  },
};

// ── Scrapers (executam no context da pagina LinkedIn) ────────────────────

function scrapeJobsFromPage(maxJobs) {
  const jobs = [];
  // Cards de vaga na sidebar
  const cards = document.querySelectorAll(".jobs-search-results__list-item, .job-card-container, .scaffold-layout__list-item");
  for (const card of cards) {
    if (jobs.length >= maxJobs) break;
    const titleEl = card.querySelector("a.job-card-list__title, a.job-card-container__link, a[data-tracking-control-name*='job']");
    const companyEl = card.querySelector(".artdeco-entity-lockup__subtitle, .job-card-container__company-name, .job-card-container__primary-description");
    const locationEl = card.querySelector(".job-card-container__metadata-item, .artdeco-entity-lockup__caption");
    const linkEl = card.querySelector("a[href*='/jobs/view/']");
    const jobId = linkEl?.href?.match(/jobs\/view\/(\d+)/)?.[1];
    if (!titleEl && !jobId) continue;
    jobs.push({
      job_id: jobId,
      title: (titleEl?.textContent || "").trim(),
      company: (companyEl?.textContent || "").trim(),
      location: (locationEl?.textContent || "").trim(),
      url: linkEl?.href || (jobId ? `https://www.linkedin.com/jobs/view/${jobId}/` : null),
    });
  }
  return {
    count: jobs.length,
    jobs,
    scraped_url: location.href,
  };
}

function scrapeProfileFromPage() {
  const q = (sel) => document.querySelector(sel);
  const qa = (sel) => Array.from(document.querySelectorAll(sel));
  const text = (el) => (el?.textContent || "").trim().replace(/\s+/g, " ");
  return {
    name: text(q("h1")),
    headline: text(q(".text-body-medium.break-words")),
    location: text(q(".text-body-small.inline.t-black--light.break-words")),
    about: text(q("#about ~ .display-flex .full-width span[aria-hidden='true'], section:has(#about) span[aria-hidden='true']")),
    experience_titles: qa("section:has(#experience) li .display-flex.flex-column.full-width span[aria-hidden='true']")
      .slice(0, 12)
      .map(text)
      .filter(Boolean),
    skills: qa("section:has(#skills) li .display-flex.flex-column.full-width span[aria-hidden='true']")
      .slice(0, 30)
      .map(text)
      .filter(Boolean),
    url: location.href,
  };
}

// Edita Headline + About na página de edição do LinkedIn (/in/me/edit).
// Preenche via setter nativo (React-friendly) e clica em Save quando existe.
function editProfileFromPage({ headline, about }) {
  const report = { headline: null, about: null, saved: false, errors: [] };

  const setNativeValue = (el, value) => {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    descriptor.set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    // blur força o React/LinkedIn a registrar a edição
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  };

  const isVisible = (el) => el && el.offsetParent !== null;

  // ── Headline ──
  if (headline) {
    const input = document.querySelector("input#headline") || document.querySelector("input[name='headline']");
    if (isVisible(input)) {
      setNativeValue(input, headline);
      report.headline = "ok";
    } else {
      report.errors.push("input#headline não encontrado");
    }
  }

  // ── About (textarea ou rich-text editor) ──
  if (about) {
    const ta = document.querySelector("textarea#about") ||
               document.querySelector("textarea[name='about']") ||
               document.querySelector("textarea.artdeco-text-input");
    if (isVisible(ta)) {
      setNativeValue(ta, about);
      report.about = "ok";
    } else {
      const editor = document.querySelector(".ql-editor") ||
                     document.querySelector("div[contenteditable='true'][role='textbox']") ||
                     document.querySelector("#about-editor div[contenteditable]");
      if (isVisible(editor)) {
        editor.textContent = about;
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        editor.dispatchEvent(new Event("blur", { bubbles: true }));
        report.about = "ok (rich-text)";
      } else {
        report.errors.push("campo about não encontrado");
      }
    }
  }

  // ── Save ──
  const saveBtn = Array.from(document.querySelectorAll("button"))
    .find((b) => /^save$/i.test((b.textContent || "").trim()) && isVisible(b));
  if (saveBtn) {
    saveBtn.click();
    report.saved = true;
  } else if (report.errors.length === 0) {
    report.errors.push("botão Save não encontrado (pode ter autosave)");
  }

  return report;
}

// ── Loop de polling ──────────────────────────────────────────────────────

let polling = false;
async function pollOnce() {
  if (polling) return;
  polling = true;
  try {
    const cfg = await getConfig();
    if (!cfg.enabled || !cfg.agentUrl || !cfg.token) {
      await setStatus({ state: "idle-unconfigured" });
      return;
    }
    const csrf = await getLinkedInCsrf();
    if (!csrf) {
      await setStatus({ state: "no-linkedin-session" });
      return;
    }

    const res = await fetch(`${cfg.agentUrl.replace(/\/$/, "")}${extPath(cfg.agentUrl, "/next-job")}`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${cfg.token}` },
    });
    if (!res.ok) {
      await setStatus({ state: `agent-error-${res.status}`, lastError: res.statusText });
      return;
    }
    const body = await res.json();
    if (!body?.job) {
      await setStatus({ state: "waiting" });
      return;
    }

    await setStatus({ state: `executing-${body.job.type}`, lastJobId: body.job.id });
    const handler = HANDLERS[body.job.type];
    let result, error;
    try {
      if (!handler) throw new Error(`Handler desconhecido: ${body.job.type}`);
      result = await Promise.race([
        handler(body.job.params || {}),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), REQUEST_TIMEOUT_MS)),
      ]);
    } catch (err) {
      error = err.message;
    }

    await fetch(`${cfg.agentUrl.replace(/\/$/, "")}${extPath(cfg.agentUrl, "/job-result")}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: body.job.id, result, error }),
    }).catch((e) => console.error("[maxrouter-ext] job-result POST falhou:", e.message));

    await setStatus({ state: "waiting", lastResult: error ? "error" : "ok", lastError: error || null });
  } catch (err) {
    console.error("[9router-ext] poll error:", err);
    await setStatus({ state: "poll-error", lastError: err.message });
  } finally {
    polling = false;
  }
}

// Alarm-based polling (service worker acorda em cada alarm fire — MV3-safe)
chrome.alarms.create("poll", { periodInMinutes: POLL_INTERVAL_MS / 60000 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "poll") pollOnce();
});

// Poll no boot também
pollOnce();

// Handshake pra popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "poll-now") { pollOnce().then(() => sendResponse({ ok: true })); return true; }
  if (msg?.type === "get-status") {
    chrome.storage.local.get(["status"], (r) => sendResponse(r.status || {}));
    return true;
  }
});
