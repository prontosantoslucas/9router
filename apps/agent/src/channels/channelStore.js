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

// Conversas para o painel lateral: última mensagem, não lidas e alvo de resposta.
//
// ────────────────────────────────────────────────────────────────
// SÓ CONVERSAS DIRETAS (quando somenteDiretas)
//
// O filtro é DUPLO de propósito: `is_group = 0` E o chat_id sem o prefixo
// `wa-group:`. As duas fontes que gravam aqui (Baileys nativo e webhook da
// Evolution) derivam is_group do JID terminar em @g.us, mas basta uma mensagem
// gravada por um caminho que não preencheu a coluna para um grupo aparecer na
// lista de conversas pessoais. Com os dois critérios, um grupo teria de burlar
// ambos. Também exclui broadcast/status e newsletter, que não são pessoas.
//
// O reply_target vem da mensagem MAIS RECENTE que tenha um: é o JID real para
// onde responder, e sem ele o envio não tem destino.
// ────────────────────────────────────────────────────────────────
function listConversations({ channel = null, somenteDiretas = true, limit = 40 } = {}) {
  const where = ["1=1"];
  const params = [];
  if (channel) { where.push("channel = ?"); params.push(channel); }
  if (somenteDiretas) {
    where.push("is_group = 0");
    where.push("chat_id NOT LIKE 'wa-group:%'");
    where.push("chat_id NOT LIKE '%@g.us%'");
    where.push("chat_id NOT LIKE '%broadcast%'");
    where.push("chat_id NOT LIKE '%@newsletter%'");
  }
  const sql = `
    SELECT
      m.channel,
      m.chat_id,
      MAX(m.created_at) AS last_at,
      COUNT(*) AS msg_count,
      SUM(CASE WHEN m.direction = 'in' AND m.notified = 0 THEN 1 ELSE 0 END) AS nao_lidas,
      (SELECT chat_name FROM channel_messages x
         WHERE x.chat_id = m.chat_id AND x.channel = m.channel AND x.chat_name IS NOT NULL
         ORDER BY x.id DESC LIMIT 1) AS chat_name,
      (SELECT reply_target FROM channel_messages x
         WHERE x.chat_id = m.chat_id AND x.channel = m.channel AND x.reply_target IS NOT NULL
         ORDER BY x.id DESC LIMIT 1) AS reply_target,
      (SELECT text FROM channel_messages x
         WHERE x.chat_id = m.chat_id AND x.channel = m.channel
         ORDER BY x.id DESC LIMIT 1) AS last_text,
      (SELECT direction FROM channel_messages x
         WHERE x.chat_id = m.chat_id AND x.channel = m.channel
         ORDER BY x.id DESC LIMIT 1) AS last_direction
    FROM channel_messages m
    WHERE ${where.join(" AND ")}
    GROUP BY m.channel, m.chat_id
    ORDER BY last_at DESC
    LIMIT ?
  `;
  params.push(Math.min(200, Number(limit) || 40));
  return db.prepare(sql).all(...params);
}

// Marca como lidas as mensagens recebidas de UMA conversa. Separado de
// markNotified porque abrir uma conversa não deve zerar o aviso das outras.
function markChatRead({ channel, chatId }) {
  const info = db.prepare(
    "UPDATE channel_messages SET notified = 1 WHERE channel = ? AND chat_id = ? AND direction = 'in' AND notified = 0"
  ).run(channel, String(chatId));
  return info.changes;
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

module.exports = {
  record, recent, search, listChats, findChatByName,
  pendingNotifications, markNotified,
  listConversations, markChatRead,
};
