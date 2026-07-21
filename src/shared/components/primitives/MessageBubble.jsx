"use client";

import React from "react";
import { AgentBadge } from "./AgentBadge";

export function MessageBubble({ message, onSaveNotion, onRetry }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex w-full gap-3 my-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="flex-shrink-0">
          <AgentBadge size="sm" agentId={message.agentId || "lucas"} />
        </div>
      )}

      <div className={`group relative max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm transition-all shadow-sm ${
        isUser
          ? "bg-brand-500 text-white rounded-br-none"
          : "bg-surface border border-border text-text-main rounded-bl-none dark:bg-surface-2"
      }`}>
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className={`text-xs font-semibold ${isUser ? "text-white/80" : "text-text-muted"}`}>
            {isUser ? message.sender || "Você" : message.agentName || "Lucas"}
          </span>
          <span className={`text-[10px] ${isUser ? "text-white/60" : "text-text-subtle"}`}>
            {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
          </span>
        </div>

        {/* Conteúdo da mensagem */}
        <div
          className="prose prose-sm dark:prose-invert max-w-none break-words"
          dangerouslySetInnerHTML={{ __html: message.htmlContent || message.content }}
        />

        {/* Imagem em anexo ou gerada */}
        {message.image && (
          <div className="mt-3 overflow-hidden rounded-lg border border-border">
            <img src={message.image} alt="Mídia anexada" className="max-h-80 w-full object-cover" />
          </div>
        )}

        {/* Player de áudio se for resposta TTS */}
        {message.audioUrl && (
          <div className="mt-3">
            <audio controls src={message.audioUrl} className="w-full h-9 rounded" />
          </div>
        )}

        {/* Ações da mensagem (Botão Notion / Retry) */}
        {!isUser && (
          <div className="mt-2 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {onSaveNotion && (
              <button
                onClick={() => onSaveNotion(message)}
                className="flex items-center gap-1 text-[11px] text-text-muted hover:text-brand-500 transition-colors"
                title="Salvar no Notion"
              >
                <span className="material-symbols-outlined text-xs">book</span>
                <span>Notion</span>
              </button>
            )}
            {message.isError && onRetry && (
              <button
                onClick={() => onRetry(message)}
                className="flex items-center gap-1 text-[11px] text-danger hover:underline"
              >
                <span className="material-symbols-outlined text-xs">refresh</span>
                <span>Tentar novamente</span>
              </button>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white text-xs font-bold flex-shrink-0">
          U
        </div>
      )}
    </div>
  );
}
