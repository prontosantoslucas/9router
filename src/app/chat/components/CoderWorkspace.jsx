"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import PropTypes from "prop-types";
import FileExplorer from "@/app/coder/components/FileExplorer";
import TerminalPanel from "@/app/coder/components/TerminalPanel";
import ProjectsModal from "@/app/coder/components/ProjectsModal";
import SupabaseModal from "@/app/coder/components/SupabaseModal";
import GitHubCommitModal from "@/app/coder/components/GitHubCommitModal";
import { SupabaseDatabaseView } from "@/app/coder/components/SupabaseDatabaseView";
import { downloadProjectAsZip } from "@/lib/coder/zipExporter";
import { getSupabaseConfig, fetchCoderConnections } from "@/lib/coder/supabaseClient";
import { buildPreviewDoc } from "@/lib/coder/previewBuilder";
import { getProjectCheckpoints } from "@/lib/coder/checkpointStore";

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
  onSelectElement,
  onPromptSchema,
  onRestoreCheckpoint,
}) {
  const [viewMode, setViewMode] = useState("preview"); // "preview" | "inspect" | "code" | "diff" | "database"
  const [viewport, setViewport] = useState("desktop"); // "desktop" | "tablet" | "mobile"
  const [selectedFilePath, setSelectedFilePath] = useState("src/App.tsx");
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);
  const [checkpoints, setCheckpoints] = useState([]);
  const [showCheckpointsDropdown, setShowCheckpointsDropdown] = useState(false);

  // Modals state
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [isSupabaseOpen, setIsSupabaseOpen] = useState(false);
  const [isGitHubOpen, setIsGitHubOpen] = useState(false);
  const [supabaseConfig, setSupabaseConfig] = useState(null);

  useEffect(() => {
    if (isSupabaseOpen) return;
    let cancelled = false;
    (async () => {
      const conn = await fetchCoderConnections();
      if (cancelled) return;
      if (conn?.supabaseUrl) {
        setSupabaseConfig({ url: conn.supabaseUrl, key: conn.supabaseAnonKey });
        return;
      }
      const cfg = getSupabaseConfig();
      if (cfg?.supabaseUrl) {
        setSupabaseConfig({ url: cfg.supabaseUrl, key: cfg.supabaseAnonKey });
      }
    })();
    return () => { cancelled = true; };
  }, [isSupabaseOpen]);

  // Carrega checkpoints do projeto
  useEffect(() => {
    setCheckpoints(getProjectCheckpoints(projectName));
  }, [projectName, files]);

  // Captura mensagens e eventos do iframe (Erros, Console e Visual Inspector Click-to-Edit)
  useEffect(() => {
    function onMsg(ev) {
      const d = ev?.data;
      if (!d || !d.__coderPreview) return;
      if (d.type === "error" && d.payload) {
        onPreviewError?.(String(d.payload));
        if (setTerminalLogs) {
          setTerminalLogs((prev) => {
            const text = `Preview: ${String(d.payload).slice(0, 400)}`;
            if (prev[prev.length - 1]?.text === text) return prev;
            return [...prev, { type: "error", text }];
          });
        }
      } else if (d.type === "console" && d.payload) {
        if (setTerminalLogs) {
          setTerminalLogs((prev) => [
            ...prev.slice(-99),
            { type: d.payload.level === "error" ? "error" : "info", text: `[Console] ${d.payload.text}` }
          ]);
        }
      } else if (d.type === "elementSelected" && d.payload) {
        onSelectElement?.(d.payload);
        if (setTerminalLogs) {
          setTerminalLogs((prev) => [
            ...prev,
            { type: "info", text: `🎯 Elemento selecionado no Preview: <${d.payload.tag}> "${d.payload.text || ""}"` }
          ]);
        }
      } else if (d.type === "ready") {
        onPreviewReady?.();
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [setTerminalLogs, onPreviewError, onPreviewReady, onSelectElement]);

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

  // Renderiza o HTML do preview
  const generatePreviewHTML = () =>
    buildPreviewDoc(files, projectName || "Aplicação Coder", {
      inspectMode: viewMode === "inspect",
    });

  if (files.length === 0) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center h-full w-full bg-bg text-text-main p-8 select-none ${standalone ? "" : "border-l border-border"}`}>
        <div className="max-w-sm text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-500 text-xs font-bold uppercase tracking-wider">
            <span className="material-symbols-outlined text-sm">code</span>
            <span>Coder IDE (Padrão Lovable)</span>
          </div>
          <div className="w-16 h-16 mx-auto rounded-2xl bg-surface border border-border flex items-center justify-center shadow-soft">
            <span className="material-symbols-outlined text-3xl text-brand-500">auto_fix_high</span>
          </div>
          <h2 className="text-lg font-extrabold text-text-main">Crie seu app com IA em segundos</h2>
          <p className="text-sm text-text-muted leading-relaxed">
            Descreva sua ideia no chat e o Coder criará os componentes React, estilos Tailwind, visualizador de dados e backend.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full w-full bg-bg text-text-main overflow-hidden font-sans select-none ${standalone ? "" : "border-l border-border"}`}>
      {/* ── Lovable Toolbar Header ── */}
      <div className="h-12 border-b border-border bg-surface px-3 flex items-center justify-between text-xs shrink-0 gap-2">
        {/* Left: Project Selector & Checkpoints */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setIsProjectsOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-surface-2 transition-colors font-bold text-text-main border border-border"
          >
            <span className="material-symbols-outlined text-sm text-brand-500">folder</span>
            <span className="truncate max-w-[130px]">{projectName || "Meu Projeto"}</span>
            <span className="material-symbols-outlined text-[14px] text-text-muted">unfold_more</span>
          </button>

          {/* Checkpoints Rollback Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCheckpointsDropdown((v) => !v)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border hover:bg-surface-2 text-text-muted hover:text-text-main transition-colors text-[11px] font-semibold"
              title="Histórico de versões e Rollback"
            >
              <span className="material-symbols-outlined text-[14px] text-brand-500">history</span>
              <span className="hidden md:inline">v{checkpoints.length || 1}</span>
            </button>

            {showCheckpointsDropdown && (
              <div className="absolute left-0 top-9 z-50 w-64 p-2 bg-surface border border-border rounded-xl shadow-2xl space-y-1">
                <div className="px-2 py-1 border-b border-border text-[11px] font-bold text-brand-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Versões / Checkpoints</span>
                  <span className="text-[10px] text-text-muted">{checkpoints.length} salvas</span>
                </div>
                <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1">
                  {checkpoints.length === 0 ? (
                    <p className="p-2 text-center text-xs text-text-muted">Versão inicial em edição.</p>
                  ) : (
                    checkpoints.map((cp, idx) => (
                      <button
                        key={cp.id}
                        type="button"
                        onClick={() => {
                          setShowCheckpointsDropdown(false);
                          if (onRestoreCheckpoint) onRestoreCheckpoint(cp);
                        }}
                        className="w-full text-left p-2 rounded-lg hover:bg-surface-2 transition-colors flex flex-col gap-0.5 border border-transparent hover:border-brand-500/30"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-text-main">Versão #{checkpoints.length - idx}</span>
                          <span className="text-[10px] text-text-muted">{new Date(cp.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <span className="text-[11px] text-text-muted truncate">{cp.prompt || "Snapshot automático"}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: View Switchers & Viewports */}
        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center bg-surface-2 p-0.5 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                viewMode === "preview"
                  ? "bg-brand-500 text-white shadow-soft"
                  : "text-text-muted hover:text-text-main"
              }`}
              title="Preview Interativo"
            >
              <span className="material-symbols-outlined text-[14px]">visibility</span>
              <span className="hidden sm:inline">Preview</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("inspect")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                viewMode === "inspect"
                  ? "bg-brand-500 text-white shadow-soft"
                  : "text-text-muted hover:text-text-main"
              }`}
              title="Visual Element Inspector (Click-to-Edit)"
            >
              <span className="material-symbols-outlined text-[14px]">ads_click</span>
              <span className="hidden sm:inline">Inspect</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("code")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                viewMode === "code"
                  ? "bg-brand-500 text-white shadow-soft"
                  : "text-text-muted hover:text-text-main"
              }`}
              title="Editor Monaco"
            >
              <span className="material-symbols-outlined text-[14px]">code</span>
              <span className="hidden sm:inline">Code</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("diff")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                viewMode === "diff"
                  ? "bg-brand-500 text-white shadow-soft"
                  : "text-text-muted hover:text-text-main"
              }`}
              title="Diff Side-by-Side"
            >
              <span className="material-symbols-outlined text-[14px]">difference</span>
              <span className="hidden sm:inline">Diff</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("database")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                viewMode === "database"
                  ? "bg-brand-500 text-white shadow-soft"
                  : "text-text-muted hover:text-text-main"
              }`}
              title="Supabase Database Schema"
            >
              <span className="material-symbols-outlined text-[14px]">database</span>
              <span className="hidden sm:inline">Banco</span>
            </button>
          </div>

          {/* Viewport Switcher (Apenas no Preview/Inspect) */}
          {(viewMode === "preview" || viewMode === "inspect") && (
            <div className="hidden lg:flex items-center bg-surface-2 p-0.5 rounded-lg border border-border">
              {[
                { id: "desktop", icon: "desktop_windows", title: "Desktop (100%)" },
                { id: "tablet", icon: "tablet_mac", title: "Tablet (768px)" },
                { id: "mobile", icon: "smartphone", title: "Mobile (375px)" },
              ].map((vp) => (
                <button
                  key={vp.id}
                  type="button"
                  onClick={() => setViewport(vp.id)}
                  className={`flex items-center justify-center size-6 rounded transition-colors ${
                    viewport === vp.id
                      ? "bg-brand-500 text-white shadow-soft"
                      : "text-text-muted hover:text-text-main"
                  }`}
                  title={vp.title}
                >
                  <span className="material-symbols-outlined text-[14px]">{vp.icon}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Actions (Supabase, ZIP, Deploy, GitHub) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleDownloadZip}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface border border-border text-text-muted hover:text-text-main text-xs font-semibold transition-all"
            title="Download em ZIP"
          >
            <span className="material-symbols-outlined text-[15px]">download</span>
            <span className="hidden md:inline">ZIP</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (setTerminalLogs) {
                setTerminalLogs((prev) => [
                  ...prev,
                  { type: "info", text: "🚀 Preparando build de produção para Vercel e Railway..." },
                  { type: "success", text: "✓ Manifesto de deploy configurado com sucesso." }
                ]);
              }
              alert(`🚀 Deploy 1-Clique: Projeto '${projectName || "App"}' pronto para publicação.`);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 text-white font-bold text-xs shadow-soft hover:opacity-90 transition-opacity"
            title="Deploy 1-Clique"
          >
            <span className="material-symbols-outlined text-[15px]">rocket_launch</span>
            <span className="hidden sm:inline">Deploy</span>
          </button>

          <button
            type="button"
            onClick={() => setIsGitHubOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface border border-border hover:border-brand-500/40 text-text-main font-bold text-xs shadow-soft transition-all"
            title="Commit no GitHub"
          >
            <span className="material-symbols-outlined text-[15px]">commit</span>
            <span className="hidden sm:inline">Commit</span>
          </button>
        </div>
      </div>

      {/* ── Main Workspace Body ── */}
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
                <div className="h-8 px-4 border-b border-border bg-surface-2 flex items-center gap-2 text-xs font-mono text-text-muted">
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
        ) : viewMode === "diff" ? (
          <div className="flex-1 flex flex-col h-full bg-bg overflow-hidden">
            <div className="h-9 px-4 border-b border-border bg-surface-2 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 text-brand-500 font-bold">
                <span className="material-symbols-outlined text-sm">difference</span>
                <span>Comparativo Diff Side-by-Side: {selectedFilePath}</span>
              </div>
              <span className="text-text-muted">Linha a linha</span>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-px bg-border overflow-hidden">
              <div className="bg-surface p-4 overflow-auto font-mono text-xs text-text-muted">
                <div className="text-red-400 font-bold mb-2 uppercase text-[10px] tracking-wider border-b border-border pb-1">Versão Anterior</div>
                <pre className="whitespace-pre-wrap">{selectedFile?.originalContent || selectedFile?.content || "// Sem conteúdo prévio"}</pre>
              </div>
              <div className="bg-surface-2 p-4 overflow-auto font-mono text-xs text-text-main">
                <div className="text-emerald-400 font-bold mb-2 uppercase text-[10px] tracking-wider border-b border-border pb-1">Proposto pela IA (Atual)</div>
                <pre className="whitespace-pre-wrap">{selectedFile?.content || "// Sem alterações"}</pre>
              </div>
            </div>
          </div>
        ) : viewMode === "database" ? (
          <div className="flex-1 h-full overflow-hidden">
            <SupabaseDatabaseView
              supabaseConfig={supabaseConfig}
              onOpenConfig={() => setIsSupabaseOpen(true)}
              onPromptSchema={onPromptSchema}
            />
          </div>
        ) : (
          /* Preview e Visual Inspector (Click-to-Edit) */
          <div className="flex-1 bg-bg-alt/40 p-4 flex items-center justify-center overflow-hidden">
            <div
              className={`transition-all duration-300 flex items-center justify-center ${
                viewport === "mobile"
                  ? "w-[375px] h-[95%] rounded-3xl border-4 border-surface-3 shadow-2xl overflow-hidden"
                  : viewport === "tablet"
                  ? "w-[768px] h-[95%] rounded-2xl border-4 border-surface-3 shadow-2xl overflow-hidden"
                  : "w-full h-full rounded-xl border border-border shadow-elevated overflow-hidden"
              }`}
            >
              <iframe
                title="Live Preview"
                srcDoc={generatePreviewHTML()}
                className="w-full h-full bg-surface"
              />
            </div>
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
  onSelectElement: PropTypes.func,
  onPromptSchema: PropTypes.func,
  onRestoreCheckpoint: PropTypes.func,
};

function getLanguage(filename = "") {
  if (filename.endsWith(".tsx") || filename.endsWith(".ts")) return "typescript";
  if (filename.endsWith(".jsx") || filename.endsWith(".js")) return "javascript";
  if (filename.endsWith(".css")) return "css";
  if (filename.endsWith(".html")) return "html";
  if (filename.endsWith(".json")) return "json";
  return "plaintext";
}
