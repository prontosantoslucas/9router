"use client";

import React, { useState, useEffect, useRef } from "react";
import { AgentBadge } from "@/shared/components/primitives/AgentBadge";
import { MessageBubble } from "@/shared/components/primitives/MessageBubble";
import { ChatComposer } from "@/shared/components/primitives/ChatComposer";
import { DropOverlay } from "@/shared/components/primitives/DropOverlay";
import { FileAttachmentChip } from "@/shared/components/primitives/FileAttachmentChip";
import { CopilotApprovalCard } from "@/shared/components/primitives/CopilotApprovalCard";
import { useChatSession } from "./hooks/useChatSession";
import { useFileUpload } from "./hooks/useFileUpload";
import { useNotionSave } from "./hooks/useNotionSave";

export default function ChatPageClient() {
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

  // Carregar rascunhos pendentes do modo Co-Piloto
  useEffect(() => {
    const fetchDrafts = async () => {
      try {
        const res = await fetch("/api/agent/copilot/approvals");
        if (res.ok) {
          const data = await res.json();
          setCopilotDrafts(data.drafts || []);
        }
      } catch (err) {
        console.error("[Copilot] Erro ao carregar rascunhos:", err);
      }
    };
    fetchDrafts();
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleUpload(files[0]);
    }
  };

  const handleUpload = async (file) => {
    try {
      const result = await uploadFile(file);
      if (result) {
        setAttachments((prev) => [...prev, { name: file.name, text: result.text }]);
      }
    } catch (err) {
      alert(`Falha no upload: ${err.message}`);
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
      alert("✅ Salvo no Notion com sucesso!");
    } catch (err) {
      alert(`Falha ao salvar no Notion: ${err.message}`);
    }
  };

  const handleApproveCopilot = async (draftId, editedResponse) => {
    try {
      const res = await fetch("/api/agent/copilot/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, editedResponse }),
      });
      if (res.ok) {
        setCopilotDrafts((prev) => prev.filter((d) => d.id !== draftId));
      }
    } catch (err) {
      alert(`Erro ao aprovar rascunho: ${err.message}`);
    }
  };

  const handleRejectCopilot = async (draftId) => {
    try {
      const res = await fetch("/api/agent/copilot/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId }),
      });
      if (res.ok) {
        setCopilotDrafts((prev) => prev.filter((d) => d.id !== draftId));
      }
    } catch (err) {
      alert(`Erro ao rejeitar rascunho: ${err.message}`);
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

      {/* Header do Chat */}
      <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-6 shadow-soft dark:bg-surface-2">
        <AgentBadge agentId="lucas" size="md" />

        <div className="flex items-center gap-3">
          <button
            onClick={clearSession}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-bg-alt hover:text-danger transition-colors"
            title="Limpar histórico da sessão"
          >
            <span className="material-symbols-outlined text-sm">delete</span>
            <span>Limpar Chat</span>
          </button>
        </div>
      </header>

      {/* Área de Mensagens */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        <div className="mx-auto max-w-4xl space-y-4">
          {/* Fila de aprovações do modo Co-Piloto se houver */}
          {copilotDrafts.length > 0 && (
            <div className="mb-6 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-500 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">verified_user</span>
                <span>Mensagens Pendentes do Modo Co-Piloto ({copilotDrafts.length})</span>
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
              <h2 className="mt-4 text-xl font-extrabold text-text-main">Olá! Eu sou o Lucas.</h2>
              <p className="mt-2 max-w-md text-sm text-text-muted">
                Estou pronto para ajudar você no WhatsApp, Telegram e aqui na Web. Como posso ajudar hoje?
              </p>
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
            <div className="flex items-center gap-2 text-xs text-text-muted italic animate-pulse">
              <span className="material-symbols-outlined text-sm text-brand-500 animate-spin">sync</span>
              <span>Lucas está digitando...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Rodapé Composer */}
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
            <div className="flex items-center gap-2 text-xs text-brand-500">
              <span className="material-symbols-outlined text-sm animate-spin">sync</span>
              <span>Processando arquivo...</span>
            </div>
          )}

          <ChatComposer onSend={handleSend} onUpload={handleUpload} isSending={isSending} />
        </div>
      </footer>
    </div>
  );
}
