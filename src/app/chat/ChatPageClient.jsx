"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { AgentBadge } from "@/shared/components/primitives/AgentBadge";
import { MessageBubble } from "@/shared/components/primitives/MessageBubble";
import { ChatComposer } from "@/shared/components/primitives/ChatComposer";
import { DropOverlay } from "@/shared/components/primitives/DropOverlay";
import { FileAttachmentChip } from "@/shared/components/primitives/FileAttachmentChip";
import { CopilotApprovalCard } from "@/shared/components/primitives/CopilotApprovalCard";
import { ToastProvider, useToast } from "@/shared/components/primitives/Toast";
import { useChatSession } from "./hooks/useChatSession";
import { useFileUpload } from "./hooks/useFileUpload";
import { useNotionSave } from "./hooks/useNotionSave";

// i18n leve — dicionário local. Migrar para RuntimeI18nProvider é follow-up.
const t = {
  headerClearChat: "Limpar chat",
  headerClearTitle: "Limpar histórico da sessão",
  emptyGreeting: "Olá! Eu sou o Lucas.",
  emptySubtitle: "Estou pronto para ajudar no WhatsApp, Telegram e aqui na Web. Como posso ajudar hoje?",
  typing: "Lucas está digitando...",
  processing: "Processando arquivo...",
  copilotHeading: (n) => `Mensagens pendentes do modo Co-Piloto (${n})`,
  uploadFailed: (m) => `Falha no upload: ${m}`,
  notionSaved: "Salvo no Notion.",
  notionFailed: (m) => `Falha ao salvar no Notion: ${m}`,
  copilotApproved: "Rascunho aprovado e enviado.",
  copilotRejected: "Rascunho rejeitado.",
  copilotApproveFailed: (m) => `Erro ao aprovar rascunho: ${m}`,
  copilotRejectFailed: (m) => `Erro ao rejeitar rascunho: ${m}`,
  copilotLoadFailed: "Não consegui carregar rascunhos.",
};

const COPILOT_POLL_INTERVAL_MS = 15000;

export default function ChatPageClient() {
  return (
    <ToastProvider>
      <ChatShell />
    </ToastProvider>
  );
}

function ChatShell() {
  const { showToast } = useToast();
  const { messages, isSending, sendMessage, clearSession } = useChatSession("main");
  const { uploadFile, isUploading } = useFileUpload();
  const { saveToNotion } = useNotionSave();

  const [isDragging, setIsDragging] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [copilotDrafts, setCopilotDrafts] = useState([]);
  const messagesEndRef = useRef(null);

  // Auto-scroll ao receber novas mensagens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Polling de rascunhos pendentes do modo Co-Piloto
  const fetchDrafts = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/copilot/approvals");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCopilotDrafts(data.drafts || []);
    } catch (err) {
      // Só notifica se foi o primeiro fetch — polling silencia
      console.warn("[Copilot] fetch falhou:", err.message);
    }
  }, []);

  useEffect(() => {
    fetchDrafts(); // primeiro fetch
    const interval = setInterval(fetchDrafts, COPILOT_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchDrafts]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleUpload(files[0]);
  };

  const handleUpload = async (file) => {
    try {
      const result = await uploadFile(file);
      if (result) {
        setAttachments((prev) => [...prev, { name: file.name, text: result.text }]);
      }
    } catch (err) {
      showToast({ kind: "error", text: t.uploadFailed(err.message) });
    }
  };

  const handleSend = (text) => {
    let fullText = text;
    if (attachments.length > 0) {
      const fileContext = attachments.map((a) => `[Anexo: ${a.name}]\n${a.text}`).join("\n\n");
      fullText = `${fileContext}\n\n${text}`;
      setAttachments([]);
    }
    sendMessage(fullText);
  };

  const handleSaveNotion = async (message) => {
    try {
      await saveToNotion({
        title: `Nota do Lucas (${new Date().toLocaleDateString()})`,
        content: message.content,
        tags: ["LucasAgent", "WebChat"],
      });
      showToast({ kind: "success", text: t.notionSaved });
    } catch (err) {
      showToast({ kind: "error", text: t.notionFailed(err.message) });
    }
  };

  const handleApproveCopilot = async (draftId, editedResponse) => {
    try {
      const res = await fetch("/api/agent/copilot/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, editedResponse }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCopilotDrafts((prev) => prev.filter((d) => d.id !== draftId));
      showToast({ kind: "success", text: t.copilotApproved });
    } catch (err) {
      showToast({ kind: "error", text: t.copilotApproveFailed(err.message) });
    }
  };

  const handleRejectCopilot = async (draftId) => {
    try {
      const res = await fetch("/api/agent/copilot/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCopilotDrafts((prev) => prev.filter((d) => d.id !== draftId));
      showToast({ kind: "info", text: t.copilotRejected });
    } catch (err) {
      showToast({ kind: "error", text: t.copilotRejectFailed(err.message) });
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex h-screen w-full flex-col bg-bg text-text-main"
    >
      <DropOverlay isDragging={isDragging} />

      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-6 shadow-soft dark:bg-surface-2">
        <AgentBadge agentId="lucas" size="md" />

        <div className="flex items-center gap-3">
          <button
            onClick={clearSession}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:bg-bg-alt hover:text-danger"
            title={t.headerClearTitle}
          >
            <span className="material-symbols-outlined text-sm">delete</span>
            <span>{t.headerClearChat}</span>
          </button>
        </div>
      </header>

      {/* Mensagens */}
      <main className="custom-scrollbar flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          {copilotDrafts.length > 0 && (
            <div className="mb-6 space-y-3">
              <h4 className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-brand-500">
                <span className="material-symbols-outlined text-sm">verified_user</span>
                <span>{t.copilotHeading(copilotDrafts.length)}</span>
              </h4>
              {copilotDrafts.map((draft) => (
                <CopilotApprovalCard
                  key={draft.id}
                  draft={draft}
                  onApprove={handleApproveCopilot}
                  onReject={handleRejectCopilot}
                />
              ))}
            </div>
          )}

          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AgentBadge agentId="lucas" size="md" />
              <h2 className="mt-4 text-xl font-extrabold text-text-main">{t.emptyGreeting}</h2>
              <p className="mt-2 max-w-md text-sm text-text-muted">{t.emptySubtitle}</p>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onSaveNotion={handleSaveNotion}
                onRetry={() => sendMessage(msg.content)}
              />
            ))
          )}

          {isSending && (
            <div className="flex items-center gap-2 text-xs italic text-text-muted" aria-live="polite">
              <TypingDots />
              <span>{t.typing}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Composer */}
      <footer className="border-t border-border bg-surface p-4 dark:bg-surface-2">
        <div className="mx-auto max-w-4xl space-y-2">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-2">
              {attachments.map((att, i) => (
                <FileAttachmentChip
                  key={i}
                  filename={att.name}
                  onRemove={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                />
              ))}
            </div>
          )}

          {isUploading && (
            <div className="flex items-center gap-2 text-xs text-brand-500" aria-live="polite">
              <span className="material-symbols-outlined animate-spin text-sm">sync</span>
              <span>{t.processing}</span>
            </div>
          )}

          <ChatComposer onSend={handleSend} onUpload={handleUpload} isSending={isSending} />
        </div>
      </footer>
    </div>
  );
}

// Typing indicator no DS — 3 dots com fade
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500 [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500 [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500 [animation-delay:300ms]" />
    </span>
  );
}
