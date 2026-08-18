"use client";

import React, { useState, useRef, useEffect } from "react";
import { DropOverlay } from "@/shared/components/primitives/DropOverlay";
import { ToastProvider, useToast } from "@/shared/components/primitives/Toast";
import { MessageBubble } from "@/shared/components/primitives/MessageBubble";
import { useFileUpload } from "@/app/chat/hooks/useFileUpload";
import { ChatComposer } from "@/shared/components/primitives/ChatComposer";
import { CoderWorkspace } from "@/app/chat/components/CoderWorkspace";
import { enhanceUserPrompt, processOpenClaudePrompt } from "@/lib/coder/openclaudeEngine";
import { saveCheckpoint } from "@/lib/coder/checkpointStore";

export default function CoderPageClient() {
  return (
    <ToastProvider>
      <CoderShell />
    </ToastProvider>
  );
}

let msgSeq = 0;
const nextId = () => `m${Date.now()}_${msgSeq++}`;

const MODELO_PADRAO = "auto";
const CHAVE_MODELO = "coder_modelo";

function useModelos() {
  const [modelos, setModelos] = useState([]);
  const [modelo, setModelo] = useState(MODELO_PADRAO);

  useEffect(() => {
    let vivo = true;
    fetch("/api/combos")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivo) return;
        const auto = d?.combos?.find((c) => c.name === "auto");
        const lista = Array.isArray(auto?.models) ? auto.models : [];
        setModelos(lista);

        let salvo = null;
        try { salvo = localStorage.getItem(CHAVE_MODELO); } catch {}
        if (salvo && (salvo === MODELO_PADRAO || lista.includes(salvo))) setModelo(salvo);
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  const escolher = (m) => {
    setModelo(m);
    try { localStorage.setItem(CHAVE_MODELO, m); } catch {}
  };

  return { modelos, modelo, escolher };
}

function CoderShell() {
  const { modelos, modelo, escolher } = useModelos();
  const { showToast } = useToast();
  const { uploadFile, isUploading } = useFileUpload();

  const [isDragging, setIsDragging] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [executionStep, setExecutionStep] = useState(0); // 0: Idle, 1: Planning, 2: Coding, 3: Assembling, 4: Done
  const [selectedTargetElement, setSelectedTargetElement] = useState(null); // Click-to-Edit

  const [coderFiles, setCoderFiles] = useState([]);
  const [coderProjectName, setCoderProjectName] = useState("Nova Aplicação");
  const [coderLogs, setCoderLogs] = useState([
    { type: "info", text: "Ambiente Coder Lovable inicializado com motor OpenClaude." },
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

  // Núcleo compartilhado por geração normal e por auto-correção
  const runGeneration = async (prompt, { isFix = false } = {}) => {
    if (!prompt || isGenerating) return;
    setLastError(null);
    setIsGenerating(true);
    setExecutionStep(1); // Planning
    setStatusText(isFix ? "Analisando erro do preview..." : "Planejando arquitetura da aplicação...");
    setCoderLogs((prev) => [...prev, { type: "command", text: `${isFix ? "Fix" : "Prompt"}: ${prompt.slice(0, 60)}...` }]);

    try {
      let finalFiles = coderFiles;
      setExecutionStep(2); // Generating files
      const { message } = await processOpenClaudePrompt({
        prompt,
        currentFiles: coderFiles,
        model: modelo,
        onStreamMessage: (msg) => {
          setStatusText(msg);
          if (msg.includes("Gerando") || msg.includes("Criando")) setExecutionStep(2);
          else if (msg.includes("Atualizando") || msg.includes("Validando")) setExecutionStep(3);
        },
        onTerminalLog: (log) => setCoderLogs((prev) => [...prev, log]),
        onUpdateFiles: (newFiles) => {
          finalFiles = newFiles;
          setCoderFiles(newFiles);
        },
      });

      setExecutionStep(4); // Done
      // Salva snapshot no histórico de checkpoints (Lovable Version History)
      saveCheckpoint(coderProjectName, prompt, finalFiles);

      pushMessage(
        "assistant",
        message || (isFix ? "Correção aplicada com sucesso no preview." : "Aplicação gerada com sucesso! Veja o preview interativo e os arquivos.")
      );
    } catch (err) {
      setCoderLogs((prev) => [...prev, { type: "error", text: `Erro Coder: ${err.message}` }]);
      pushMessage("assistant", `❌ Não consegui ${isFix ? "corrigir" : "gerar"}: ${err.message}`);
      showToast({ kind: "error", text: `Erro: ${err.message}` });
    } finally {
      setIsGenerating(false);
      setStatusText("");
      setTimeout(() => setExecutionStep(0), 4000);
    }
  };

  const handleSend = async (text) => {
    let prompt = (text ?? draftText).trim();
    if (!prompt || isGenerating) return;

    if (selectedTargetElement) {
      prompt = `[Alvo Selecionado no Preview: <${selectedTargetElement.tag}> "${selectedTargetElement.text}" (classe: ${selectedTargetElement.classes})]\n${prompt}`;
      setSelectedTargetElement(null);
    }

    setDraftText("");
    setFixAttempts(0);
    pushMessage("user", prompt);
    await runGeneration(prompt);
  };

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

  const handleRestoreCheckpoint = (cp) => {
    if (!cp || !Array.isArray(cp.files)) return;
    setCoderFiles(cp.files);
    pushMessage("assistant", `⏪ Checkpoint restaurado para a versão de ${new Date(cp.timestamp).toLocaleTimeString()} ("${cp.prompt}").`);
    showToast({ kind: "success", text: `Versão restaurada com ${cp.files.length} arquivos.` });
  };

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
        {/* ── ESQUERDA: Chat & Execution Steps (Padrão Lovable) ── */}
        <aside className="flex min-h-0 w-full shrink-0 flex-col border-b border-border bg-surface md:h-full md:w-[380px] md:border-b-0 md:border-r dark:bg-surface">
          {/* Header do Coder */}
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3.5">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("open-sidebar-menu"));
                  }
                }}
                className="lg:hidden flex items-center justify-center size-8 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors -ml-1 mr-1"
                aria-label="Abrir menu lateral"
                title="Abrir menu"
              >
                <span className="material-symbols-outlined text-[20px]">menu</span>
              </button>
              <div className="flex items-center justify-center size-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 text-white font-bold shadow-soft">
                <span className="material-symbols-outlined text-[17px]">auto_fix_high</span>
              </div>
              <h2 className="truncate text-xs font-bold font-display text-text-main">
                Coder do Lucas
              </h2>
            </div>

            {/* Seletor de Modelo */}
            {modelos.length > 0 && (
              <select
                value={modelo}
                onChange={(e) => escolher(e.target.value)}
                className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-main focus:border-brand-500 focus:outline-none max-w-[130px] truncate"
                title="Modelo de IA utilizado"
              >
                <option value="auto">⚡ Auto (Melhor)</option>
                {modelos.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
          </header>

          {/* Execution Steps Live Checklist (Lovable Workflow) */}
          {executionStep > 0 && (
            <div className="shrink-0 p-3 bg-surface-2 border-b border-border space-y-1.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-[11px] font-bold text-brand-400 uppercase tracking-wider">
                <span>Progresso de Geração</span>
                <span className="text-[10px] text-text-muted">{statusText || "Processando..."}</span>
              </div>
              <div className="space-y-1 text-xs">
                {[
                  { step: 1, label: "Planejando componentes e arquitetura" },
                  { step: 2, label: "Gerando código React e estilos Tailwind" },
                  { step: 3, label: "Validando Virtual File System e dependências" },
                  { step: 4, label: "Preview atualizado em tempo real" },
                ].map((s) => (
                  <div key={s.step} className="flex items-center gap-2">
                    {executionStep > s.step ? (
                      <span className="material-symbols-outlined text-[14px] text-emerald-400">check_circle</span>
                    ) : executionStep === s.step ? (
                      <span className="material-symbols-outlined text-[14px] text-brand-500 animate-spin">sync</span>
                    ) : (
                      <span className="material-symbols-outlined text-[14px] text-text-muted/40">radio_button_unchecked</span>
                    )}
                    <span className={executionStep >= s.step ? "text-text-main font-medium" : "text-text-muted/60"}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Histórico de Mensagens */}
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-4 text-center space-y-3 my-8">
                <div className="flex items-center justify-center size-12 rounded-2xl bg-brand-500/10 text-brand-500 border border-brand-500/20">
                  <span className="material-symbols-outlined text-[26px]">prompt_suggestion</span>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-text-main">O que vamos construir hoje?</p>
                  <p className="text-xs text-text-muted leading-relaxed max-w-xs">
                    Crie dashboards, landing pages, sistemas SaaS ou apps interativos com componentes prontos e backend Supabase.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-1.5 w-full pt-2">
                  {[
                    "Landing page moderna de SaaS com gráficos de conversão",
                    "Dashboard de gestão de tarefas com Kanban e tema escuro",
                    "Calculadora financeira interativa com exportação PDF",
                  ].map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => handleSend(sug)}
                      className="text-left p-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-xs text-text-muted hover:text-text-main transition-colors truncate"
                    >
                      💡 {sug}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
                {isGenerating && (
                  <div className="flex items-center gap-2 px-2 text-xs italic text-text-muted" aria-live="polite">
                    <span className="material-symbols-outlined animate-spin text-sm text-brand-500">sync</span>
                    <span className="truncate">{statusText || "Gerando..."}</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Barra de Auto-correção */}
          {lastError && !isGenerating && (
            <div className="shrink-0 border-t border-danger/30 bg-danger/5 p-3">
              <div className="flex items-center gap-2 text-xs text-danger">
                <span className="material-symbols-outlined text-sm">error</span>
                <span className="min-w-0 flex-1 truncate">
                  Preview com erro.{fixAttempts >= MAX_AUTOFIX ? " Limite de correções atingido." : ""}
                </span>
                <button
                  type="button"
                  onClick={handleAutoFix}
                  disabled={fixAttempts >= MAX_AUTOFIX}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-danger px-2.5 py-1 text-xs font-bold text-white shadow-soft hover:opacity-90 disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-xs">auto_fix_high</span>
                  <span>Corrigir com IA</span>
                </button>
              </div>
            </div>
          )}

          {/* Click-to-Edit Target Chip */}
          {selectedTargetElement && (
            <div className="px-3 py-2 bg-brand-500/10 border-t border-brand-500/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="material-symbols-outlined text-brand-500 text-[16px]">ads_click</span>
                <span className="font-bold text-brand-400 truncate">
                  Alvo: &lt;{selectedTargetElement.tag}&gt; &quot;{selectedTargetElement.text || selectedTargetElement.selector}&quot;
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTargetElement(null)}
                className="text-text-muted hover:text-text-main text-xs"
                title="Remover alvo"
              >
                ✕
              </button>
            </div>
          )}

          {/* Composer do Chat */}
          <div className="shrink-0 border-t border-border p-3 bg-surface">
            <ChatComposer
              draftText={draftText}
              setDraftText={setDraftText}
              onSend={handleSend}
              onUpload={handleUpload}
              isUploading={isUploading}
              isLoading={isGenerating}
              onEnhancePrompt={handleEnhancePrompt}
              placeholder={
                selectedTargetElement
                  ? `Diga o que alterar em <${selectedTargetElement.tag}>...`
                  : "Descreva sua ideia para gerar ou editar..."
              }
            />
          </div>
        </aside>

        {/* ── DIREITA: CoderWorkspace (Editor, Preview, Viewports, Supabase) ── */}
        <main className="min-h-0 flex-1 overflow-hidden">
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
            onSelectElement={(elem) => {
              setSelectedTargetElement(elem);
              showToast({ kind: "info", text: `Elemento <${elem.tag}> selecionado para edição.` });
            }}
            onPromptSchema={(prompt) => handleSend(prompt)}
            onRestoreCheckpoint={handleRestoreCheckpoint}
          />
        </main>
      </div>
    </div>
  );
}
