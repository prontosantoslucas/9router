"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import PropTypes from "prop-types";
import FileExplorer from "@/app/coder/components/FileExplorer";
import TerminalPanel from "@/app/coder/components/TerminalPanel";
import ProjectsModal from "@/app/coder/components/ProjectsModal";
import SupabaseModal from "@/app/coder/components/SupabaseModal";
import GitHubCommitModal from "@/app/coder/components/GitHubCommitModal";
import { enhanceUserPrompt, processOpenClaudePrompt } from "@/lib/coder/openclaudeEngine";
import { downloadProjectAsZip } from "@/lib/coder/zipExporter";
import { getSupabaseConfig } from "@/lib/coder/supabaseClient";
import { buildPreviewDoc } from "@/lib/coder/previewBuilder";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const STARTER_SUGGESTIONS = [
  {
    icon: "content_cut",
    title: "Barbearia & Agendamentos",
    desc: "Sistema de agendamento de cortes e serviços em tempo real.",
    prompt: "Criar um sistema de agendamento online de barbearia com escolha de profissional, horário e lista de serviços.",
  },
  {
    icon: "insights",
    title: "Dashboard SaaS Metrics",
    desc: "Painel financeiro com gráficos de MRR, assinantes e churn.",
    prompt: "Criar um dashboard SaaS completo de métricas com visão geral de receita, gráfico de crescimento e tabela de clientes.",
  },
  {
    icon: "restaurant",
    title: "Food Delivery & Cardápio",
    desc: "App de restaurante com carrinho de compras e rastreamento.",
    prompt: "Criar uma plataforma de delivery de comida com cardápio por categorias, carrinho de compras e acompanhamento de pedido.",
  },
  {
    icon: "check_box",
    title: "Gestor de Tarefas Kanban",
    desc: "Organizador de projetos estilo Trello com colunas interativas.",
    prompt: "Criar um quadro Kanban de tarefas com colunas 'A Fazer', 'Em Progresso' e 'Concluído', permitindo adicionar novos itens.",
  },
];

