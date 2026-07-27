"use client";

import React, { useState } from "react";
import { DropOverlay } from "@/shared/components/primitives/DropOverlay";
import { ToastProvider, useToast } from "@/shared/components/primitives/Toast";
import { useChatSession } from "@/app/chat/hooks/useChatSession";
import { useFileUpload } from "@/app/chat/hooks/useFileUpload";
import { CoderChatPanel } from "@/app/chat/components/CoderChatPanel";
import { CoderWorkspace } from "@/app/chat/components/CoderWorkspace";

/**
 * Standalone /coder page. Thin shell around the same CoderChatPanel +
 * CoderWorkspace pair used by /chat?mode=coder — same coder session id
 * ("coder"), so conversation history is shared between both entry points.
 * DashboardLayout/Header already provides the app chrome; this page owns
 * only the coder-specific split view.
 */
export default function CoderPageClient() {
  return (
    <ToastProvider>
      <CoderShell />
    </ToastProvider>
  );
}

function CoderShell() {
  const { showToast } = useToast();
  const coderSession = useChatSession("coder");
  const { uploadFile, isUploading } = useFileUpload();

  const [isDragging, setIsDragging] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [coderFiles, setCoderFiles] = useState([]);
  const [coderProjectName, setCoderProjectName] = useState("Nova Aplicação");
  const [coderLogs, setCoderLogs] = useState([
    { type: "info", text: "Ambiente Coder do zero inicializado com motor OpenClaude." },
  ]);

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
      showToast({ kind: "error", text: `Falha no upload: ${err.message}` });
    }
  };

  const handleSaveNotion = async () => {
    showToast({ kind: "info", text: "Salvar no Notion está disponível a partir do Chat Geral." });
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex h-full w-full overflow-hidden bg-bg text-text-main"
    >
      <DropOverlay isDragging={isDragging} />

      {/* Left Column: Coder Chat Panel (sessão dedicada + motor OpenClaude) */}
      <div className="flex h-full w-full shrink-0 flex-col border-r border-border md:w-[420px]">
        <CoderChatPanel
          session={coderSession}
          coderFiles={coderFiles}
          onUpdateFiles={setCoderFiles}
          onTerminalLog={setCoderLogs}
          onSaveNotion={handleSaveNotion}
          attachments={attachments}
          onRemoveAttachment={(i) => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
          onClearAttachments={() => setAttachments([])}
          isUploading={isUploading}
          onUpload={handleUpload}
        />
      </div>

      {/* Right Column: Coder Workspace */}
      <div className="hidden h-full flex-1 overflow-hidden md:flex">
        <CoderWorkspace
          files={coderFiles}
          setFiles={setCoderFiles}
          terminalLogs={coderLogs}
          setTerminalLogs={setCoderLogs}
          projectName={coderProjectName}
          setProjectName={setCoderProjectName}
        />
      </div>
    </div>
  );
}
