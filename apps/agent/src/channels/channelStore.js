// Buffer de mensagens recebidas de Telegram/WhatsApp (conta pessoal).
// Permite ao agente do webchat LER, RESUMIR, BUSCAR e responder conversas sob comando.
const db = require("../db");

db.exec(`
  CREATE TABLE IF NOT EXISTS channel_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL,          -- 'telegram' | 'whatsapp'
    chat_id TEXT NOT NULL,          -- id interno da conversa (peer/grupo)
    chat_name TEXT,                 -- nome amigável do chat/grupo
    sender_name TEXT,               -- quem escreveu
    is_group INTEGER NOT NULL DEFAULT 0,
    text TEXT NOT NULL,
    reply_target TEXT,              -- alvo para responder (JID/peer)
    direction TEXT NOT NULL DEFAULT 'in',  -- 'in' recebida | 'out' enviada por nós
    notified INTEGER NOT NULL DEFAULT 0,   -- já avisado no webchat?
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_chmsg_chat ON channel_messages(channel, chat_id);
  CREATE INDEX IF NOT EXISTS idx_chmsg_notified ON channel_messages(notified);
`);

function record(msg) {
  const stmt = db.prepare(`
    INSERT INTO channel_messages (channel, chat_id, chat_name, sender_name, is_group, text, reply_target, direction)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    msg.channel,
    String(msg.chatId),
    msg.chatName || null,
    msg.senderName || null,
    msg.isGroup ? 1 : 0,
    msg.text,
    msg.replyTarget || null,
    msg.direction || "in"
  );
  return info.lastInsertRowid;
}

function recent({ channel, chatId, limit = 20 } = {}) {
  let sql = "SELECT * FROM channel_messages WHERE 1=1";
  const params = [];
  if (channel) { sql += " AND channel = ?"; params.push(channel); }
  if (chatId) { sql += " AND chat_id = ?"; params.push(String(chatId)); }
  sql += " ORDER BY id DESC LIMIT ?";
  params.push(Math.min(200, Number(limit) || 20));
  return db.prepare(sql).all(...params).reverse();
}

function search(query, { channel, limit = 20 } = {}) {
  let sql = "SELECT * FROM channel_messages WHERE text LIKE ?";
  const params = [`%${query}%`];
  if (channel) { sql += " AND channel = ?"; params.push(channel); }
  sql += " ORDER BY id DESC LIMIT ?";
  params.push(Math.min(100, Number(limit) || 20));
  return db.prepare(sql).all(...params);
}

// Lista conversas distintas com a última mensagem e contagem recente.
function listChats({ channel, limit = 30 } = {}) {
  let sql = `
    SELECT channel, chat_id, chat_name, is_group,
           MAX(created_at) as last_at,
           COUNT(*) as msg_count
    FROM channel_messages
  `;
  const params = [];
  if (channel) { sql += " WHERE channel = ?"; params.push(channel); }
  sql += " GROUP BY channel, chat_id ORDER BY last_at DESC LIMIT ?";
  params.push(Math.min(100, Number(limit) || 30));
  return db.prepare(sql).all(...params);
}

// Localiza um chat por nome parcial (para o usuário dizer "grupo X" em vez do id).
function findChatByName(name, { channel } = {}) {
  let sql = "SELECT DISTINCT channel, chat_id, chat_name, is_group, reply_target FROM channel_messages WHERE chat_name LIKE ?";
  const params = [`%${name}%`];
  if (channel) { sql += " AND channel = ?"; params.push(channel); }
  sql += " ORDER BY created_at DESC LIMIT 5";
  return db.prepare(sql).all(...params);
}

// Notificações pendentes (mensagens recebidas ainda não avisadas no webchat)
function pendingNotifications(limit = 20) {
  return db.prepare(
    "SELECT * FROM channel_messages WHERE direction = 'in' AND notified = 0 ORDER BY id ASC LIMIT ?"
  ).all(Math.min(50, limit));
}

function markNotified(ids = []) {
  if (!ids.length) return;
  const placeholders = ids.map(() => "?").join(",");
  db.prepare(`UPDATE channel_messages SET notified = 1 WHERE id IN (${placeholders})`).run(...ids);
}

module.exports = { record, recent, search, listChats, findChatByName, pendingNotifications, markNotified };
