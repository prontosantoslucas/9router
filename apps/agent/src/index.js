require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cfg = require("./config");
const { PORT, SIDECAR_ENABLED, setBaseUrl } = cfg;
const keyrotator = require("./keyrotator");
const models = require("./models");
const proxy = require("./proxy");
const { createBot } = require("./telegram");
const superbrain = require("./superbrain");
const scheduler = require("./scheduler");
const farejador = require("./farejador");
const fileproc = require("./fileproc");
const imagine = require("./imagine");
const metrics = require("./metrics");
const { processMessage, clearHistory, isMuted } = require("./orchestrator");
const { createHmacMiddleware, resolveInternalSecret } = require("./hmacAuth");
const copilotController = require("./copilot/copilotController");
const personalityPoller = require("./personality/personalityPoller");
const userbotAuth = require("./channels/telegram/userbotAuth");
const aiMemoryClient = require("./memory/aiMemoryClient");
const evolutionWebhook = require("./channels/evolution/webhookParser");

// ────────────────────────────────────────────────────────────────
// Lazy loader dos módulos Google — evita crash de boot se `googleapis`
// não estiver instalado (só falha quando um endpoint Google é chamado).
// ────────────────────────────────────────────────────────────────
function safeRequire(modulePath) {
  return function () {
    try {
      return require(modulePath);
    } catch (err) {
      const hint =
        modulePath.startsWith("./google")
          ? "Rode `npm install` em apps/agent/ para pegar googleapis + google-auth-library."
          : `Módulo ${modulePath} indisponível: ${err.message}`;
      const wrapErr = new Error(`[LazyRequire] ${hint} (root cause: ${err.message})`);
      wrapErr.code = "MODULE_UNAVAILABLE";
      throw wrapErr;
    }
  };
}
const lazyGoogleOauth = safeRequire("./google/oauth");
const lazyGmail = safeRequire("./google/gmail");
const lazyCalendar = safeRequire("./google/calendar");
const lazyDriveDocs = safeRequire("./google/driveDocs");

function withGoogle(lazyFn, res, handler) {
  return async (req) => {
    try {
      const mod = lazyFn();
      return await handler(mod);
    } catch (err) {
      const status = err.code === "MODULE_UNAVAILABLE" ? 503 : 500;
      return res.status(status).json({ error: err.message });
    }
  };
}

// Resolve o segredo HMAC — env var, ou arquivo persistido, ou gera+persiste.
// Mesmo padrão do JWT_SECRET do maxrouter. NÃO aborta se env faltar.
const { secret: AGENT_INTERNAL_SECRET, source: secretSource, file: secretFile } =
  resolveInternalSecret({ dataDir: process.env.DATA_DIR });
if (secretSource === "generated") {
  console.log(`[SEC] AGENT_INTERNAL_SECRET gerado automaticamente e persistido em ${secretFile}`);
} else if (secretSource === "file") {
  console.log("[SEC] AGENT_INTERNAL_SECRET carregado do arquivo persistido");
} else if (secretSource === "env") {
  console.log("[SEC] AGENT_INTERNAL_SECRET configurado via variável de ambiente");
} else {
  console.warn("[SEC] AGENT_INTERNAL_SECRET só em memória — instâncias paralelas terão HMAC divergente");
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));

// Middleware HMAC — todas as chamadas do proxy do Maxrouter passam assinadas.
// Bypass: /health (probes) e /api/webhook/evolution (webhook público da Evolution API).
// IMPORTANTE: o proxy do Next remove o prefixo `/api/agent/` — o agente ouve em `/api/...`
app.use(
  createHmacMiddleware({
    secret: AGENT_INTERNAL_SECRET,
    skipPrefixes: ["/health", "/api/webhook/evolution", "/api/google/callback"],
  })
);

const VALID_KEYS = new Set(keyrotator.getAllKeys());

// Auth opcional para rotas que aceitam API key além do HMAC do proxy.
// Chave hardcoded histórica foi removida (2026-07-22, sessão de segurança).
function auth(req, res, next) {
  const key = req.headers.authorization?.replace("Bearer ", "");
  if (key && !VALID_KEYS.has(key)) {
    return res.status(401).json({ error: "Invalid API key" });
  }
  next();
}

