import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

fs.mkdirSync(path.dirname(config.paths.db), { recursive: true });

export const db = new Database(config.paths.db);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Rodar schema no boot — idempotente por causa dos IF NOT EXISTS.
const schema = fs.readFileSync(config.paths.schema, "utf8");
db.exec(schema);

// ============================================================
// Conversation helpers
// ============================================================
export function upsertConversation({ chatId, channel, patientName = null }) {
  db.prepare(`
    INSERT INTO conversations (chat_id, channel, patient_name)
    VALUES (@chatId, @channel, @patientName)
    ON CONFLICT(chat_id) DO UPDATE SET last_seen_at = datetime('now')
  `).run({ chatId, channel, patientName });
  return db.prepare(`SELECT * FROM conversations WHERE chat_id = ?`).get(chatId);
}

export function getConversation(chatId) {
  return db.prepare(`SELECT * FROM conversations WHERE chat_id = ?`).get(chatId);
}

export function updateConversationStatus(chatId, status) {
  db.prepare(`UPDATE conversations SET status = ? WHERE chat_id = ?`).run(status, chatId);
}

// ============================================================
// Message helpers
// ============================================================
export function addMessage({ chatId, role, content, toolName = null, toolArgs = null, toolResult = null, reviewedBy = null }) {
  return db.prepare(`
    INSERT INTO messages (chat_id, role, content, tool_name, tool_args, tool_result, reviewed_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(chatId, role, content, toolName, toolArgs ? JSON.stringify(toolArgs) : null, toolResult ? JSON.stringify(toolResult) : null, reviewedBy);
}

export function getMessages(chatId, { limit = 20 } = {}) {
  const rows = db.prepare(`
    SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT ?
  `).all(chatId, limit);
  return rows.reverse();
}

// ============================================================
// Note helpers
// ============================================================
export function addNote({ chatId, category, content, source = "agent" }) {
  return db.prepare(`
    INSERT INTO notes (chat_id, category, content, source) VALUES (?, ?, ?, ?)
  `).run(chatId, category, content, source);
}

export function getNotesFor(chatId) {
  return db.prepare(`SELECT * FROM notes WHERE chat_id = ? ORDER BY created_at DESC`).all(chatId);
}

// ============================================================
// Appointment helpers
// ============================================================
export function saveAppointment(appt) {
  const info = db.prepare(`
    INSERT INTO appointments (chat_id, google_event_id, patient_name, patient_phone, service, scheduled_at, duration_minutes, notes)
    VALUES (@chatId, @googleEventId, @patientName, @patientPhone, @service, @scheduledAt, @durationMinutes, @notes)
  `).run({ durationMinutes: 30, notes: null, ...appt });
  return db.prepare(`SELECT * FROM appointments WHERE id = ?`).get(info.lastInsertRowid);
}

export function upcomingAppointments({ withinHours = 48 } = {}) {
  return db.prepare(`
    SELECT * FROM appointments
    WHERE status = 'confirmed'
      AND scheduled_at BETWEEN datetime('now') AND datetime('now', '+' || ? || ' hours')
    ORDER BY scheduled_at ASC
  `).all(withinHours);
}

// ============================================================
// OAuth token
// ============================================================
export function saveGoogleTokens({ accessToken, refreshToken = null, expiresAt = null, scope = null }) {
  db.prepare(`
    INSERT INTO oauth_tokens (provider, access_token, refresh_token, expires_at, scope, updated_at)
    VALUES ('google', @accessToken, @refreshToken, @expiresAt, @scope, datetime('now'))
    ON CONFLICT(provider) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = COALESCE(excluded.refresh_token, oauth_tokens.refresh_token),
      expires_at = excluded.expires_at,
      scope = excluded.scope,
      updated_at = datetime('now')
  `).run({ accessToken, refreshToken, expiresAt, scope });
}

export function getGoogleTokens() {
  return db.prepare(`SELECT * FROM oauth_tokens WHERE provider = 'google'`).get();
}
