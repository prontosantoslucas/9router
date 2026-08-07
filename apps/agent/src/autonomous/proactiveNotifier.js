// Notificações proativas: sistema que O AGENT usa pra falar sozinho com o
// usuário (sem esperar mensagem). Antes só enfileirava — agora tem CONSUMER
// que dreana a fila e manda pelos canais ativos via channelSender.
//
// Uso típico:
//   const notifier = require("./autonomous/proactiveNotifier");
//   notifier.push({ chatId, body: "olha, vi que...", tag: "insight-diario" });
//   // agent-side background drain envia pelo canal certo (TG/WA/webchat).
//
// A tag serve pra dedup: dispara-uma-vez-por-dia por tag. Se você fizer push
// duas vezes com tag='morning-briefing' no mesmo dia, só a 1ª sai.

const db = require("../db");
const channelSender = require("../channelSender");

const DRAIN_INTERVAL_MS = 60 * 1000; // 1 min
const DEDUP_WINDOW_HOURS = 20; // dispara-1x-por-dia por tag (com folga)

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS proactive_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    body TEXT NOT NULL,
    tag TEXT,
    priority INTEGER NOT NULL DEFAULT 5,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    sent_at INTEGER,
    error TEXT
  );
  CREATE INDEX IF NOT EXISTS pn_unsent ON proactive_notifications (sent_at, priority, created_at);
  CREATE INDEX IF NOT EXISTS pn_tag ON proactive_notifications (tag, sent_at);
`);

function push({ chatId, body, tag = null, priority = 5 }) {
  if (!chatId || !body) throw new Error("chatId e body obrigatorios");

  // Dedup por tag: se enviou nas últimas DEDUP_WINDOW_HOURS, pula
  if (tag) {
    const cutoff = Math.floor((Date.now() - DEDUP_WINDOW_HOURS * 3600 * 1000) / 1000);
    const recent = db.prepare(
      `SELECT id FROM proactive_notifications
       WHERE chat_id = ? AND tag = ? AND sent_at IS NOT NULL AND sent_at > ?`
    ).get(String(chatId), tag, cutoff);
    if (recent) {
      console.log(`[ProactiveNotifier] dedup: tag=${tag} já enviado nas últimas ${DEDUP_WINDOW_HOURS}h`);
      return null;
    }
  }

  const info = db.prepare(
    "INSERT INTO proactive_notifications (chat_id, body, tag, priority) VALUES (?, ?, ?, ?)"
  ).run(String(chatId), body, tag, priority);
  return info.lastInsertRowid;
}

// Drena até MAX_PER_TICK notificações não enviadas. Respeita prioridade.
const MAX_PER_TICK = 10;
async function drain() {
  const rows = db.prepare(
    `SELECT id, chat_id, body FROM proactive_notifications
     WHERE sent_at IS NULL
     ORDER BY priority ASC, created_at ASC
     LIMIT ?`
  ).all(MAX_PER_TICK);
  if (rows.length === 0) return;

  console.log(`[ProactiveNotifier] drenando ${rows.length} notificações pendentes`);
  for (const row of rows) {
    try {
      const res = await channelSender.send(row.chat_id, row.body);
      if (res.ok) {
        db.prepare("UPDATE proactive_notifications SET sent_at = (unixepoch()) WHERE id = ?")
          .run(row.id);
      } else {
        db.prepare("UPDATE proactive_notifications SET error = ? WHERE id = ?")
          .run(res.error || "unknown", row.id);
      }
    } catch (e) {
      db.prepare("UPDATE proactive_notifications SET error = ? WHERE id = ?")
        .run(e.message, row.id);
    }
    await new Promise((r) => setTimeout(r, 500)); // pausa curta entre envios
  }
}

// Getters úteis (frontend / debug)
function pending(chatId) {
  return db.prepare(
    "SELECT id, body, tag, created_at FROM proactive_notifications WHERE chat_id = ? AND sent_at IS NULL ORDER BY created_at DESC"
  ).all(String(chatId));
}

function recent(chatId, limit = 20) {
  return db.prepare(
    "SELECT id, body, tag, created_at, sent_at, error FROM proactive_notifications WHERE chat_id = ? ORDER BY created_at DESC LIMIT ?"
  ).all(String(chatId), limit);
}

let timer = null;
function start() {
  if (timer) return;
  timer = setInterval(() => {
    drain().catch((e) => console.error("[ProactiveNotifier] drain error:", e.message));
  }, DRAIN_INTERVAL_MS);
  drain().catch(() => {});
  console.log(`[ProactiveNotifier] iniciado (drain a cada ${DRAIN_INTERVAL_MS / 1000}s)`);
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

module.exports = {
  push,
  pending,
  recent,
  drain,
  start,
  stop,
  // API antiga preservada (compat com quem já chamava — vira push com dead-chatId)
  sendProactiveNotification: (title, message, channel = "web") => {
    console.warn("[ProactiveNotifier] sendProactiveNotification é legado — use push({chatId, body}) diretamente");
    return { id: Date.now().toString(), title, message, channel, timestamp: Date.now() };
  },
  getUnreadNotifications: () => [],
};
