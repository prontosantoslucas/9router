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

import { ChannelInbox } from "./components/ChannelInbox";
import { translate as t } from "@/i18n/runtime";

const i18nLabels = {
  headerClearChat: t("Limpar chat"),
  headerClearTitle: t("Limpar histórico da sessão"),
  emptyGreeting: t("Olá! Eu sou o Lucas."),
  emptySubtitle: t("Estou pronto para ajudar no WhatsApp, Telegram e aqui no Chat. Como posso ajudar hoje?"),
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
      <React.Suspense fallback={<div className="h-screen w-full bg-bg" />}>
        <ChatShell />
      </React.Suspense>
    </ToastProvider>
  );
}

function ChatShell() {

  const { showToast } = useToast();

  const mainSession = useChatSession("main");

  const { uploadFile, isUploading } = useFileUpload();
  const { saveToNotion } = useNotionSave();

  const [isDragging, setIsDragging] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [copilotDrafts, setCopilotDrafts] = useState([]);
  const messagesEndRef = useRef(null);

  // Modo conversação por voz. Toggle no composer; state fica aqui pra que:
  //   - resposta do agent seja auto-tocada via TTS
  //   - após audio terminar, incrementamos autoRecordSignal → composer grava
  const [voiceMode, setVoiceMode] = useState(false);
  const [autoRecordSignal, setAutoRecordSignal] = useState(0);
  const currentAudioRef = useRef(null);
  const lastAutoPlayedIdRef = useRef(null);

  const { messages, isSending, sendMessage, clearSession } = mainSession;
  // Auto-scroll ao receber novas mensagens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Modo conversação: quando chega msg nova do agent E voiceMode está on,
  // gera TTS via /api/agent/audio/tts, toca automático e, ao terminar,
  // sinaliza pro composer gravar de novo (loop hands-free).
  useEffect(() => {
    if (!voiceMode || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || !last.content) return;
    if (last.isError) return;
    if (lastAutoPlayedIdRef.current === last.id) return;
    lastAutoPlayedIdRef.current = last.id;

    let cancelled = false;
    (async () => {
      try {
        // Interrompe player anterior se ainda tocando
        if (currentAudioRef.current) {
          try { currentAudioRef.current.pause(); } catch {}
        }
        const res = await fetch("/api/agent/audio/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: last.content }),
        });
        const data = await res.json();
        if (!res.ok || cancelled) return;
        const src = `data:${data.mimeType || "audio/mpeg"};base64,${data.base64}`;
        const audio = new Audio(src);
        currentAudioRef.current = audio;
        audio.onended = () => {
          if (voiceMode && !cancelled) setAutoRecordSignal((n) => n + 1);
        };
        audio.play().catch((e) => console.warn("[voice] auto-play falhou:", e.message));
      } catch (err) {
        console.warn("[voice] TTS falhou:", err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [messages, voiceMode]);

  // Ao sair do modo voz, para o audio corrente
  useEffect(() => {
    if (!voiceMode && currentAudioRef.current) {
      try { currentAudioRef.current.pause(); } catch {}
      currentAudioRef.current = null;
    }
  }, [voiceMode]);

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
    // fetchDrafts's setState only runs after its internal `await`, never
    // synchronously during this effect — genuine mount+poll data fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDrafts();
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

  // Envio para o Chat Geral (mainSession). A geração de código vive em /coder,
  // com seu próprio composer e fluxo no motor OpenClaude.
  const handleSend = async (text) => {
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
      className="relative flex h-full w-full flex-col overflow-hidden bg-bg text-text-main"
    >
      <DropOverlay isDragging={isDragging} />

      {/* Header com Glassmorphism e Seletor de Modo Nativo */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/80 bg-surface/90 backdrop-blur-md px-3 shadow-soft [padding-left:max(0.75rem,env(safe-area-inset-left))] [padding-right:max(0.75rem,env(safe-area-inset-right))] sm:h-16 sm:px-6 dark:bg-surface-2/90">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
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

      {/* Main Body: Chat Column + Coder Workspace Column */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
          <div className="flex h-full w-full flex-col">
            {/* Mensagens do Chat Geral */}
            <main className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4">
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
                  <div className="flex flex-col items-center justify-center py-16 text-center">
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
            <footer className="shrink-0 border-t border-border bg-surface p-3 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 dark:bg-surface-2 space-y-2">
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

                <ChatComposer
                  onSend={handleSend}
                  onUpload={handleUpload}
                  isSending={isSending}
                  placeholder={voiceMode ? "Modo conversa por voz ativo — fale após o áudio da resposta" : "Converse com o Lucas..."}
                  voiceMode={voiceMode}
                  onToggleVoiceMode={() => setVoiceMode((v) => !v)}
                  autoRecordSignal={autoRecordSignal}
                />
              </div>
            </footer>
          </div>
      </div>
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