// Rotas /v1/* removidas do agente — o namespace /v1/* é mantido 100% pelo Maxrouter Next.js.

// GET /send — webhook GET → Telegram (pra web_fetch que só faz GET)
app.get("/send", async (req, res) => {
  const { text, chat_id } = req.query;
  if (!text || !chat_id) return res.status(400).json({ error: "text and chat_id required" });
  const token = require("./config").BOT_TOKEN;
  if (!token) return res.status(400).json({ error: "BOT_TOKEN not configured" });
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: Number(chat_id), text, parse_mode: "Markdown" }),
    });
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get("/health", (req, res) => {
  const status = models.getStatus();
  res.json({ status: "ok", models: status });
});

app.get("/schedule", (req, res) => {
  res.json(scheduler.list());
});

app.get("/cache", (req, res) => {
  res.json(require("./cache").stats());
});

app.get("/api/stats", (req, res) => {
  const models = require("./models");
  const cache = require("./cache");
  const sb = require("./superbrain");
  const { AGENT_LIST } = require("./agents");
  res.json({
    models: models.getStatus(),
    cache: cache.stats(),
    metrics: metrics.getStats(),
    schedule: scheduler.list(),
    superbrain: { length: sb.getContent().length },
    agents: AGENT_LIST.map((a) => ({
      id: a.id, name: a.name, emoji: a.emoji, desc: a.desc,
      muted: require("./orchestrator").isMuted(a.id),
    })),
    sessionCount: require("./orchestrator").getHistorySize?.() ?? 0,
    keys: { total: keyrotator.getKeyCount(), exhausted: keyrotator.getExhaustedCount() },
  });
});

app.post("/sync-superbrain", async (req, res) => {
  const ok = await superbrain.refreshFromGitHub();
  res.json({ synced: ok, length: superbrain.getContent().length });
});

