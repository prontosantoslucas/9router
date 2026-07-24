#!/usr/bin/env node
/**
 * Smoke test pós-deploy — valida que a aplicação viva está de pé e com o
 * roteamento/guarda de auth corretos. Roda em segundos, sem credenciais.
 *
 *   node scripts/smoke-test.mjs                         # usa a URL padrão
 *   node scripts/smoke-test.mjs https://sua-url.app     # URL custom
 *   BASE_URL=https://sua-url.app node scripts/smoke-test.mjs
 *
 * Exit code 0 = tudo OK; != 0 = alguma checagem dura falhou (bom p/ CI/uptime).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CHECKLIST MANUAL (o que este script NÃO cobre — precisa interação real):
 *
 *   [ ] Login → cai direto no /chat
 *   [ ] / (raiz, logado) → volta ao /dashboard; Sidebar com Chat/Painel/CRM/Providers
 *   [ ] Mobile (viewport ~360px): /chat sem scroll horizontal; composer visível
 *   [ ] Chat responde texto (sem "fetch failed" / 401)
 *   [ ] Anexar imagem → agente descreve (modelo com visão)
 *   [ ] Gravar áudio no composer → transcreve (GROQ_API_KEY)
 *   [ ] Enviar vídeo → transcrição/frames (ffmpeg + VIDEO_MODE)
 *   [ ] Botão "Ouvir" numa resposta → toca áudio (provider TTS no gateway)
 *   [ ] Telegram Userbot: parear (2FA se houver) e receber msg no inbox de canais
 *   [ ] WhatsApp (Evolution): QR conecta e msg cai no inbox
 *   [ ] Inbox de canais: "Resumir"/"Responder" monta prompt no chat
 *   [ ] Google Workspace: conectar OAuth e status no /dashboard2
 *   [ ] /dashboard2: semáforos de status refletem o backend real
 * ─────────────────────────────────────────────────────────────────────────
 */

const BASE = (process.argv[2] || process.env.BASE_URL || "https://maxrouter.up.railway.app").replace(/\/+$/, "");
const TIMEOUT_MS = 10000;

async function req(path, { method = "GET" } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, { method, redirect: "manual", signal: controller.signal });
    const ct = res.headers.get("content-type") || "";
    let body = "";
    try { body = await res.text(); } catch {}
    return { status: res.status, ct, body };
  } finally {
    clearTimeout(t);
  }
}

const results = [];
function record(name, pass, detail, { hard = true } = {}) {
  results.push({ name, pass, detail, hard });
  const icon = pass ? "✅" : hard ? "❌" : "⚠️ ";
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log(`\nSmoke test → ${BASE}\n`);

  // 1) Health raso (healthcheck do Railway)
  try {
    const r = await req("/api/health");
    const ok = r.status === 200 && /"ok"\s*:\s*true/.test(r.body);
    record("GET /api/health = 200 {ok:true}", ok, `status ${r.status}`);
  } catch (e) {
    record("GET /api/health", false, e.message);
  }

  // 2) Health profundo (agente loopback + sidecars)
  try {
    const r = await req("/api/health?deep=1");
    const ok = r.status === 200;
    record("GET /api/health?deep=1 = 200", ok, `status ${r.status}`);
    if (ok) {
      let j = {};
      try { j = JSON.parse(r.body); } catch {}
      const agentUp = !!j?.agent?.reachable;
      record("  agente loopback alcançável", agentUp, agentUp ? "" : "agente não respondeu no /health", { hard: false });
      if (j?.sidecars?.memory) {
        record("  ai-memory", !!j.sidecars.memory.reachable, j.sidecars.memory.reachable ? "" : "configure AI_MEMORY_URL", { hard: false });
      }
    }
  } catch (e) {
    record("GET /api/health?deep=1", false, e.message, { hard: false });
  }

  // 3) Página de login serve HTML (não RSC cru — regressão do edge cache do Railway)
  try {
    const r = await req("/entrar");
    const isHtml = r.ct.includes("text/html") && /<!DOCTYPE html>/i.test(r.body);
    record("GET /entrar = HTML", r.status === 200 && isHtml, `status ${r.status}, ct ${r.ct.split(";")[0]}`);
  } catch (e) {
    record("GET /entrar", false, e.message);
  }

  // 4) /chat protegido (sem cookie deve barrar — prova que o guard está ativo)
  try {
    const r = await req("/chat");
    const blocked = r.status === 401 || (r.status >= 300 && r.status < 400);
    record("GET /chat sem sessão = bloqueado", blocked, `status ${r.status}`);
  } catch (e) {
    record("GET /chat", false, e.message);
  }

  // Resumo
  const hardFails = results.filter((r) => !r.pass && r.hard);
  const softFails = results.filter((r) => !r.pass && !r.hard);
  console.log(`\n${hardFails.length ? "❌" : "✅"} ${results.length - hardFails.length - softFails.length}/${results.length} ok` +
    (softFails.length ? ` · ${softFails.length} aviso(s)` : "") +
    (hardFails.length ? ` · ${hardFails.length} falha(s) dura(s)` : ""));

  process.exit(hardFails.length ? 1 : 0);
}

main().catch((e) => {
  console.error("Erro inesperado:", e);
  process.exit(2);
});
