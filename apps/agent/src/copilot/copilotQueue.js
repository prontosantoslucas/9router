const db = require("../db");

function addDraft(channel, chatId, senderName, originalMessage, draftResponse) {
  const stmt = db.prepare(`
    INSERT INTO copilot_drafts (channel, chat_id, sender_name, original_message, draft_response, status)
    VALUES (?, ?, ?, ?, ?, 'PENDING_APPROVAL')
  `);
  const info = stmt.run(channel, chatId, senderName || "", originalMessage, draftResponse);
  return info.lastInsertRowid;
}

function getPendingDrafts() {
  const stmt = db.prepare(`SELECT * FROM copilot_drafts WHERE status = 'PENDING_APPROVAL' ORDER BY created_at DESC`);
  return stmt.all();
}

function updateDraftStatus(id, status, editedResponse = null) {
  if (editedResponse) {
    const stmt = db.prepare(`UPDATE copilot_drafts SET status = ?, draft_response = ? WHERE id = ?`);
    stmt.run(status, editedResponse, id);
  } else {
    const stmt = db.prepare(`UPDATE copilot_drafts SET status = ? WHERE id = ?`);
    stmt.run(status, id);
  }
}

function getDraftById(id) {
  const stmt = db.prepare(`SELECT * FROM copilot_drafts WHERE id = ?`);
  return stmt.get(id);
}

module.exports = {
  addDraft,
  getPendingDrafts,
  updateDraftStatus,
  getDraftById,
};
