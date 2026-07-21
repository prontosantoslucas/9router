const { getPendingDrafts, updateDraftStatus, getDraftById } = require("./copilotQueue");
const { sendTextMessage } = require("../channels/evolution/evolutionApi");
const { sendUserbotMessage } = require("../channels/telegram/userbotSender");

function listApprovals(req, res) {
  const drafts = getPendingDrafts();
  res.json({ drafts });
}

async function approveDraft(req, res) {
  const { draftId, editedResponse } = req.body;
  if (!draftId) return res.status(400).json({ error: "draftId obrigatório" });

  const draft = getDraftById(draftId);
  if (!draft) return res.status(404).json({ error: "Rascunho não encontrado" });

  const finalResponse = editedResponse || draft.draft_response;

  try {
    if (draft.channel === "whatsapp") {
      await sendTextMessage(draft.chat_id.replace("wa:", ""), finalResponse);
    } else if (draft.channel === "telegram") {
      await sendUserbotMessage(draft.chat_id.replace("tg:", ""), finalResponse);
    }

    updateDraftStatus(draftId, "APPROVED", finalResponse);
    res.json({ ok: true, status: "APPROVED" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function rejectDraft(req, res) {
  const { draftId } = req.body;
  if (!draftId) return res.status(400).json({ error: "draftId obrigatório" });

  updateDraftStatus(draftId, "REJECTED");
  res.json({ ok: true, status: "REJECTED" });
}

module.exports = {
  listApprovals,
  approveDraft,
  rejectDraft,
};
