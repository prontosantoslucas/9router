// Automações criadas por conversa. Cada linha:
//
//   trigger  → algum evento externo (email chegou, hora bateu, alerta linkedin)
//   condition? → filtro opcional (query Gmail, regex, LLM classifier futuro)
//   action   → o que fazer (mandar msg em canal, chamar tool, disparar prompt)
//
// Persiste em SQLite. Um único poller a cada POLL_INTERVAL_MS itera as
// automações ativas, checa gatilho, executa ação.
//
// Tipos de trigger suportados hoje:
//   - 'schedule': config = { repeat_seconds, first_at? }
//   - 'gmail_new': config = { query, poll_seconds? } — reusa searchEmails
//
// Tipos de action suportados:
//   - 'send_message': config = { chat_id, template } — envia via channelSender
//   - 'run_tool': config = { tool_name, args_template } — chama runTool
//   - 'process_message': config = { chat_id, prompt_template } — dispara
//     processMessage (LLM decide o resto)
//
// Templates aceitam placeholders: {{trigger.from}}, {{trigger.subject}},
// {{trigger.snippet}}, {{trigger.date}} — substituídos no runtime.

const crypto = require("node:crypto");
const db = require("./db");
const channelSender = require("./channelSender");

const POLL_INTERVAL_MS = 60 * 1000;
const MAX_MATCHES_PER_TICK = 5;   // por automação, por tick — anti-flood

db.exec(`
  CREATE TABLE IF NOT EXISTS automations (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    label TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    trigger_config TEXT NOT NULL,
    action_type TEXT NOT NULL,
    action_config TEXT NOT NULL,
    condition_config TEXT,
    last_run INTEGER NOT NULL DEFAULT 0,
    last_state TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    error_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS auto_enabled ON automations (enabled, trigger_type);
`);

// ── CRUD ────────────────────────────────────────────────────────────────

