"use client";

import React, { useState } from "react";
import { DropOverlay } from "@/shared/components/primitives/DropOverlay";
import { ToastProvider, useToast } from "@/shared/components/primitives/Toast";
import { useFileUpload } from "@/app/chat/hooks/useFileUpload";
import { ChatComposer } from "@/shared/components/primitives/ChatComposer";
import { CoderWorkspace } from "@/app/chat/components/CoderWorkspace";
import { enhanceUserPrompt, processOpenClaudePrompt } from "@/lib/coder/openclaudeEngine";

/**
 * Standalone /coder page: SOMENTE o Coder (sem coluna de chat). O workspace
 * ocupa toda a largura e o prompt vive num composer fixo no rodape, que
 * dispara o motor OpenClaude (geracao/streaming). O Chat geral fica em /chat.
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
  const { uploadFile, isUploading } = useFileUpload();

  const [isDragging, setIsDragging] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [coderFiles, setCoderFiles] = useState([]);
  const [coderProjectName, setCoderProjectName] = useState("Nova Aplicação");
  const [coderLogs, setCoderLogs] = useState([
    { type: "info", text: "Ambiente Coder inicializado com motor OpenClaude." },
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
      const text = result.text || result.transcript || "";
      if (text) setDraftText((prev) => `${prev}\n\n[Anexo: ${result.filename || file.name}]\n${text}`.trim());
    } catch (err) {
      showToast({ kind: "error", text: `Falha no upload: ${err.message}` });
    }
  };

  const handleEnhancePrompt = () => {
    const raw = draftText.trim() || "Criar uma aplicação web moderna do zero";
    setDraftText(enhanceUserPrompt(raw));
  };

  const handleSend = async (text) => {
    const prompt = (text ?? draftText).trim();
    if (!prompt || isGenerating) return;
    setDraftText("");
    setIsGenerating(true);
    setStatusText("Iniciando geração...");
    setCoderLogs((prev) => [...prev, { type: "command", text: `Prompt: ${prompt.slice(0, 60)}...` }]);
    try {
      const { message } = await processOpenClaudePrompt({
        prompt,
        currentFiles: coderFiles,
        onStreamMessage: (msg) => setStatusText(msg),
        onTerminalLog: (log) => setCoderLogs((prev) => [...prev, log]),
        onUpdateFiles: (newFiles) => setCoderFiles(newFiles),
      });
      // Sem coluna de chat aqui, o resumo do modelo vai para o terminal —
      // caso contrário a explicação do que foi construído se perderia.
      if (message) setCoderLogs((prev) => [...prev, { type: "success", text: message }]);
    } catch (err) {
      setCoderLogs((prev) => [...prev, { type: "error", text: `Erro Coder: ${err.message}` }]);
      showToast({ kind: "error", text: `Erro na geração: ${err.message}` });
    } finally {
      setIsGenerating(false);
      setStatusText("");
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

      {/* Workspace ocupa toda a largura */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <CoderWorkspace
          files={coderFiles}
          setFiles={setCoderFiles}
          terminalLogs={coderLogs}
          setTerminalLogs={setCoderLogs}
          projectName={coderProjectName}
          setProjectName={setCoderProjectName}
          standalone
        />
      </div>

      {/* Composer fixo no rodapé (única entrada do Coder) */}
      <footer className="shrink-0 border-t border-border bg-surface p-3 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 dark:bg-surface-2 space-y-2">
        <div className="mx-auto max-w-4xl space-y-2">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1">
            <button
              type="button"
              onClick={handleEnhancePrompt}
              className="flex items-center gap-1.5 text-[11px] font-bold text-brand-500 hover:underline"
            >
              <span className="material-symbols-outlined text-sm">auto_fix_high</span>
              <span>Melhorar meu prompt com base na minha ideia</span>
            </button>
            {isGenerating ? (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-500">
                <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                <span className="truncate max-w-[260px]">{statusText || "Gerando..."}</span>
              </span>
            ) : (
              <span className="font-mono text-[10px] text-text-muted">Coder Mode</span>
            )}
          </div>

          {isUploading && (
            <div className="flex items-center gap-2 text-xs text-brand-500" aria-live="polite">
              <span className="material-symbols-outlined animate-spin text-sm">sync</span>
              <span>Processando arquivo...</span>
            </div>
          )}

          <ChatComposer
            value={draftText}
            onChange={setDraftText}
            onSend={handleSend}
            onUpload={handleUpload}
            isSending={isGenerating}
            placeholder="Descreva a aplicação ou alteração de código desejada..."
          />
        </div>
      </footer>
    </div>
  );
}