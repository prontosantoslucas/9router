// Popup script — le/salva config, mostra status live, botoes de acao

const $ = (id) => document.getElementById(id);

async function loadConfig() {
  const cfg = await new Promise((r) => chrome.storage.local.get(["agentUrl", "token", "enabled"], r));
  $("agentUrl").value = cfg.agentUrl || "https://maxrouter-prod.up.railway.app";
  $("token").value = cfg.token || "";
  $("toggle-enabled").textContent = cfg.enabled === false ? "Ativar" : "Pausar";
}

async function saveConfig() {
  const agentUrl = $("agentUrl").value.trim();
  const token = $("token").value.trim();
  await new Promise((r) => chrome.storage.local.set({ agentUrl, token }, r));
  await refreshStatus();
  chrome.runtime.sendMessage({ type: "poll-now" });
}

async function toggleEnabled() {
  const cfg = await new Promise((r) => chrome.storage.local.get(["enabled"], r));
  const next = cfg.enabled === false;
  await new Promise((r) => chrome.storage.local.set({ enabled: next }, r));
  $("toggle-enabled").textContent = next ? "Pausar" : "Ativar";
  chrome.runtime.sendMessage({ type: "poll-now" });
}

async function checkLinkedInSession() {
  return new Promise((resolve) => {
    chrome.cookies.getAll({ domain: "linkedin.com", name: "li_at" }, (cookies) => {
      resolve(cookies.length > 0);
    });
  });
}

async function refreshStatus() {
  const status = await new Promise((r) => chrome.storage.local.get(["status"], (x) => r(x.status || {})));
  const cfg = await new Promise((r) => chrome.storage.local.get(["agentUrl", "token", "enabled"], r));

  const linkedIn = await checkLinkedInSession();
  $("s-linkedin").innerHTML = linkedIn
    ? '<span class="dot ok"></span>logado'
    : '<span class="dot err"></span>desconectado';

  let state = status.state || "—";
  let stateDot = "warn";
  if (state === "waiting") { state = "aguardando"; stateDot = "ok"; }
  else if (state === "idle-unconfigured") { state = "sem config"; stateDot = "warn"; }
  else if (state === "no-linkedin-session") { state = "sem LinkedIn"; stateDot = "err"; }
  else if (state.startsWith("executing")) { stateDot = "ok"; }
  else if (state.startsWith("agent-error") || state === "poll-error") { stateDot = "err"; }
  if (cfg.enabled === false) { state = "pausado"; stateDot = "warn"; }

  $("s-state").innerHTML = `<span class="dot ${stateDot}"></span>${state}`;
  $("s-job").textContent = status.lastJobId || "—";
  $("s-err").textContent = status.lastError ? String(status.lastError).slice(0, 40) : "—";
}

$("save").addEventListener("click", saveConfig);
$("poll-now").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "poll-now" }, () => refreshStatus());
});
$("toggle-enabled").addEventListener("click", toggleEnabled);

loadConfig().then(refreshStatus);
setInterval(refreshStatus, 3000);