function createAutomation({ chatId, label, trigger, action, condition = null }) {
  if (!chatId) throw new Error("chatId obrigatório");
  if (!label) throw new Error("label obrigatório");
  if (!trigger?.type || !trigger?.config) throw new Error("trigger inválido");
  if (!action?.type || !action?.config) throw new Error("action inválida");

  const validTriggers = ["schedule", "gmail_new"];
  if (!validTriggers.includes(trigger.type)) {
    throw new Error(`trigger.type inválido: ${trigger.type}. Aceita: ${validTriggers.join(", ")}`);
  }
  const validActions = ["send_message", "run_tool", "process_message"];
  if (!validActions.includes(action.type)) {
    throw new Error(`action.type inválido: ${action.type}. Aceita: ${validActions.join(", ")}`);
  }

  const id = crypto.randomBytes(6).toString("hex");
  db.prepare(
    `INSERT INTO automations
     (id, chat_id, label, trigger_type, trigger_config, action_type, action_config, condition_config)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, String(chatId), label,
    trigger.type, JSON.stringify(trigger.config),
    action.type, JSON.stringify(action.config),
    condition ? JSON.stringify(condition) : null
  );
  return { id, chatId, label, trigger, action, condition };
}

function listAutomations(chatId) {
  const rows = db.prepare(
    `SELECT * FROM automations WHERE chat_id = ? ORDER BY created_at DESC`
  ).all(String(chatId));
  return rows.map(rowToObj);
}

function cancelAutomation(id) {
  return db.prepare(`UPDATE automations SET enabled = 0 WHERE id = ?`).run(id).changes > 0;
}

function rowToObj(r) {
  return {
    id: r.id,
    chat_id: r.chat_id,
    label: r.label,
    trigger: { type: r.trigger_type, config: JSON.parse(r.trigger_config) },
    action: { type: r.action_type, config: JSON.parse(r.action_config) },
    condition: r.condition_config ? JSON.parse(r.condition_config) : null,
    last_run: r.last_run ? new Date(r.last_run).toISOString() : null,
    last_state: r.last_state ? JSON.parse(r.last_state) : null,
    enabled: !!r.enabled,
    error_count: r.error_count,
    last_error: r.last_error,
  };
}

// ── Template rendering ───────────────────────────────────────────────────

function render(template, ctx) {
  if (typeof template !== "string") return template;
  return template.replace(/\{\{\s*trigger\.(\w+)\s*\}\}/g, (_, key) => {
    const v = ctx?.[key];
    return v == null ? "" : String(v);
  });
}

// ── Trigger checkers ─────────────────────────────────────────────────────

async function checkScheduleTrigger(auto) {
  const cfg = auto.trigger.config;
  const rep = parseInt(cfg.repeat_seconds) || 0;
  if (!rep) return [];
  const nextDue = auto.last_run
    ? new Date(auto.last_run).getTime() + rep * 1000
    : (cfg.first_at ? new Date(cfg.first_at).getTime() : Date.now());
  if (nextDue > Date.now()) return [];
  return [{ ts: Date.now() }];
}

async function checkGmailNewTrigger(auto) {
  let gmail;
  try { gmail = require("./google/gmail"); }
  catch { return []; }

  const oauth = require("./google/oauth");
  if (!oauth?.isAuthorized?.()) return [];

  const cfg = auto.trigger.config;
  const lastRunSecs = auto.last_run ? Math.floor(auto.last_run / 1000) : 0;
  // Query padrão: unread + newer_than pra não repetir. Concatena com filtro do user.
  const userQuery = cfg.query || "";
  const timeFilter = lastRunSecs ? `after:${lastRunSecs}` : "newer_than:5m";
  const fullQuery = [userQuery, timeFilter].filter(Boolean).join(" ");

  try {
    const items = await gmail.searchEmails(fullQuery, MAX_MATCHES_PER_TICK);
    return (items || []).map((m) => ({
      from: m.from || m.sender || "",
      subject: m.subject || "(sem assunto)",
      snippet: m.snippet || "",
      date: m.date || m.receivedAt || "",
      id: m.id || m.messageId,
    }));
  } catch (e) {
    console.warn(`[automations] gmail_new trigger falhou (${auto.id}): ${e.message}`);
    return [];
  }
}

// ── Action executors ─────────────────────────────────────────────────────

async function execSendMessage(cfg, ctx) {
  const chatId = cfg.chat_id;
  const text = render(cfg.template || "{{trigger.subject}}", ctx);
  return channelSender.send(chatId, text);
}

async function execRunTool(cfg, ctx, autoChatId) {
  const { runTool } = require("./tools");
  const toolName = cfg.tool_name;
  const args = {};
  for (const [k, v] of Object.entries(cfg.args_template || {})) {
    args[k] = render(v, ctx);
  }
  const result = await runTool(toolName, args, { chatId: autoChatId });
  return { ok: true, result };
}

async function execProcessMessage(cfg, ctx) {
  const { processMessage } = require("./orchestrator");
  const chatId = cfg.chat_id;
  const prompt = render(cfg.prompt_template || "{{trigger.subject}}", ctx);
  const res = await processMessage(chatId, prompt, "Automation");
  if (res?.content) await channelSender.send(chatId, res.content);
  return { ok: true };
}

async function runAction(auto, ctx) {
  const { type, config } = auto.action;
  if (type === "send_message") return execSendMessage(config, ctx);
  if (type === "run_tool") return execRunTool(config, ctx, auto.chat_id);
  if (type === "process_message") return execProcessMessage(config, ctx);
  return { ok: false, error: `action type desconhecida: ${type}` };
}

// ── Engine ───────────────────────────────────────────────────────────────

async function tick() {
  const rows = db.prepare(
    `SELECT * FROM automations WHERE enabled = 1 AND error_count < 10`
  ).all();

  for (const r of rows) {
    const auto = rowToObj(r);
    let matches = [];
    try {
      if (auto.trigger.type === "schedule") matches = await checkScheduleTrigger(auto);
      else if (auto.trigger.type === "gmail_new") matches = await checkGmailNewTrigger(auto);
    } catch (e) {
      db.prepare(`UPDATE automations SET error_count = error_count + 1, last_error = ? WHERE id = ?`)
        .run(e.message, auto.id);
      continue;
    }

    if (!matches.length) continue;

    let executed = 0;
    for (const ctx of matches.slice(0, MAX_MATCHES_PER_TICK)) {
      try {
        const res = await runAction(auto, ctx);
        if (res.ok !== false) executed++;
      } catch (e) {
        db.prepare(`UPDATE automations SET error_count = error_count + 1, last_error = ? WHERE id = ?`)
          .run(e.message, auto.id);
      }
    }

    db.prepare(
      `UPDATE automations SET last_run = ?, last_state = ?, error_count = 0, last_error = NULL WHERE id = ?`
    ).run(Date.now(), JSON.stringify({ matches: matches.length, executed }), auto.id);
  }
}

let timer = null;
let inFlight = false;
function start() {
  if (timer) return;
  timer = setInterval(() => {
    if (inFlight) return; // guarda re-entrância
    inFlight = true;
    tick().catch((e) => console.error("[automations] tick error:", e.message))
      .finally(() => { inFlight = false; });
  }, POLL_INTERVAL_MS);
  console.log(`[automations] iniciado (poll a cada ${POLL_INTERVAL_MS / 1000}s)`);
}

function stop() { if (timer) { clearInterval(timer); timer = null; } }

// Runner manual (para testar)
async function runNow(id) {
  const r = db.prepare(`SELECT * FROM automations WHERE id = ?`).get(id);
  if (!r) throw new Error(`automation ${id} não encontrada`);
  const auto = rowToObj(r);
  const matches = auto.trigger.type === "schedule"
    ? await checkScheduleTrigger(auto)
    : await checkGmailNewTrigger(auto);
  if (!matches.length) return { matches: 0, executed: 0 };
  let executed = 0;
  for (const ctx of matches) {
    const res = await runAction(auto, ctx);
    if (res.ok !== false) executed++;
  }
  db.prepare(`UPDATE automations SET last_run = ? WHERE id = ?`).run(Date.now(), id);
  return { matches: matches.length, executed };
}

module.exports = {
  createAutomation,
  listAutomations,
  cancelAutomation,
  runNow,
  start,
  stop,
  tick,
};
