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
      // chat_id: "wa:<numero>" (DM) ou "wa-group:<groupId>" (grupo → JID @g.us)
      const cid = String(draft.chat_id);
      const target = cid.startsWith("wa-group:")
        ? `${cid.slice("wa-group:".length)}@g.us`
        : cid.replace(/^wa:/, "");
      await sendTextMessage(target, finalResponse);
    } else if (draft.channel === "telegram") {
      // chat_id: "tg-user:<peer>" — sendUserbotMessage já trata o prefixo
      await sendUserbotMessage(draft.chat_id, finalResponse);
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