export function CoderWorkspace({
  files = [],
  setFiles,
  terminalLogs = [],
  setTerminalLogs,
  projectName = "Nova Aplicação",
  setProjectName,
}) {
  const [viewMode, setViewMode] = useState("preview"); // "code" | "preview"
  const [selectedFilePath, setSelectedFilePath] = useState("src/App.tsx");
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);

  // Home / Prompt state
  const [ideaInput, setIdeaInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState("");

  // Modals state
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [isSupabaseOpen, setIsSupabaseOpen] = useState(false);
  const [isGitHubOpen, setIsGitHubOpen] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState(false);

  useEffect(() => {
    const cfg = getSupabaseConfig();
    if (cfg && cfg.supabaseUrl) setSupabaseConnected(true);
  }, []);

  const selectedFile = files.find((f) => f.path === selectedFilePath) || files[0];

  const handleFileChange = (newContent) => {
    if (setFiles) {
      setFiles((prev) =>
        prev.map((f) => (f.path === selectedFilePath ? { ...f, content: newContent } : f))
      );
    }
  };

  const handleDownloadZip = () => {
    downloadProjectAsZip(projectName || "Projeto-9router", files);
    if (setTerminalLogs) {
      setTerminalLogs((prev) => [
        ...prev,
        { type: "success", text: `✓ Download do projeto ${projectName || "Projeto-9router"}.zip iniciado.` },
      ]);
    }
  };

  // Recurso "Melhorar meu prompt com base na minha ideia"
  const handleEnhancePrompt = () => {
    if (!ideaInput.trim()) return;
    const enhanced = enhanceUserPrompt(ideaInput);
    setIdeaInput(enhanced);
  };

  // Gerar aplicação do zero
  const handleGenerateApp = async (customPrompt) => {
    const targetPrompt = customPrompt || ideaInput;
    if (!targetPrompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setStatusText("Iniciando geração...");

    try {
      await processOpenClaudePrompt({
        prompt: targetPrompt,
        currentFiles: files,
        onStreamMessage: (msg) => setStatusText(msg),
        onTerminalLog: (log) => {
          if (setTerminalLogs) setTerminalLogs((prev) => [...prev, log]);
        },
        onUpdateFiles: (newFiles) => {
          if (setFiles) setFiles(newFiles);
          if (newFiles.length > 0) setSelectedFilePath(newFiles[0].path);
        },
      });

      // Alterna automaticamente para o Preview ao vivo
      setViewMode("preview");
    } catch (err) {
      if (setTerminalLogs) {
        setTerminalLogs((prev) => [...prev, { type: "error", text: `Erro na geração: ${err.message}` }]);
      }
    } finally {
      setIsGenerating(false);
      setStatusText("");
    }
  };

  // Renderiza a página em HTML para o iframe do Preview ao vivo
  const generatePreviewHTML = () => buildPreviewDoc(files, projectName || "Aplicação Coder");

  // Se não houver arquivos gerados (Projeto do Zero), exibe a Tela de Boas-Vindas & Sugestões
  if (files.length === 0) {
    return (
      <div className="flex-1 flex flex-col h-full w-full bg-bg text-text-main overflow-y-auto p-4 sm:p-8 font-sans select-none custom-scrollbar">
        <div className="max-w-3xl mx-auto w-full space-y-6 my-auto">
          {/* Header da Tela Inicial */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-500 text-xs font-bold uppercase tracking-wider">
              <span className="material-symbols-outlined text-sm">auto_awesome</span>
              <span>Coder IDE do Agente Lucas</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-text-main tracking-tight">
              O que você deseja construir hoje?
            </h1>
            <p className="text-sm text-text-muted max-w-xl mx-auto">
              Descreva sua ideia abaixo. O Coder criará primeiro o **Frontend** em React/Tailwind e depois a estrutura do **Backend localhost**, exibindo tudo no Preview ao vivo.
            </p>
          </div>

          {/* Prompt Form Container */}
          <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-elevated space-y-4">
            <textarea
              rows={4}
              placeholder="Ex: Quero um sistema de agendamento de barbearia com seleção de horários e lista de serviços..."
              value={ideaInput}
              onChange={(e) => setIdeaInput(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl p-3.5 text-xs text-text-main focus:outline-none focus:border-brand-500 placeholder-text-muted resize-none font-sans"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handleEnhancePrompt}
                disabled={!ideaInput.trim() || isGenerating}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-500 hover:bg-brand-500/20 text-xs font-bold transition-all disabled:opacity-40"
                title="Expande sua ideia simples em uma especificação técnica completa"
              >
                <span className="material-symbols-outlined text-sm">auto_fix_high</span>
                <span>Melhorar meu prompt com base na minha ideia</span>
              </button>

              <button
                type="button"
                onClick={() => handleGenerateApp()}
                disabled={!ideaInput.trim() || isGenerating}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-all shadow-warm disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-base">rocket_launch</span>
                <span>{isGenerating ? "Gerando..." : "Gerar Aplicação"}</span>
              </button>
            </div>

            {statusText && (
              <div className="flex items-center gap-2 text-xs font-semibold text-brand-500 animate-pulse pt-2 border-t border-border">
                <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                <span>{statusText}</span>
              </div>
            )}
          </div>

          {/* Cards de Sugestão de Prompts Rápidos */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">lightbulb</span>
              <span>Sugestões Rápidas para Começar</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STARTER_SUGGESTIONS.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setIdeaInput(item.prompt);
                    handleGenerateApp(item.prompt);
                  }}
                  className="p-4 rounded-xl bg-surface border border-border hover:border-brand-500/50 transition-all cursor-pointer group space-y-1.5 shadow-soft hover:shadow-warm"
                >
                  <div className="flex items-center gap-2 text-brand-500">
                    <span className="material-symbols-outlined text-lg">{item.icon}</span>
                    <h4 className="font-bold text-xs text-text-main group-hover:text-brand-500 transition-colors">
                      {item.title}
                    </h4>
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Se houver arquivos gerados, exibe o Coder IDE completo
  return (
    <div className="flex flex-col h-full w-full bg-bg text-text-main overflow-hidden font-sans border-l border-border select-none">
      {/* Coder Toolbar Header */}
      <div className="h-12 border-b border-border bg-surface px-4 flex items-center justify-between text-xs shrink-0">
        {/* Left: Project Selector */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setIsProjectsOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-bg-alt transition-colors font-semibold text-text-main border border-border"
          >
            <span className="material-symbols-outlined text-sm text-brand-500">folder</span>
            <span className="truncate max-w-[140px]">{projectName || "Meu Projeto"}</span>
            <span className="material-symbols-outlined text-[14px] text-text-muted">unfold_more</span>
          </button>
        </div>

        {/* Center: View Switcher (Preview vs Code </>) */}
        <div className="flex items-center bg-bg-alt p-0.5 rounded-lg border border-border">
          <button
            onClick={() => setViewMode("preview")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              viewMode === "preview"
                ? "bg-brand-500 text-white shadow-soft"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">visibility</span>
            <span>Preview</span>
          </button>
          <button
            onClick={() => setViewMode("code")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              viewMode === "code"
                ? "bg-brand-500 text-white shadow-soft"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">code</span>
            <span>Code</span>
          </button>
        </div>

        {/* Right: Supabase, Download ZIP, GitHub Commit */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsSupabaseOpen(true)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-semibold transition-all ${
              supabaseConnected
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : "bg-surface border-border text-text-muted hover:text-text-main"
            }`}
            title="Supabase OAuth"
          >
            <span>⚡</span>
            <span className="hidden sm:inline">{supabaseConnected ? "Supabase OK" : "Supabase"}</span>
          </button>

          <button
            onClick={handleDownloadZip}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface border border-border text-text-muted hover:text-text-main text-xs font-semibold transition-all"
            title="Download em ZIP"
          >
            <span className="material-symbols-outlined text-[15px]">download</span>
            <span className="hidden sm:inline">ZIP</span>
          </button>

          <button
            onClick={() => setIsGitHubOpen(true)}
            className="flex items-center gap-1 px-3 py-1 rounded-md bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs transition-all shadow-soft"
            title="Commit no GitHub"
          >
            <span className="material-symbols-outlined text-[15px]">commit</span>
            <span>Commit</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {viewMode === "code" ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="flex-1 flex overflow-hidden">
              <FileExplorer
                files={files}
                selectedFile={selectedFilePath}
                onSelectFile={(path) => setSelectedFilePath(path)}
              />

              <div className="flex-1 flex flex-col bg-bg overflow-hidden">
                {/* File Path Breadcrumb */}
                <div className="h-8 px-4 border-b border-border bg-bg-alt/50 flex items-center gap-2 text-xs font-mono text-text-muted">
                  <span className="material-symbols-outlined text-[14px]">description</span>
                  <span>{selectedFilePath}</span>
                </div>

                <div className="flex-1 relative">
                  <MonacoEditor
                    height="100%"
                    language={getLanguage(selectedFilePath)}
                    theme="vs-dark"
                    value={selectedFile?.content || ""}
                    onChange={handleFileChange}
                    options={{
                      fontSize: 13,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2,
                      wordWrap: "on",
                    }}
                  />
                </div>
              </div>
            </div>

            <TerminalPanel
              logs={terminalLogs}
              isCollapsed={isTerminalCollapsed}
              onToggleCollapse={() => setIsTerminalCollapsed((v) => !v)}
            />
          </div>
        ) : (
          <div className="flex-1 bg-bg-alt p-4 flex items-center justify-center">
            <iframe
              title="Live Preview"
              srcDoc={generatePreviewHTML()}
              className="w-full h-full border border-border rounded-xl shadow-elevated bg-surface"
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <ProjectsModal
        isOpen={isProjectsOpen}
        onClose={() => setIsProjectsOpen(false)}
        projects={[{ id: "p1", name: projectName || "Meu Projeto Coder", filesCount: files.length }]}
        activeProjectId="p1"
        onSelectProject={() => {}}
        onCreateProject={() => {
          if (setProjectName) setProjectName("Nova Aplicação");
          if (setFiles) setFiles([]);
        }}
      />

      <SupabaseModal isOpen={isSupabaseOpen} onClose={() => setIsSupabaseOpen(false)} />

      <GitHubCommitModal isOpen={isGitHubOpen} onClose={() => setIsGitHubOpen(false)} files={files} />
    </div>
  );
}

CoderWorkspace.propTypes = {
  files: PropTypes.array,
  setFiles: PropTypes.func,
  terminalLogs: PropTypes.array,
  setTerminalLogs: PropTypes.func,
  projectName: PropTypes.string,
  setProjectName: PropTypes.func,
};

function getLanguage(filename = "") {
  if (filename.endsWith(".tsx") || filename.endsWith(".ts")) return "typescript";
  if (filename.endsWith(".jsx") || filename.endsWith(".js")) return "javascript";
  if (filename.endsWith(".css")) return "css";
  if (filename.endsWith(".html")) return "html";
  if (filename.endsWith(".json")) return "json";
  return "plaintext";
}

