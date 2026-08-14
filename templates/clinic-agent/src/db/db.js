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

// v3: consultas que precisam de lembrete — dentro da janela [X-1h, X+1h] antes
// da consulta e que ainda não receberam lembrete.
export function appointmentsNeedingReminder({ hoursBefore = 24 } = {}) {
  return db.prepare(`
    SELECT * FROM appointments
    WHERE status = 'confirmed'
      AND reminder_sent_at IS NULL
      AND scheduled_at BETWEEN datetime('now', '+' || (? - 1) || ' hours')
                           AND datetime('now', '+' || (? + 1) || ' hours')
    ORDER BY scheduled_at ASC
  `).all(hoursBefore, hoursBefore);
}

export function markReminderSent(appointmentId) {
  db.prepare(`UPDATE appointments SET reminder_sent_at = datetime('now') WHERE id = ?`).run(appointmentId);
}

// v4: conversas elegíveis pra reativação. Retorna, pra cada conversa ativa,
// há quantos dias está silenciosa. O worker decide o tier (15/30/60+).
export function conversationsForReengagement() {
  return db.prepare(`
    SELECT chat_id, channel, patient_name, patient_phone, status, reengaged_stage,
           CAST(julianday('now') - julianday(last_seen_at) AS INTEGER) AS days_silent
    FROM conversations
    WHERE status = 'active'
      AND channel = 'whatsapp'
    ORDER BY last_seen_at ASC
  `).all();
}

export function markReengaged(chatId, stage) {
  db.prepare(`UPDATE conversations SET reengaged_stage = ?, reengaged_at = datetime('now') WHERE chat_id = ?`).run(stage, chatId);
}

