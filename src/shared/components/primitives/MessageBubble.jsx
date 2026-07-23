"use client";

import React, { useState } from "react";
import { AgentBadge } from "./AgentBadge";

export function MessageBubble({ message, onSaveNotion, onRetry }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [ttsUrl, setTtsUrl] = useState(null);
  const [ttsLoading, setTtsLoading] = useState(false);

  const handleListen = async () => {
    if (ttsUrl) return; // já gerado
    setTtsLoading(true);
    try {
      const res = await fetch("/api/agent/audio/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message.content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setTtsUrl(`data:${data.mimeType || "audio/mpeg"};base64,${data.base64}`);
    } catch (err) {
      alert(`Não consegui gerar o áudio: ${err.message}`);
    } finally {
      setTtsLoading(false);
    }
  };

  const time = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className={`flex w-full gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className="flex-shrink-0 pt-0.5">
        {isUser ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white shadow-soft">
            {(message.sender || "V").charAt(0).toUpperCase()}
          </div>
        ) : (
          <AgentBadge size="sm" agentId={message.agentId || "lucas"} hideLabel />
        )}
      </div>

      {/* Coluna da mensagem */}
      <div className={`flex min-w-0 max-w-[82%] flex-col sm:max-w-[72%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Meta: nome + hora */}
        <div className={`mb-1 flex items-center gap-2 px-1 ${isUser ? "flex-row-reverse" : ""}`}>
          <span className="text-xs font-semibold text-text-main">
            {isUser ? message.sender || "Você" : message.agentName || "Lucas"}
          </span>
          {time && <span className="text-[10px] text-text-muted">{time}</span>}
        </div>

        {/* Balão */}
        <div
          className={`group relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-soft ring-1 transition-all ${
            isUser
              ? "rounded-tr-md bg-gradient-to-br from-brand-500 to-brand-600 text-white ring-brand-600/20"
              : message.isError
              ? "rounded-tl-md bg-danger/5 text-text-main ring-danger/30"
              : "rounded-tl-md bg-surface text-text-main ring-border/70 dark:bg-surface-2"
          }`}
        >
          <div
            className={`chat-prose max-w-none break-words ${isUser ? "chat-prose-invert" : ""}`}
            dangerouslySetInnerHTML={{ __html: message.htmlContent || message.content }}
          />

          {/* Imagem (anexo ou gerada) */}
          {message.image && (
            <div className="mt-3 overflow-hidden rounded-xl border border-border/60">
              <img src={message.image} alt="Mídia" className="max-h-96 w-full object-contain bg-bg-alt" />
            </div>
          )}

          {/* Player de áudio (TTS ou nota de voz) */}
          {(message.audioUrl || ttsUrl) && (
            <div className="mt-3">
              <audio controls src={ttsUrl || message.audioUrl} className="h-9 w-full" />
            </div>
          )}
        </div>

        {/* Ações (aparecem no hover) */}
        <div
          className={`mt-1 flex items-center gap-3 px-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 ${
            isUser ? "flex-row-reverse" : ""
          }`}
        >
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] text-text-muted transition-colors hover:text-brand-500"
            title="Copiar"
          >
            <span className="material-symbols-outlined text-[13px]">{copied ? "check" : "content_copy"}</span>
            <span>{copied ? "Copiado" : "Copiar"}</span>
          </button>

          {!isUser && (
            <button
              onClick={handleListen}
              disabled={ttsLoading}
              className="flex items-center gap-1 text-[11px] text-text-muted transition-colors hover:text-brand-500 disabled:opacity-50"
              title="Ouvir resposta"
            >
              <span className={`material-symbols-outlined text-[13px] ${ttsLoading ? "animate-spin" : ""}`}>
                {ttsLoading ? "sync" : "volume_up"}
              </span>
              <span>{ttsLoading ? "Gerando…" : "Ouvir"}</span>
            </button>
          )}

          {!isUser && onSaveNotion && (
            <button
              onClick={() => onSaveNotion(message)}
              className="flex items-center gap-1 text-[11px] text-text-muted transition-colors hover:text-brand-500"
              title="Salvar no Notion"
            >
              <span className="material-symbols-outlined text-[13px]">bookmark_add</span>
              <span>Notion</span>
            </button>
          )}

          {message.isError && onRetry && (
            <button
              onClick={() => onRetry(message)}
              className="flex items-center gap-1 text-[11px] text-danger transition-colors hover:underline"
              title="Tentar novamente"
            >
              <span className="material-symbols-outlined text-[13px]">refresh</span>
              <span>Tentar novamente</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
