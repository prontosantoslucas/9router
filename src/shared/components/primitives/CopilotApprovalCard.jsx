"use client";

import React, { useState } from "react";

export function CopilotApprovalCard({ draft, onApprove, onReject, onEdit }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedResponse, setEditedResponse] = useState(draft.draft_response);

  const handleApprove = () => {
    onApprove(draft.id, editedResponse);
  };

  return (
    <div className="card-soft border-2 border-brand-500/30 p-4 rounded-xl shadow-warm dark:bg-surface-2">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/10 text-brand-500 text-xs font-bold">
            {draft.channel === "whatsapp" ? "WA" : "TG"}
          </span>
          <span className="text-xs font-bold text-text-main">
            Resposta Rascunhada ({draft.channel === "whatsapp" ? "WhatsApp" : "Telegram"})
          </span>
        </div>
        <span className="text-[10px] text-text-subtle">Aprovação Pendente</span>
      </div>

      <div className="mt-3 space-y-2 text-xs">
        <div className="rounded-lg bg-bg-alt p-2.5">
          <span className="font-semibold text-text-muted">Mensagem de {draft.sender_name || draft.chat_id}:</span>
          <p className="mt-1 text-text-main font-medium">"{draft.original_message}"</p>
        </div>

        <div className="rounded-lg bg-surface border border-border p-2.5 dark:bg-surface-3">
          <span className="font-semibold text-brand-500">Sugestão do Lucas:</span>
          {isEditing ? (
            <textarea
              value={editedResponse}
              onChange={(e) => setEditedResponse(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded border border-border bg-transparent p-1.5 text-xs text-text-main focus:outline-none focus:border-brand-500"
            />
          ) : (
            <p className="mt-1 text-text-main italic">"{editedResponse}"</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-bg-alt transition-colors"
        >
          {isEditing ? "Concluir Edição" : "Editar"}
        </button>
        <button
          onClick={() => onReject(draft.id)}
          className="rounded-lg bg-danger/10 border border-danger/20 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/20 transition-colors"
        >
          Rejeitar
        </button>
        <button
          onClick={handleApprove}
          className="flex items-center gap-1 rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-bold text-white shadow-soft hover:bg-brand-600 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">check</span>
          <span>Aprovar & Enviar</span>
        </button>
      </div>
    </div>
  );
}
