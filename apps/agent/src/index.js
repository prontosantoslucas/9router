require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { PORT, SIDECAR_ENABLED, setBaseUrl } = require("./config");
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

const app = express();
app.use(cors());
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));

const VALID_KEYS = new Set(keyrotator.getAllKeys());

function auth(req, res, next) {
  const key = req.headers.authorization?.replace("Bearer ", "");
  if (key && !VALID_KEYS.has(key) && key !== "sk-ea45f906b3056e8c-1bpca8-c2a94ffa") {
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
    sessionCount: require("./orchestrator").getHistorySize(),
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
  await models.init();

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

  app.listen(PORT, "127.0.0.1", () => {
    console.log(`
╔══════════════════════════════════════════╗
║        Agente Lucas (Loopback)           ║
║──────────────────────────────────────────║
║  Host:    http://127.0.0.1:${PORT}        ║
║  Status:  Isolado em rede privada        ║
║  TG Bot:  ${tgBot ? "✅ Ativo" : "⏹️  Desativado"}                ║
╚══════════════════════════════════════════╝
    `);
    const status = models.getStatus();
    console.log(`Modelos: ${status.available}/${status.total} disponíveis`);
  });
}

start().catch((err) => {
  console.error("Falha ao iniciar:", err);
  process.exit(1);
});

process.on("SIGINT", () => { require("./sidecar").stop(); process.exit(); });
process.on("SIGTERM", () => { require("./sidecar").stop(); process.exit(); });
