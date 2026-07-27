"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import FileExplorer from "./components/FileExplorer";
import TerminalPanel from "./components/TerminalPanel";
import ProjectsModal from "./components/ProjectsModal";
import SupabaseModal from "./components/SupabaseModal";
import GitHubCommitModal from "./components/GitHubCommitModal";
import { INITIAL_PROJECT_FILES, processOpenClaudePrompt } from "@/lib/coder/openclaudeEngine";
import { downloadProjectAsZip } from "@/lib/coder/zipExporter";
import { getSupabaseConfig } from "@/lib/coder/supabaseClient";
import { buildPreviewDoc } from "@/lib/coder/previewBuilder";

// Dynamically import Monaco Editor to avoid SSR hydration mismatches
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export default function CoderPageClient() {
  const [activeTab, setActiveTab] = useState("chat"); // "chat" | "projects"
  const [viewMode, setViewMode] = useState("code"); // "code" | "preview"
  const [projectName, setProjectName] = useState("Crystal Water Landing Page");
  const [files, setFiles] = useState(INITIAL_PROJECT_FILES);
  const [selectedFilePath, setSelectedFilePath] = useState("src/App.tsx");
  const [promptInput, setPromptInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Chat message history
  const [messages, setMessages] = useState([
    {
      id: "1",
      sender: "assistant",
      text: "Importing your project, this will just take a moment...",
      timestamp: "9:01 AM",
      card: {
        title: "Importing Bolt Project",
        subtitle: "Version 1 at Jul 24 9:01 AM",
      },
    },
    {
      id: "2",
      sender: "assistant",
      text: "I've successfully imported your project. I'm ready to assist you with analyzing and improving your code.",
      timestamp: "9:02 AM",
    },
  ]);

  // Terminal logs
  const [terminalLogs, setTerminalLogs] = useState([
    { type: "command", text: "Local:   http://localhost:5173/" },
    { type: "command", text: "Network: use --host to expose" },
    { type: "info", text: "press h + enter to show help" },
    { type: "info", text: "Browserslist: caniuse-lite is outdated. Please run: npx update-browserslist-db@latest" },
  ]);

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

  const selectedFile = files.find((f) => f.path === selectedFilePath) || files[0];

  const handleFileChange = (newContent) => {
    setFiles((prev) =>
      prev.map((f) => (f.path === selectedFilePath ? { ...f, content: newContent } : f))
    );
  };

  const handleSendPrompt = async () => {
    if (!promptInput.trim() || isProcessing) return;

    const userMessageText = promptInput.trim();
    setPromptInput("");

    // Add user message to chat
    const userMsg = {
      id: Date.now().toString(),
      sender: "user",
      text: userMessageText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const response = await processOpenClaudePrompt({
        prompt: userMessageText,
        currentFiles: files,
        onStreamMessage: (statusText) => {
          setTerminalLogs((prev) => [...prev, { type: "info", text: statusText }]);
        },
        onTerminalLog: (log) => {
          setTerminalLogs((prev) => [...prev, log]);
        },
        onUpdateFiles: (newFiles) => {
          setFiles(newFiles);
        },
      });

      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: response.message,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setTerminalLogs((prev) => [...prev, { type: "error", text: `Erro no OpenClaude: ${err.message}` }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadZip = () => {
    downloadProjectAsZip(projectName, files);
    setTerminalLogs((prev) => [...prev, { type: "success", text: `âœ“ Download do projeto ${projectName}.zip iniciado.` }]);
  };

  // Generate preview HTML for iframe
  const generatePreviewHTML = () => buildPreviewDoc(files, projectName);

  return (
    <div className="flex flex-col h-full bg-[#0E0E10] text-slate-200 overflow-hidden font-sans select-none">
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {/* TOP HEADER BAR (Bolt Style)                                   */}
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <header className="h-12 border-b border-[#1E1E22] bg-[#0E0E10] px-4 flex items-center justify-between text-xs">
        {/* Left Section: Logo & Project Switcher */}
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-white text-black font-black flex items-center justify-center text-sm font-serif italic">
            b
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsProjectsOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded hover:bg-[#1A1A1E] transition-colors font-medium text-slate-200"
            >
              <span>{projectName}</span>
              <span className="material-symbols-outlined text-[14px] text-slate-400">unfold_more</span>
            </button>
            <span className="text-slate-600">/</span>
            {/* View Switcher: Chat vs Projetos */}
            <div className="flex items-center bg-[#161619] p-0.5 rounded border border-[#26262B]">
              <button
                onClick={() => setActiveTab("chat")}
                className={`px-2.5 py-0.5 rounded font-medium transition-colors ${
                  activeTab === "chat" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Chat
              </button>
              <button
                onClick={() => setIsProjectsOpen(true)}
                className={`px-2.5 py-0.5 rounded font-medium transition-colors ${
                  activeTab === "projects" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Projetos
              </button>
            </div>
          </div>
        </div>

        {/* Center Section: View Mode Toggle (Preview vs Code </>) */}
        <div className="flex items-center bg-[#161619] p-0.5 rounded-lg border border-[#26262B]">
          <button
            onClick={() => setViewMode("preview")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              viewMode === "preview"
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">visibility</span>
            <span>Preview</span>
          </button>
          <button
            onClick={() => setViewMode("code")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              viewMode === "code"
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">code</span>
            <span>Code</span>
          </button>
        </div>

        {/* Right Section: GitHub Commit, Download ZIP, Supabase OAuth (NO Upgrade, NO Share, NO Publish) */}
        <div className="flex items-center gap-2">
          {/* Supabase Button */}
          <button
            onClick={() => setIsSupabaseOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-all ${
              supabaseConnected
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-[#18181C] border-[#2A2A30] text-slate-300 hover:border-slate-500"
            }`}
          >
            <span className="text-emerald-400">âš¡</span>
            <span>{supabaseConnected ? "Supabase Conectado" : "Conectar Supabase"}</span>
          </button>

          {/* Download ZIP Button */}
          <button
            onClick={handleDownloadZip}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#18181C] border border-[#2A2A30] text-slate-300 hover:text-white hover:border-slate-500 text-xs font-medium transition-all"
            title="Baixar arquivos do projeto como ZIP"
          >
            <span className="material-symbols-outlined text-[15px]">download</span>
            <span>Download ZIP</span>
          </button>

          {/* GitHub Commit Button */}
          <button
            onClick={() => setIsGitHubOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-md shadow-blue-600/20"
          >
            <span className="material-symbols-outlined text-[16px]">commit</span>
            <span>Commit no GitHub</span>
          </button>
        </div>
      </header>

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {/* MAIN CONTENT SPLIT (Left: Chat | Right: Code or Preview)     */}
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: CHAT INTERFACE */}
        <div className="w-[420px] border-r border-[#1E1E22] bg-[#0E0E10] flex flex-col h-full">
          {/* Chat Message History */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
            <div className="font-bold text-lg text-slate-200 tracking-tight flex items-center gap-2">
              <span className="font-serif italic text-white text-xl">b</span> bolt
            </div>

            {messages.map((msg) => (
              <div key={msg.id} className="space-y-2">
                <p className="text-xs text-slate-300 leading-relaxed font-sans">{msg.text}</p>
                {msg.card && (
                  <div className="p-3 rounded-lg bg-[#141417] border border-[#222227] flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-200 text-xs">{msg.card.title}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">{msg.card.subtitle}</p>
                    </div>
                    <span className="material-symbols-outlined text-blue-400 text-[18px]">bookmark</span>
                  </div>
                )}
              </div>
            ))}

            {isProcessing && (
              <div className="flex items-center gap-2 text-xs text-blue-400 animate-pulse">
                <span className="material-symbols-outlined text-[16px]">hourglass_empty</span>
                <span>OpenClaude processando alteraÃ§Ãµes...</span>
              </div>
            )}
          </div>

          {/* Bottom Chat Prompt Input Box (Matching Screenshot) */}
          <div className="p-3 bg-[#0E0E10] border-t border-[#1E1E22]">
            <div className="bg-[#141417] border border-[#24242A] rounded-xl p-3 space-y-3">
              <textarea
                rows={2}
                placeholder="How can Bolt help you today? (or /command)"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendPrompt();
                  }
                }}
                className="w-full bg-transparent text-slate-100 text-xs focus:outline-none resize-none placeholder-slate-500 font-sans"
              />

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <button className="p-1 hover:bg-[#222227] rounded text-slate-400 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-[14px]">add</span>
                  </button>
                  <button className="flex items-center gap-1 hover:text-white transition-colors font-medium">
                    <span>Standard</span>
                    <span className="material-symbols-outlined text-[12px]">unfold_more</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[11px]">
                  <button className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-[14px]">tune</span>
                    <span>Select</span>
                  </button>
                  <button className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-[14px]">lightbulb</span>
                    <span>Plan</span>
                  </button>
                  <button
                    onClick={handleSendPrompt}
                    disabled={!promptInput.trim() || isProcessing}
                    className="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white flex items-center justify-center transition-all shadow"
                  >
                    <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: CODE OR PREVIEW */}
        <div className="flex-1 flex flex-col h-full bg-[#09090B]">
          {viewMode === "code" ? (
            <div className="flex-1 flex flex-col h-full">
              {/* File Tree + Editor Split */}
              <div className="flex-1 flex overflow-hidden">
                <FileExplorer
                  files={files}
                  selectedFile={selectedFilePath}
                  onSelectFile={(path) => setSelectedFilePath(path)}
                />

                {/* Monaco Editor Container */}
                <div className="flex-1 flex flex-col bg-[#0E0E10]">
                  {/* File Breadcrumb */}
                  <div className="h-8 px-4 border-b border-[#1E1E22] bg-[#0E0E10] flex items-center gap-2 text-xs font-mono text-slate-400">
                    <span>{selectedFilePath}</span>
                  </div>

                  <div className="flex-1 relative">
                    <MonacoEditor
                      height="100%"
                      language={getLanguage(selectedFilePath)}
                      theme="vs-dark"
                      value={selectedFile.content}
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

              {/* Terminal Drawer at Bottom */}
              <TerminalPanel
                logs={terminalLogs}
                isCollapsed={isTerminalCollapsed}
                onToggleCollapse={() => setIsTerminalCollapsed((v) => !v)}
              />
            </div>
          ) : (
            /* Preview Canvas */
            <div className="flex-1 bg-[#050506] flex items-center justify-center p-4">
              <iframe
                title="Live Preview"
                srcDoc={generatePreviewHTML()}
                className="w-full h-full border border-[#222227] rounded-lg shadow-2xl bg-white"
              />
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <ProjectsModal
        isOpen={isProjectsOpen}
        onClose={() => setIsProjectsOpen(false)}
        projects={[{ id: "p1", name: projectName, filesCount: files.length }]}
        activeProjectId="p1"
        onSelectProject={(id) => {}}
        onCreateProject={() => {
          setProjectName("Novo Projeto Bolt");
          setFiles(INITIAL_PROJECT_FILES);
        }}
      />

      <SupabaseModal isOpen={isSupabaseOpen} onClose={() => setIsSupabaseOpen(false)} />

      <GitHubCommitModal isOpen={isGitHubOpen} onClose={() => setIsGitHubOpen(false)} files={files} />
    </div>
  );
}

function getLanguage(filename) {
  if (filename.endsWith(".tsx") || filename.endsWith(".ts")) return "typescript";
  if (filename.endsWith(".jsx") || filename.endsWith(".js")) return "javascript";
  if (filename.endsWith(".css")) return "css";
  if (filename.endsWith(".html")) return "html";
  if (filename.endsWith(".json")) return "json";
  return "plaintext";
}