// Registro de eventos dos workers (audit)
export function logWorkerEvent({ kind, chatId = null, appointmentId = null, status, payload = null }) {
  db.prepare(`
    INSERT INTO worker_events (kind, chat_id, appointment_id, status, payload)
    VALUES (?, ?, ?, ?, ?)
  `).run(kind, chatId, appointmentId, status, payload ? JSON.stringify(payload) : null);
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

// ============================================================
// Runtime config helpers (Chave de IA do MaxRouter e configs dinâmicas)
// ============================================================
export function getRuntimeConfig() {
  try {
    const rows = db.prepare("SELECT key, value FROM runtime_config").all();
    const cfg = {};
    for (const r of rows) {
      cfg[r.key] = r.value;
    }
    return cfg;
  } catch (err) {
    return {};
  }
}

export function saveRuntimeConfigKey(key, value) {
  return db.prepare(`
    INSERT INTO runtime_config (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')
  `).run(key, String(value));
}

// ============================================================
// Prospecting 24/7 & Funil de Vendas Helpers
// ============================================================
export function upsertProspect(prospect) {
  const cleanName = (prospect.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const phone = prospect.phone ? prospect.phone.replace(/\D/g, "") : null;
  const instagram = prospect.instagramHandle ? prospect.instagramHandle.replace(/^@/, "").trim().toLowerCase() : null;

  try {
    const info = db.prepare(`
      INSERT INTO prospects (name, clean_name, category, city, phone, instagram_handle, linkedin_url, website, source, stage, notes)
      VALUES (@name, @cleanName, @category, @city, @phone, @instagram, @linkedinUrl, @website, @source, @stage, @notes)
      ON CONFLICT(phone) DO NOTHING
      ON CONFLICT(instagram_handle) DO NOTHING
      ON CONFLICT(clean_name) DO NOTHING
    `).run({
      name: prospect.name,
      cleanName: cleanName || null,
      category: prospect.category || "Geral",
      city: prospect.city || "São Paulo",
      phone: phone || null,
      instagram: instagram || null,
      linkedinUrl: prospect.linkedinUrl || null,
      website: prospect.website || null,
      source: prospect.source || "web",
      stage: prospect.stage || "discovered",
      notes: prospect.notes || null,
    });

    if (info.changes > 0) {
      return db.prepare("SELECT * FROM prospects WHERE id = ?").get(info.lastInsertRowid);
    }

    // Se já existia, recupera o registro existente para não duplicar
    return db.prepare(`
      SELECT * FROM prospects 
      WHERE (phone IS NOT NULL AND phone = ?) 
         OR (instagram_handle IS NOT NULL AND instagram_handle = ?) 
         OR (clean_name IS NOT NULL AND clean_name = ?)
    `).get(phone, instagram, cleanName);
  } catch (err) {
    console.warn("[db] Aviso ao inserir prospect:", err.message);
    return null;
  }
}

export function saveProspectDraft({ prospectId, channel = "whatsapp", draftMessage }) {
  try {
    const info = db.prepare(`
      INSERT INTO prospect_drafts (prospect_id, channel, draft_message, status)
      VALUES (?, ?, ?, 'draft')
    `).run(prospectId, channel, draftMessage);
    return db.prepare("SELECT * FROM prospect_drafts WHERE id = ?").get(info.lastInsertRowid);
  } catch (err) {
    console.warn("[db] Erro ao salvar rascunho de prospect:", err.message);
    return null;
  }
}

export function getProspectsWithDrafts() {
  const rows = db.prepare(`
    SELECT 
      p.id AS prospect_id,
      p.name,
      p.category,
      p.city,
      p.phone,
      p.instagram_handle,
      p.linkedin_url,
      p.website,
      p.source,
      p.stage,
      p.notes,
      p.created_at,
      d.id AS draft_id,
      d.channel AS draft_channel,
      d.draft_message,
      d.status AS draft_status
    FROM prospects p
    LEFT JOIN prospect_drafts d ON p.id = d.prospect_id
    ORDER BY p.created_at DESC
    LIMIT 100
  `).all();
  return rows;
}

export function getProspectingMetrics() {
  const totalToday = db.prepare(`
    SELECT COUNT(*) as cnt FROM prospects WHERE date(created_at) = date('now')
  `).get()?.cnt || 0;

  const totalAll = db.prepare(`SELECT COUNT(*) as cnt FROM prospects`).get()?.cnt || 0;

  const contacted = db.prepare(`
    SELECT COUNT(*) as cnt FROM prospects WHERE stage IN ('contacted', 'replied', 'interview_scheduled', 'closed', 'lost')
  `).get()?.cnt || 0;

  const replied = db.prepare(`
    SELECT COUNT(*) as cnt FROM prospects WHERE stage IN ('replied', 'interview_scheduled', 'closed')
  `).get()?.cnt || 0;

  const interviewScheduled = db.prepare(`
    SELECT COUNT(*) as cnt FROM prospects WHERE stage = 'interview_scheduled'
  `).get()?.cnt || 0;

  const closed = db.prepare(`
    SELECT COUNT(*) as cnt FROM prospects WHERE stage = 'closed'
  `).get()?.cnt || 0;

  const responseRate = contacted > 0 ? Math.round((replied / contacted) * 100) : 0;
  const conversionRate = contacted > 0 ? Math.round((closed / contacted) * 100) : 0;

  return {
    totalToday,
    totalAll,
    contacted,
    replied,
    interviewScheduled,
    closed,
    responseRate,
    conversionRate
  };
}

export function updateProspectStage(id, stage) {
  db.prepare("UPDATE prospects SET stage = ? WHERE id = ?").run(stage, id);
}

export function updateDraftMessage(draftId, draftMessage) {
  db.prepare("UPDATE prospect_drafts SET draft_message = ? WHERE id = ?").run(draftMessage, draftId);
}

export function deleteProspect(id) {
  db.prepare("DELETE FROM prospect_drafts WHERE prospect_id = ?").run(id);
  db.prepare("DELETE FROM prospects WHERE id = ?").run(id);
}

// Modo efetivo do agente: o painel (runtime_config) tem prioridade sobre a env
// var. Sem isso o seletor "Produção/Teste" da tela de Config era decorativo —
// gravava no banco e todo o código de envio continuava lendo AGENT_MODE, então
// a clínica achava que tinha armado/desarmado o robô e não tinha.
//
// 'prod' = responde de verdade no WhatsApp. Qualquer outro valor = não envia.
export function getEffectiveAgentMode() {
  const fromPanel = getRuntimeConfig().agentMode;
  if (fromPanel === "prod" || fromPanel === "test") return fromPanel;
  return config.agent.mode;
}

// Allowlist de demonstração: quando preenchida, o agente só responde a estes
// números, mesmo em modo prod. Existe pra permitir rodar a demo no número
// pessoal/comercial sem que o robô responda a TODO mundo que chamar —
// inclusive prospect, familiar e cliente real.
//
// Formato: lista separada por vírgula, só dígitos (5511999999999).
// Vazia = sem restrição (comportamento normal de produção).
export function getDemoAllowlist() {
  const raw = getRuntimeConfig().demoAllowlist ?? process.env.DEMO_ALLOWLIST ?? "";
  return String(raw)
    .split(",")
    .map((n) => n.replace(/\D/g, ""))
    .filter(Boolean);
}

// chatId chega como "whatsapp:5511999999999"
export function isAllowedForDemo(chatId) {
  const list = getDemoAllowlist();
  if (list.length === 0) return true;
  const digits = String(chatId).replace(/\D/g, "");
  return list.some((n) => digits.endsWith(n) || n.endsWith(digits));
}
