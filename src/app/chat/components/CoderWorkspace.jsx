"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import PropTypes from "prop-types";
import FileExplorer from "@/app/coder/components/FileExplorer";
import TerminalPanel from "@/app/coder/components/TerminalPanel";
import ProjectsModal from "@/app/coder/components/ProjectsModal";
import SupabaseModal from "@/app/coder/components/SupabaseModal";
import GitHubCommitModal from "@/app/coder/components/GitHubCommitModal";
import { INITIAL_PROJECT_FILES } from "@/lib/coder/openclaudeEngine";
import { downloadProjectAsZip } from "@/lib/coder/zipExporter";
import { getSupabaseConfig } from "@/lib/coder/supabaseClient";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export function CoderWorkspace({ files, setFiles, terminalLogs, setTerminalLogs, projectName, setProjectName }) {
  const [viewMode, setViewMode] = useState("code"); // "code" | "preview"
  const [selectedFilePath, setSelectedFilePath] = useState("src/App.tsx");
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);

  // Modals state
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [isSupabaseOpen, setIsSupabaseOpen] = useState(false);
  const [isGitHubOpen, setIsGitHubOpen] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState(false);

  useEffect(() => {
    const cfg = getSupabaseConfig();
    if (cfg && cfg.supabaseUrl) setSupabaseConnected(true);
  }, []);

  const currentFiles = files || INITIAL_PROJECT_FILES;
  const selectedFile = currentFiles.find((f) => f.path === selectedFilePath) || currentFiles[0];

  const handleFileChange = (newContent) => {
    if (setFiles) {
      setFiles((prev) =>
        prev.map((f) => (f.path === selectedFilePath ? { ...f, content: newContent } : f))
      );
    }
  };

  const handleDownloadZip = () => {
    downloadProjectAsZip(projectName || "Projeto-9router", currentFiles);
    if (setTerminalLogs) {
      setTerminalLogs((prev) => [
        ...prev,
        { type: "success", text: `✓ Download do projeto ${projectName || "Projeto-9router"}.zip iniciado.` },
      ]);
    }
  };

  const generatePreviewHTML = () => {
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-slate-900 text-white min-h-screen p-6 font-sans">
    <div id="root" class="max-w-2xl mx-auto text-center space-y-4 pt-10">
      <h1 class="text-3xl font-extrabold text-amber-500">${projectName || "Projeto 9router Coder"}</h1>
      <p class="text-slate-400 text-sm">Pré-visualização ao vivo gerada pelo Agente Lucas</p>
      <div class="p-6 bg-slate-800/80 border border-slate-700 rounded-xl shadow-lg mt-6">
        <p class="text-slate-200 font-mono text-xs">Arquivo ativo: ${selectedFilePath}</p>
      </div>
    </div>
  </body>
</html>`;
  };

  return (
    <div className="flex flex-col h-full w-full bg-bg text-text-main overflow-hidden font-sans border-l border-border select-none">
      {/* Coder Toolbar Header */}
      <div className="h-12 border-b border-border bg-surface px-4 flex items-center justify-between text-xs shrink-0">
        {/* Left: Project Selector & Status */}
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
                files={currentFiles}
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
              logs={terminalLogs || []}
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
        projects={[{ id: "p1", name: projectName || "Meu Projeto Coder", filesCount: currentFiles.length }]}
        activeProjectId="p1"
        onSelectProject={() => {}}
        onCreateProject={() => {
          if (setProjectName) setProjectName("Novo Projeto 9router");
          if (setFiles) setFiles(INITIAL_PROJECT_FILES);
        }}
      />

      <SupabaseModal isOpen={isSupabaseOpen} onClose={() => setIsSupabaseOpen(false)} />

      <GitHubCommitModal isOpen={isGitHubOpen} onClose={() => setIsGitHubOpen(false)} files={currentFiles} />
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
