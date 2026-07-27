"use client";

import React, { useState, useRef, useEffect } from "react";
import { AgentBadge } from "@/shared/components/primitives/AgentBadge";
import { MessageBubble } from "@/shared/components/primitives/MessageBubble";
import { ChatComposer } from "@/shared/components/primitives/ChatComposer";
import { FileAttachmentChip } from "@/shared/components/primitives/FileAttachmentChip";
import { enhanceUserPrompt, processOpenClaudePrompt } from "@/lib/coder/openclaudeEngine";

/**
 * Coder-mode chat column: message list + composer + "melhorar meu prompt" quick
 * action, wired to the coder engine. Shared by ChatPageClient (/chat?mode=coder)
 * and CoderPageClient (/coder) so both entry points stay in sync.
 */
export function CoderChatPanel({
  session,
  coderFiles = [],
  onUpdateFiles,
  onTerminalLog,
  onSaveNotion,
  attachments = [],
  onRemoveAttachment,
  onClearAttachments,
  isUploading = false,
  onUpload,
  emptyGreeting = "Olá! Sou o Lucas Coder.",
  emptySubtitle = "O que vamos construir do zero hoje? Descreva sua ideia e eu irei gerar a interface React/Tailwind e a estrutura do Backend localhost para você.",
  placeholder = "Descreva a aplicação ou alteração de código desejada...",
}) {
  const { messages, isSending, sendMessage } = session;
  const [draftText, setDraftText] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text) => {
    const images = attachments.filter((a) => a.isImage).map((a) => ({ base64: a.base64, mimeType: a.mimeType }));
    const docs = attachments.filter((a) => !a.isImage);

    let fullText = text;
    if (docs.length > 0) {
      const fileContext = docs.map((a) => `[Anexo: ${a.name}]\n${a.text}`).join("\n\n");
      fullText = `${fileContext}\n\n${text}`;
    }
    if (attachments.length > 0) onClearAttachments?.();

    sendMessage(fullText, images.length > 0 ? { images } : undefined);

    try {
      onTerminalLog?.((prev) => [...prev, { type: "command", text: `Prompt: ${text.slice(0, 50)}...` }]);
      await processOpenClaudePrompt({
        prompt: text,
        currentFiles: coderFiles,
        onTerminalLog: (log) => onTerminalLog?.((prev) => [...prev, log]),
        onUpdateFiles: (newFiles) => onUpdateFiles?.(newFiles),
      });
    } catch (err) {
      onTerminalLog?.((prev) => [...prev, { type: "error", text: `Erro Coder: ${err.message}` }]);
    }
  };

  const handleEnhancePrompt = () => {
    const raw = draftText.trim() || "Criar uma aplicação web moderna do zero";
    setDraftText(enhanceUserPrompt(raw));
  };

  const handleComposerSend = (text) => {
    setDraftText("");
    handleSend(text);
  };

  return (
    <div className="flex flex-col h-full">
      <main className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4">
        <div className="mx-auto max-w-4xl space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AgentBadge agentId="lucas" size="md" />
              <h2 className="mt-4 text-xl font-extrabold text-text-main">{emptyGreeting}</h2>
              <p className="mt-2 max-w-md text-sm text-text-muted">{emptySubtitle}</p>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onSaveNotion={onSaveNotion}
                onRetry={() => sendMessage(msg.content)}
              />
            ))
          )}

          {isSending && (
            <div className="flex items-center gap-2 text-xs italic text-text-muted" aria-live="polite">
              <TypingDots />
              <span>Lucas está digitando...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="shrink-0 border-t border-border bg-surface p-3 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 dark:bg-surface-2 space-y-2">
        <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/60">
          <button
            type="button"
            onClick={handleEnhancePrompt}
            className="flex items-center gap-1.5 text-[11px] font-bold text-brand-500 hover:underline"
          >
            <span className="material-symbols-outlined text-sm">auto_fix_high</span>
            <span>✨ Melhorar meu prompt com base na minha ideia</span>
          </button>
          <span className="text-[10px] text-text-muted font-mono">Coder Mode</span>
        </div>

        <div className="mx-auto max-w-4xl space-y-2">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-2">
              {attachments.map((att, i) => (
                <FileAttachmentChip key={i} filename={att.name} onRemove={() => onRemoveAttachment?.(i)} />
              ))}
            </div>
          )}

          {isUploading && (
            <div className="flex items-center gap-2 text-xs text-brand-500" aria-live="polite">
              <span className="material-symbols-outlined animate-spin text-sm">sync</span>
              <span>Processando arquivo...</span>
            </div>
          )}

          <ChatComposer
            value={draftText}
            onChange={setDraftText}
            onSend={handleComposerSend}
            onUpload={onUpload}
            isSending={isSending}
            placeholder={placeholder}
          />
        </div>
      </footer>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500 [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500 [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500 [animation-delay:300ms]" />
    </span>
  );
}
