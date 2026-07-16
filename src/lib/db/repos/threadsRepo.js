import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";

export async function getOrCreateThread(id, title) {
  const db = await getAdapter();
  const existing = db.get(`SELECT * FROM conversations WHERE id = ?`, [id]);
  if (existing) {
    if (title && title !== existing.title) {
      db.run(`UPDATE conversations SET title = ?, updatedAt = ? WHERE id = ?`, [title, new Date().toISOString(), id]);
    }
    return { id: existing.id, title: existing.title, createdAt: existing.createdAt, updatedAt: existing.updatedAt };
  }
  const now = new Date().toISOString();
  db.run(`INSERT INTO conversations(id, title, createdAt, updatedAt) VALUES(?, ?, ?, ?)`, [id, title || null, now, now]);
  return { id, title: title || null, createdAt: now, updatedAt: now };
}

export async function getThreadMessages(conversationId) {
  const db = await getAdapter();
  return db.all(`SELECT id, conversationId, role, content, createdAt FROM conversationMessages WHERE conversationId = ? ORDER BY id ASC`, [conversationId]);
}

export async function addThreadMessage(conversationId, role, content) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  db.run(`INSERT INTO conversationMessages(conversationId, role, content, createdAt) VALUES(?, ?, ?, ?)`, [conversationId, role, content, now]);
  db.run(`UPDATE conversations SET updatedAt = ? WHERE id = ?`, [now, conversationId]);
  return { conversationId, role, content, createdAt: now };
}

export async function addThreadMessages(conversationId, messages) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  db.transaction(() => {
    for (const msg of messages) {
      db.run(`INSERT INTO conversationMessages(conversationId, role, content, createdAt) VALUES(?, ?, ?, ?)`, [conversationId, msg.role, msg.content, now]);
    }
    db.run(`UPDATE conversations SET updatedAt = ? WHERE id = ?`, [now, conversationId]);
  });
}

export async function deleteThread(conversationId) {
  const db = await getAdapter();
  db.transaction(() => {
    db.run(`DELETE FROM conversationMessages WHERE conversationId = ?`, [conversationId]);
    db.run(`DELETE FROM conversations WHERE id = ?`, [conversationId]);
  });
}

export async function listThreads(limit = 50) {
  const db = await getAdapter();
  return db.all(`SELECT id, title, createdAt, updatedAt FROM conversations ORDER BY updatedAt DESC LIMIT ?`, [limit]);
}