app.post("/api/chat", async (req, res) => {
  const { message, userName } = req.body;
  if (!message) return res.status(400).json({ error: "message required" });
  const chatId = req.body.chatId || "web:default";
  const name = userName || "Você";
  const ghToken = req.body.githubToken || "";
  try {
    const result = await processMessage(chatId, message, name, { githubToken: ghToken });
    if (result.formatted) delete result.formatted;
    if (result.image && result.image.startsWith("/")) {
      const proto = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      result.image = `${proto}://${host}${result.image}`;
    }
    res.json(result);
  } catch (err) {
    console.error("[/api/chat] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/chat/new", (req, res) => {
  const chatId = req.body.chatId || "web:default";
  clearHistory(chatId);
  res.json({ ok: true });
});

app.post("/api/upload", async (req, res) => {
  const { base64, mimeType, filename } = req.body;
  if (!base64 || !filename) return res.status(400).json({ error: "base64 e filename são obrigatórios" });
  try {
    const text = await fileproc.processFile(base64, mimeType || "", filename);
    res.json({ text, filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/imagine", async (req, res) => {
  const { prompt, model } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt required" });
  try {
    const result = await imagine.generate(prompt, model);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/imagine/models", (req, res) => {
  res.json(imagine.listModels());
});

app.get("/api/image/:id", (req, res) => {
  imagine.serveImage(req.params.id, req, res);
});

app.post("/api/notion/save", async (req, res) => {
  if (!require("./notion").isConfigured()) return res.status(400).json({ error: "Notion não configurado" });
  const { title, content, tags, source } = req.body;
  if (!title || !content) return res.status(400).json({ error: "title e content obrigatórios" });
  const r = await require("./notion").createPage(title, content, tags || [], source || "web");
  res.json(r);
});

app.get("/api/notion/search", async (req, res) => {
  if (!require("./notion").isConfigured()) return res.status(400).json({ error: "Notion não configurado" });
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "Parâmetro q obrigatório" });
  const r = await require("./notion").searchPages(q);
  res.json(r);
});

app.get("/api/notion/list", async (req, res) => {
  if (!require("./notion").isConfigured()) return res.status(400).json({ error: "Notion não configurado" });
  const r = await require("./notion").queryDatabase({}, [{ property: "Criado", direction: "descending" }]);
  res.json(r);
});

// ════════════════════════════════════════════════════════════════
// IMPORTANTE: TODAS as rotas abaixo usam `/api/<...>` (SEM `/agent/`)
// porque o proxy do Next remove o prefixo `/api/agent/` ao encaminhar.
// Frontend chama `/api/agent/copilot/approvals` → chega aqui como `/api/copilot/approvals`.
// ════════════════════════════════════════════════════════════════

// ── Copilot (fila de aprovação de rascunhos WhatsApp/Telegram) ──
app.get("/api/copilot/approvals", copilotController.listApprovals);
app.post("/api/copilot/approve", copilotController.approveDraft);
app.post("/api/copilot/reject", copilotController.rejectDraft);

// ── Personality sync (puxa Markdown do GitHub e cacheia local) ──
app.post("/api/personality/github", async (req, res) => {
  try {
    const { url, token } = req.body || {};
    const updated = await personalityPoller.syncNow(url, token);
    res.json({ ok: true, length: updated.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Telegram Userbot (MTProto) — status + placeholders 501 ──
app.get("/api/telegram/userbot/status", (req, res) => {
  const session = userbotAuth.getSavedSession();
  const configured = !!(cfg.TELEGRAM_API_ID && cfg.TELEGRAM_API_HASH);
  res.json({
    configured,
    hasSession: !!session,
    apiIdSet: !!cfg.TELEGRAM_API_ID,
    apiHashSet: !!cfg.TELEGRAM_API_HASH,
  });
});

app.post("/api/telegram/userbot/start-auth", (req, res) => {
  const { phoneNumber } = req.body || {};
  if (!phoneNumber) return res.status(400).json({ error: "phoneNumber obrigatório" });
  res.status(501).json({
    error: "MTProto start-auth ainda não implementado. Configure BOT_TOKEN para usar o Bot API padrão.",
  });
});
app.post("/api/telegram/userbot/complete-auth", (req, res) => {
  res.status(501).json({ error: "MTProto complete-auth ainda não implementado." });
});

// ── Memória (ai-memory MCP) ──
app.get("/api/memory/status", async (req, res) => {
  const ping = await aiMemoryClient.ping();
  res.json({ ...ping, baseUrl: cfg.AI_MEMORY_URL || null });
});

// ── Webhook Evolution API (WhatsApp) & Instância QR Code ──
const qrCodeService = require("./channels/evolution/qrCodeService");

app.all(["/api/evolution/instance", "/api/agent/evolution/instance"], async (req, res) => {
  try {
    const data = await qrCodeService.getQrCode();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/webhook/evolution", async (req, res) => {
  const providedKey = req.headers["apikey"] || req.headers["x-api-key"];
  if (cfg.EVOLUTION_API_KEY && providedKey !== cfg.EVOLUTION_API_KEY) {
    return res.status(401).json({ error: "apikey inválido" });
  }
  const parsed = evolutionWebhook.parseWebhook(req.body);
  if (!parsed) return res.json({ ok: true, ignored: true });
  res.json({ ok: true, received: parsed.messageId });
  try {
    const chatId = `wa:${parsed.senderNumber}`;
    await processMessage(chatId, parsed.messageText, parsed.pushName, { channel: "whatsapp" });
  } catch (err) {
    console.error("[EvolutionWebhook] Erro ao processar:", err.message);
  }
});

// ── Health agregado dos sidecars (agente + ai-memory + google config) ──
app.get("/api/status/sidecars", async (req, res) => {
  const google = {
    configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    hasRefreshToken: !!process.env.GOOGLE_REFRESH_TOKEN,
  };
  const memoryBase = cfg.AI_MEMORY_URL;
  let memory = { configured: !!memoryBase, reachable: false, baseUrl: memoryBase || null };
  if (memoryBase) {
    const ping = await aiMemoryClient.ping();
    memory = { ...memory, ...ping };
  }
  const workers = {
    scheduler: scheduler.list().length,
    telegramBot: !!cfg.BOT_TOKEN,
    workersEnabled: process.env.AGENT_WORKERS !== "0" && process.env.AGENT_WORKERS !== "false",
  };
  res.json({
    agent: { ok: true, port: PORT, uptime: process.uptime() },
    memory,
    google,
    workers,
    channels: {
      whatsapp: !!cfg.EVOLUTION_API_URL,
      telegramUserbot: !!userbotAuth.getSavedSession(),
    },
  });
});

// ────────────────────────────────────────────────────────────────
// Google Workspace — OAuth + Gmail + Calendar + Drive/Docs + Chat
// Todas as chamadas usam lazy require via safeRequire — se `googleapis`
// não estiver instalado, endpoints devolvem 503 sem crashar o processo.
// ────────────────────────────────────────────────────────────────

app.get("/api/google/status", (req, res) => {
  try {
    const googleOauth = lazyGoogleOauth();
    const configured = googleOauth.isConfigured();
    const authorized = configured && googleOauth.isAuthorized();
    const tokens = authorized ? googleOauth.loadTokens() : null;
    res.json({
      configured,
      authorized,
      email: tokens?.email || null,
      scopes: googleOauth.SCOPES,
      redirectUri: cfg.GOOGLE_REDIRECT_URI || null,
    });
  } catch (err) {
    const status = err.code === "MODULE_UNAVAILABLE" ? 503 : 500;
    res.status(status).json({ error: err.message, configured: false, authorized: false });
  }
});

app.get("/api/google/auth-url", (req, res) => {
  try {
    const googleOauth = lazyGoogleOauth();
    const { redirectAfter } = req.query;
    const { url } = googleOauth.getAuthUrl({ redirectAfter });
    res.json({ url });
  } catch (err) {
    const status = err.code === "MODULE_UNAVAILABLE" ? 503 : 400;
    res.status(status).json({ error: err.message });
  }
});

app.get("/api/google/callback", async (req, res) => {
  try {
    const googleOauth = lazyGoogleOauth();
    const { code, state, error } = req.query;
    if (error) return res.status(400).send(`OAuth Google recusado: ${error}`);
    const result = await googleOauth.handleCallback(code, state);
    if (!result.ok) return res.status(400).send(`Falha OAuth Google: ${result.error}`);
    const target = result.redirectAfter || "/dashboard2?google=connected";
    res.redirect(target);
  } catch (err) {
    console.error("[GoogleCallback] Erro:", err.message);
    res.status(500).send(`Erro no callback: ${err.message}`);
  }
});

app.post("/api/google/disconnect", (req, res) => {
  try {
    lazyGoogleOauth().disconnect();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Gmail ──
app.get("/api/google/gmail/priority", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 5;
    res.json({ emails: await lazyGmail().listPriorityEmails(limit) });
  } catch (err) { res.status(err.code === "MODULE_UNAVAILABLE" ? 503 : 500).json({ error: err.message }); }
});
app.get("/api/google/gmail/search", async (req, res) => {
  try {
    const q = req.query.q || "";
    const limit = Number(req.query.limit) || 20;
    if (!q) return res.status(400).json({ error: "q obrigatório" });
    res.json({ emails: await lazyGmail().searchEmails(q, limit) });
  } catch (err) { res.status(err.code === "MODULE_UNAVAILABLE" ? 503 : 500).json({ error: err.message }); }
});
app.get("/api/google/gmail/:id", async (req, res) => {
  try { res.json(await lazyGmail().getEmailBody(req.params.id)); }
  catch (err) { res.status(err.code === "MODULE_UNAVAILABLE" ? 503 : 500).json({ error: err.message }); }
});
app.post("/api/google/gmail/send", async (req, res) => {
  try {
    const { to, subject, body, cc, bcc, replyTo } = req.body || {};
    if (!to) return res.status(400).json({ error: "to obrigatório" });
    res.json(await lazyGmail().sendEmail(to, subject, body, { cc, bcc, replyTo }));
  } catch (err) { res.status(err.code === "MODULE_UNAVAILABLE" ? 503 : 500).json({ error: err.message }); }
});

// ── Calendar ──
app.get("/api/google/calendar/today", async (req, res) => {
  try { res.json({ events: await lazyCalendar().listTodayEvents() }); }
  catch (err) { res.status(err.code === "MODULE_UNAVAILABLE" ? 503 : 500).json({ error: err.message }); }
});
app.get("/api/google/calendar/events", async (req, res) => {
  try { res.json({ events: await lazyCalendar().listEvents(req.query) }); }
  catch (err) { res.status(err.code === "MODULE_UNAVAILABLE" ? 503 : 500).json({ error: err.message }); }
});
app.post("/api/google/calendar/events", async (req, res) => {
  try { res.json({ event: await lazyCalendar().createEvent(req.body || {}) }); }
  catch (err) { res.status(err.code === "MODULE_UNAVAILABLE" ? 503 : 400).json({ error: err.message }); }
});
app.patch("/api/google/calendar/events/:id", async (req, res) => {
  try { res.json({ event: await lazyCalendar().updateEvent(req.params.id, req.body || {}) }); }
  catch (err) { res.status(err.code === "MODULE_UNAVAILABLE" ? 503 : 400).json({ error: err.message }); }
});
app.delete("/api/google/calendar/events/:id", async (req, res) => {
  try { res.json(await lazyCalendar().deleteEvent(req.params.id)); }
  catch (err) { res.status(err.code === "MODULE_UNAVAILABLE" ? 503 : 500).json({ error: err.message }); }
});
app.post("/api/google/calendar/suggest", async (req, res) => {
  try { res.json({ slot: await lazyCalendar().suggestFirstFreeSlot(req.body || {}) }); }
  catch (err) { res.status(err.code === "MODULE_UNAVAILABLE" ? 503 : 400).json({ error: err.message }); }
});

// ── Drive + Docs + Chat ──
app.get("/api/google/drive/files", async (req, res) => {
  try { res.json(await lazyDriveDocs().listFiles(req.query)); }
  catch (err) { res.status(err.code === "MODULE_UNAVAILABLE" ? 503 : 500).json({ error: err.message }); }
});
app.post("/api/google/docs", async (req, res) => {
  try {
    const { title, content } = req.body || {};
    res.json(await lazyDriveDocs().createDocument(title, content || ""));
  } catch (err) { res.status(err.code === "MODULE_UNAVAILABLE" ? 503 : 400).json({ error: err.message }); }
});
app.get("/api/google/docs/:id", async (req, res) => {
  try { res.json(await lazyDriveDocs().readDocument(req.params.id)); }
  catch (err) { res.status(err.code === "MODULE_UNAVAILABLE" ? 503 : 500).json({ error: err.message }); }
});
app.post("/api/google/docs/:id/append", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: "text obrigatório" });
    res.json(await lazyDriveDocs().appendToDocument(req.params.id, text));
  } catch (err) { res.status(err.code === "MODULE_UNAVAILABLE" ? 503 : 400).json({ error: err.message }); }
});
app.get("/api/google/chat/spaces", async (req, res) => {
  try { res.json({ spaces: await lazyDriveDocs().listChatSpaces(req.query) }); }
  catch (err) { res.status(err.code === "MODULE_UNAVAILABLE" ? 503 : 500).json({ error: err.message }); }
});
app.post("/api/google/chat/send", async (req, res) => {
  try {
    const { spaceName, text } = req.body || {};
    if (!spaceName || !text) return res.status(400).json({ error: "spaceName e text obrigatórios" });
    res.json(await lazyDriveDocs().sendChatMessage(spaceName, text));
  } catch (err) { res.status(err.code === "MODULE_UNAVAILABLE" ? 503 : 400).json({ error: err.message }); }
});

// ── Bloqueios 404 explícitos das páginas React (agente é loopback, não serve HTML) ──
app.get("/dashboard2", (req, res) => {
  res.status(404).json({ error: "Not Found — Tela /dashboard2 é servida nativamente pelo Next.js" });
});

app.get("/chat", (req, res) => {
  res.status(404).json({ error: "Not Found — Tela /chat é servida nativamente pelo Next.js" });
});

app.get("/", (req, res) => {
  res.status(404).json({ error: "Not Found — Agente Lucas rodando em modo loopback interno" });
});

// Error handler global — sempre JSON, nunca HTML
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res.status(400).json({ error: "JSON inválido no corpo da requisição" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Arquivo muito grande. Máximo: 50MB (arquivo original)." });
  }
  console.error("[Express Error]", err.message);
  res.status(err.status || 500).json({ error: err.message || "Erro interno" });
});

// 404 handler para qualquer rota não mapeada
app.use((req, res) => {
  res.status(404).json({ error: `Rota ${req.method} ${req.path} não encontrada no agente` });
});

async function start() {
  // Sobe o HTTP server PRIMEIRO — não bloquear o listen em init de rede.
  // Antes, `await models.init()` (que dá "Connection error" e faz retry) atrasava
  // o app.listen, e o proxy do Next batia em 3717 antes do agente aceitar conexão
  // → "fetch failed" no chat. Agora o servidor aceita conexões imediatamente e
  // models.init() roda em background.
  const server = app.listen(PORT, "127.0.0.1", () => {
    console.log(`
╔══════════════════════════════════════════╗
║        Agente Lucas (Loopback)           ║
║──────────────────────────────────────────║
║  Host:    http://127.0.0.1:${PORT}        ║
║  Status:  Isolado em rede privada        ║
╚══════════════════════════════════════════╝
    `);
  });
  server.on("error", (err) => {
    console.error("[FATAL] Falha ao abrir porta do agente:", err.message);
    process.exit(1);
  });

  // Inicializa modelos em background (não bloqueia o listen)
  models.init()
    .then(() => {
      const status = models.getStatus();
      console.log(`Modelos: ${status.available}/${status.total} disponíveis`);
    })
    .catch((err) => console.error("[Models] init falhou (não-fatal):", err.message));

  const tgBot = createBot();
  if (tgBot) {
    tgBot.launch().catch((err) => {
      console.error("[Telegram] Erro no launch:", err.message);
      console.log("[Telegram] Bot desativado — servidor continua rodando.");
    });
  }

  // Auto-sync Superbrain: 1min após start, depois a cada 6h
  setTimeout(() => superbrain.refreshFromGitHub(), 60000);
  setInterval(() => superbrain.refreshFromGitHub(), 6 * 60 * 60 * 1000);

  // Workers (Farejador e Scheduler) são iniciados apenas se AGENT_WORKERS estiver ativado (default: 1)
  const enableWorkers = process.env.AGENT_WORKERS !== "0" && process.env.AGENT_WORKERS !== "false";
  if (enableWorkers) {
    console.log("[Workers] Inicializando farejador e scheduler...");
    farejador.start(async (chatId, msg) => {
      console.log(`[Farejador] Notificando ${chatId}`);
      if (tgBot) {
        await tgBot.telegram.sendMessage(chatId, msg, { parse_mode: "Markdown" }).catch(() => {});
      }
    });

    scheduler.start(async (task) => {
      console.log(`[Scheduler] Executando: ${task.label} (chatId: ${task.meta?.chatId || "none"})`);
      const chatId = task.meta?.chatId;
      if (!chatId) return;
      try {
        const result = await processMessage(chatId, task.label, "Scheduler");
        if (tgBot) {
          await tgBot.telegram.sendMessage(chatId, result.content, { parse_mode: "Markdown" }).catch(() => {});
        }
      } catch (err) {
        console.error(`[Scheduler] Erro ao processar tarefa: ${err.message}`);
      }
    });
  } else {
    console.log("[Workers] AGENT_WORKERS desativado nesta instância.");
  }

  console.log(`[Agent] TG Bot: ${tgBot ? "ativo" : "desativado"} · Workers: ${enableWorkers ? "on" : "off"}`);
}

start().catch((err) => {
  console.error("Falha ao iniciar:", err);
  process.exit(1);
});

process.on("SIGINT", () => { require("./sidecar").stop(); process.exit(); });
process.on("SIGTERM", () => { require("./sidecar").stop(); process.exit(); });
