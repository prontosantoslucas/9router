"use client";

import React, { useState, useRef, useEffect } from "react";
import { DropOverlay } from "@/shared/components/primitives/DropOverlay";
import { ToastProvider, useToast } from "@/shared/components/primitives/Toast";
import { MessageBubble } from "@/shared/components/primitives/MessageBubble";
import { useFileUpload } from "@/app/chat/hooks/useFileUpload";
import { ChatComposer } from "@/shared/components/primitives/ChatComposer";
import { CoderWorkspace } from "@/app/chat/components/CoderWorkspace";
import { enhanceUserPrompt, processOpenClaudePrompt } from "@/lib/coder/openclaudeEngine";

/**
 * /coder em DUAS COLUNAS (estilo Bolt):
 *  - Esquerda: chat com histórico da conversa + composer (única entrada de prompt).
 *  - Direita: CoderWorkspace (arquivos / editor / preview / terminal).
 * O preview vive dentro do painel direito, então NÃO cobre mais o chat.
 */
export default function CoderPageClient() {
  return (
    <ToastProvider>
      <CoderShell />
    </ToastProvider>
  );
}

let msgSeq = 0;
const nextId = () => `m${Date.now()}_${msgSeq++}`;

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
  const [messages, setMessages] = useState([]);
  const [lastError, setLastError] = useState(null);
  const [fixAttempts, setFixAttempts] = useState(0);
  const MAX_AUTOFIX = 3;

  const messagesEndRef = useRef(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  const pushMessage = (role, content) =>
    setMessages((prev) => [...prev, { id: nextId(), role, content, timestamp: Date.now() }]);

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

  // Núcleo compartilhado por geração normal e por auto-correção.
  const runGeneration = async (prompt, { isFix = false } = {}) => {
    if (!prompt || isGenerating) return;
    setLastError(null);
    setIsGenerating(true);
    setStatusText(isFix ? "Corrigindo..." : "Iniciando geração...");
    setCoderLogs((prev) => [...prev, { type: "command", text: `${isFix ? "Fix" : "Prompt"}: ${prompt.slice(0, 60)}...` }]);
    try {
      const { message } = await processOpenClaudePrompt({
        prompt,
        currentFiles: coderFiles,
        onStreamMessage: (msg) => setStatusText(msg),
        onTerminalLog: (log) => setCoderLogs((prev) => [...prev, log]),
        onUpdateFiles: (newFiles) => setCoderFiles(newFiles),
      });
      pushMessage(
        "assistant",
        message || (isFix ? "Correção aplicada. Verifique o preview." : "Projeto gerado. Veja os arquivos e o preview ao lado.")
      );
    } catch (err) {
      setCoderLogs((prev) => [...prev, { type: "error", text: `Erro Coder: ${err.message}` }]);
      pushMessage("assistant", `❌ Não consegui ${isFix ? "corrigir" : "gerar"}: ${err.message}`);
      showToast({ kind: "error", text: `Erro: ${err.message}` });
    } finally {
      setIsGenerating(false);
      setStatusText("");
    }
  };

  const handleSend = async (text) => {
    const prompt = (text ?? draftText).trim();
    if (!prompt || isGenerating) return;
    setDraftText("");
    setFixAttempts(0); // novo pedido zera o contador de auto-correções
    pushMessage("user", prompt);
    await runGeneration(prompt);
  };

  // Loop de auto-correção: reenvia o erro do preview + arquivos atuais pro modelo.
  // Limitado a MAX_AUTOFIX por pedido para não entrar em ciclo infinito de tokens.
  const handleAutoFix = async () => {
    if (!lastError || isGenerating) return;
    if (fixAttempts >= MAX_AUTOFIX) {
      showToast({ kind: "info", text: "Limite de correções automáticas atingido. Ajuste manualmente ou reescreva o pedido." });
      return;
    }
    setFixAttempts((n) => n + 1);
    const err = lastError;
    pushMessage("user", "Corrigir automaticamente o erro do preview.");
    const fixPrompt = `O preview da aplicação quebrou com o erro abaixo. Corrija APENAS os arquivos necessários, mantendo o resto intacto.\n\nERRO DO PREVIEW:\n${err}\n\nResponda SOMENTE com blocos de arquivo no formato path=..., com o conteúdo COMPLETO de cada arquivo alterado.`;
    await runGeneration(fixPrompt, { isFix: true });
  };

  // Sinais do preview (iframe) via CoderWorkspace.
  const handlePreviewError = (text) => { if (!isGenerating) setLastError(text); };
  const handlePreviewReady = () => setLastError(null);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex h-full w-full flex-col overflow-hidden bg-bg text-text-main"
    >
      <DropOverlay isDragging={isDragging} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        {/* ── ESQUERDA: chat com histórico ── */}
        <aside className="flex min-h-0 w-full shrink-0 flex-col border-b border-border bg-surface md:h-full md:w-[380px] md:border-b-0 md:border-r dark:bg-surface-2">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
            <span className="material-symbols-outlined text-base text-brand-500">code</span>
            <h2 className="truncate text-sm font-bold">Coder — {coderProjectName}</h2>
          </header>

          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                <span className="material-symbols-outlined mb-2 text-3xl text-text-muted">forum</span>
                <p className="text-sm font-semibold text-text-main">Descreva sua ideia</p>
                <p className="mt-1 text-xs text-text-muted">
                  O Coder gera o projeto em React/Tailwind e o preview aparece ao lado.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
                {isGenerating && (
                  <div className="flex items-center gap-2 px-1 text-xs italic text-text-muted" aria-live="polite">
                    <span className="material-symbols-outlined animate-spin text-sm text-brand-500">sync</span>
                    <span className="truncate">{statusText || "Gerando..."}</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Barra de auto-correção: aparece quando o preview reporta erro */}
          {lastError && !isGenerating && (
            <div className="shrink-0 border-t border-danger/30 bg-danger/5 p-3">
              <div className="flex items-center gap-2 text-xs text-danger">
                <span className="material-symbols-outlined text-sm">error</span>
                <span className="min-w-0 flex-1 truncate">
                  Preview com erro.{fixAttempts >= MAX_AUTOFIX ? " Limite de auto-correções atingido." : ""}
                </span>
                <button
                  type="button"
                  onClick={handleAutoFix}
                  disabled={fixAttempts >= MAX_AUTOFIX}
                  className="shrink-0 rounded-md bg-danger px-2.5 py-1 text-[11px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <span className="material-symbols-outlined mr-1 align-[-2px] text-[13px]">auto_fix_high</span>
                  Corrigir automaticamente
                </button>
              </div>
            </div>
          )}

          {/* Composer (única entrada do Coder) */}
          <div className="shrink-0 space-y-2 border-t border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleEnhancePrompt}
                className="flex items-center gap-1.5 text-[11px] font-bold text-brand-500 hover:underline"
              >
                <span className="material-symbols-outlined text-sm">auto_fix_high</span>
                <span>Melhorar meu prompt</span>
              </button>
              <span className="font-mono text-[10px] text-text-muted">Coder Mode</span>
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
              placeholder="Descreva a aplicação ou alteração desejada..."
            />
          </div>
        </aside>

        {/* ── DIREITA: workspace (arquivos / editor / preview / terminal) ── */}
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <CoderWorkspace
            files={coderFiles}
            setFiles={setCoderFiles}
            terminalLogs={coderLogs}
            setTerminalLogs={setCoderLogs}
            projectName={coderProjectName}
            setProjectName={setCoderProjectName}
            standalone={false}
            onPreviewError={handlePreviewError}
            onPreviewReady={handlePreviewReady}
          />
        </div>
      </div>
    </div>
  );
}
