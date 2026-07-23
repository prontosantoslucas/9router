"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
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

import { ChannelInbox } from "./components/ChannelInbox";
import { translate as t } from "@/i18n/runtime";

const i18nLabels = {
  headerClearChat: t("Limpar chat"),
  headerClearTitle: t("Limpar histórico da sessão"),
  emptyGreeting: t("Olá! Eu sou o Lucas."),
  emptySubtitle: t("Estou pronto para ajudar no WhatsApp, Telegram e aqui na Web. Como posso ajudar hoje?"),
  typing: t("Lucas está digitando..."),
  processing: t("Processando arquivo..."),
  copilotHeading: (n) => `${t("Mensagens pendentes do modo Co-Piloto")} (${n})`,
  uploadFailed: (m) => `${t("Falha no upload")}: ${m}`,
  notionSaved: t("Salvo no Notion."),
  notionFailed: (m) => `${t("Falha ao salvar no Notion")}: ${m}`,
  copilotApproved: t("Rascunho aprovado e enviado."),
  copilotRejected: t("Rascunho rejeitado."),
  copilotApproveFailed: (m) => `${t("Erro ao aprovar rascunho")}: ${m}`,
  copilotRejectFailed: (m) => `${t("Erro ao rejeitar rascunho")}: ${m}`,
  copilotLoadFailed: t("Não consegui carregar rascunhos."),
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
  const router = useRouter();
  const { showToast } = useToast();
  const { messages, isSending, sendMessage, clearSession } = useChatSession("main");
  const { uploadFile, isUploading } = useFileUpload();
  const { saveToNotion } = useNotionSave();

  const [isDragging, setIsDragging] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [copilotDrafts, setCopilotDrafts] = useState([]);
  const [promptText, setPromptText] = useState("");
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
      console.warn("[Copilot] fetch falhou:", err.message);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
    const interval = setInterval(fetchDrafts, COPILOT_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchDrafts]);

  // Notificações de canais (Telegram/WhatsApp) são gerenciadas pelo <ChannelInbox> no header,
  // que faz peek (não-destrutivo) e só marca como lido quando o usuário abre/limpa o painel.
  // O poller de toast foi removido porque consumia (marcava lido) as mensagens antes do inbox vê-las.

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
      if (!result) return;
      if (result.isImage) {
        setAttachments((prev) => [
          ...prev,
          { name: result.filename || file.name, isImage: true, base64: result.base64, mimeType: result.mimeType },
        ]);
      } else if (result.isVideo) {
        const parts = [];
        if (result.transcript) parts.push(`[Vídeo: ${result.filename} — transcrição do áudio]\n${result.transcript}`);
        setAttachments((prev) => [
          ...prev,
          ...(parts.length ? [{ name: result.filename, text: parts.join("\n") }] : []),
          ...(result.frames || []).map((fr, i) => ({
            name: `${result.filename} (frame ${i + 1})`, isImage: true, base64: fr.base64, mimeType: fr.mimeType,
          })),
        ]);
      } else {
        setAttachments((prev) => [...prev, { name: file.name, text: result.text }]);
      }
    } catch (err) {
      showToast({ kind: "error", text: i18nLabels.uploadFailed(err.message) });
    }
  };

  const handleSend = (text) => {
    const images = attachments.filter((a) => a.isImage).map((a) => ({ base64: a.base64, mimeType: a.mimeType }));
    const docs = attachments.filter((a) => !a.isImage);

    let fullText = text;
    if (docs.length > 0) {
      const fileContext = docs.map((a) => `[Anexo: ${a.name}]\n${a.text}`).join("\n\n");
      fullText = `${fileContext}\n\n${text}`;
    }
    if (attachments.length > 0) setAttachments([]);

    sendMessage(fullText, images.length > 0 ? { images } : undefined);
  };

  const handleSaveNotion = async (message) => {
    try {
      await saveToNotion({
        title: `Nota do Lucas (${new Date().toLocaleDateString()})`,
        content: message.content,
        tags: ["LucasAgent", "WebChat"],
      });
      showToast({ kind: "success", text: i18nLabels.notionSaved });
    } catch (err) {
      showToast({ kind: "error", text: i18nLabels.notionFailed(err.message) });
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
      showToast({ kind: "success", text: i18nLabels.copilotApproved });
    } catch (err) {
      showToast({ kind: "error", text: i18nLabels.copilotApproveFailed(err.message) });
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
      showToast({ kind: "info", text: i18nLabels.copilotRejected });
    } catch (err) {
      showToast({ kind: "error", text: i18nLabels.copilotRejectFailed(err.message) });
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex h-screen h-[100dvh] w-full flex-col overflow-hidden bg-bg text-text-main"
    >
      <DropOverlay isDragging={isDragging} />

      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-3 shadow-soft [padding-left:max(0.75rem,env(safe-area-inset-left))] [padding-right:max(0.75rem,env(safe-area-inset-right))] sm:h-16 sm:px-6 dark:bg-surface-2">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push("/dashboard");
              }
            }}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:bg-bg-alt hover:text-text-main sm:px-3"
            title="Voltar ao Painel"
          >
            <span className="material-symbols-outlined text-sm text-brand-500">arrow_back</span>
            <span className="hidden sm:inline">{t("Voltar")}</span>
          </button>
          <div className="min-w-0 truncate">
            <AgentBadge agentId="lucas" size="md" />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ChannelInbox onSelectPrompt={(prompt) => handleSend(prompt)} />

          <button
            onClick={clearSession}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:bg-bg-alt hover:text-danger sm:px-3"
            title={i18nLabels.headerClearTitle}
          >
            <span className="material-symbols-outlined text-sm">delete</span>
            <span className="hidden sm:inline">{i18nLabels.headerClearChat}</span>
          </button>
        </div>
      </header>

      {/* Mensagens */}
      <main className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          {copilotDrafts.length > 0 && (
            <div className="mb-6 space-y-3">
              <h4 className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-brand-500">
                <span className="material-symbols-outlined text-sm">verified_user</span>
                <span>{i18nLabels.copilotHeading(copilotDrafts.length)}</span>
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
              <h2 className="mt-4 text-xl font-extrabold text-text-main">{i18nLabels.emptyGreeting}</h2>
              <p className="mt-2 max-w-md text-sm text-text-muted">{i18nLabels.emptySubtitle}</p>
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
              <span>{i18nLabels.typing}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Composer */}
      <footer className="shrink-0 border-t border-border bg-surface p-3 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 dark:bg-surface-2">
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
              <span>{i18nLabels.processing}</span>
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
