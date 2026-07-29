"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import PropTypes from "prop-types";
import FileExplorer from "@/app/coder/components/FileExplorer";
import TerminalPanel from "@/app/coder/components/TerminalPanel";
import ProjectsModal from "@/app/coder/components/ProjectsModal";
import SupabaseModal from "@/app/coder/components/SupabaseModal";
import GitHubCommitModal from "@/app/coder/components/GitHubCommitModal";
import { downloadProjectAsZip } from "@/lib/coder/zipExporter";
import { getSupabaseConfig, fetchCoderConnections } from "@/lib/coder/supabaseClient";
import { buildPreviewDoc } from "@/lib/coder/previewBuilder";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });


export function CoderWorkspace({
  files = [],
  setFiles,
  terminalLogs = [],
  setTerminalLogs,
  projectName = "Nova Aplicação",
  setProjectName,
  standalone = false,
  onPreviewError,
  onPreviewReady,
}) {
  const [viewMode, setViewMode] = useState("preview"); // "code" | "preview"
  const [selectedFilePath, setSelectedFilePath] = useState("src/App.tsx");
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);


  // Modals state
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [isSupabaseOpen, setIsSupabaseOpen] = useState(false);
  const [isGitHubOpen, setIsGitHubOpen] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState(false);

  // O banco e a fonte de verdade (sobrevive a troca de navegador/maquina); o
  // localStorage entra so como fallback offline. Roda em efeito, e nao em
  // inicializador de useState, porque ler localStorage durante o SSR devolve
  // vazio e causaria divergencia de hidratacao. Reavalia ao fechar o modal
  // para o badge refletir a conexao recem-salva.
  useEffect(() => {
    if (isSupabaseOpen) return;
    let cancelled = false;
    (async () => {
      const conn = await fetchCoderConnections();
      if (cancelled) return;
      if (conn?.supabaseUrl) {
        setSupabaseConnected(true);
        return;
      }
      const cfg = getSupabaseConfig();
      setSupabaseConnected(!!cfg?.supabaseUrl);
    })();
    return () => { cancelled = true; };
  }, [isSupabaseOpen]);

  // Erros do Preview (iframe) chegam via postMessage e vão pro Terminal, para
  // ficarem visíveis (antes morriam dentro do iframe) e servirem de base para
  // a auto-correção. Só reage a mensagens do nosso preview.
  useEffect(() => {
    function onMsg(ev) {
      const d = ev?.data;
      if (!d || !d.__coderPreview) return;
      if (d.type === "error" && d.payload) {
        onPreviewError?.(String(d.payload));
        if (setTerminalLogs) {
          setTerminalLogs((prev) => {
            const text = `Preview: ${String(d.payload).slice(0, 400)}`;
            if (prev[prev.length - 1]?.text === text) return prev; // evita spam
            return [...prev, { type: "error", text }];
          });
        }
      } else if (d.type === "ready") {
        onPreviewReady?.();
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [setTerminalLogs, onPreviewError, onPreviewReady]);

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



  // Renderiza a página em HTML para o iframe do Preview ao vivo
  const generatePreviewHTML = () => buildPreviewDoc(files, projectName || "Aplicação Coder");

  // Sem arquivos ainda: estado vazio. Este painel só mostra Preview/Código/
  // Terminal — a entrada de prompt vive fora dele (no composer do rodapé
  // quando `standalone`, ou na coluna de chat quando embutido).
  if (files.length === 0) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center h-full w-full bg-bg text-text-main p-8 select-none ${standalone ? "" : "border-l border-border"}`}>
        <div className="max-w-sm text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-500 text-xs font-bold uppercase tracking-wider">
            <span className="material-symbols-outlined text-sm">code</span>
            <span>Coder IDE do Agente Lucas</span>
          </div>
          <div className="w-16 h-16 mx-auto rounded-2xl bg-surface border border-border flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl text-text-muted">terminal</span>
          </div>
          <h2 className="text-lg font-extrabold text-text-main">Nenhum projeto ainda</h2>
          <p className="text-sm text-text-muted leading-relaxed">
            Descreva sua ideia {standalone ? "no campo abaixo" : "no chat ao lado"} e o Coder vai gerar
            o projeto em React/Tailwind. O Preview ao vivo aparece aqui automaticamente.
          </p>
          <div className="flex items-center justify-center gap-1.5 text-xs text-brand-500 font-semibold">
            <span className="material-symbols-outlined text-sm">
              {standalone ? "arrow_downward" : "arrow_back"}
            </span>
            <span>{standalone ? "Comece pelo composer" : "Comece pelo chat"}</span>
          </div>
        </div>
      </div>
    );
  }
  // Se houver arquivos gerados, exibe o Coder IDE completo
  return (
    <div className={`flex flex-col h-full w-full bg-bg text-text-main overflow-hidden font-sans select-none ${standalone ? "" : "border-l border-border"}`}>
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
  standalone: PropTypes.bool,
  onPreviewError: PropTypes.func,
  onPreviewReady: PropTypes.func,
};

function getLanguage(filename = "") {
  if (filename.endsWith(".tsx") || filename.endsWith(".ts")) return "typescript";
  if (filename.endsWith(".jsx") || filename.endsWith(".js")) return "javascript";
  if (filename.endsWith(".css")) return "css";
  if (filename.endsWith(".html")) return "html";
  if (filename.endsWith(".json")) return "json";
  return "plaintext";
}

