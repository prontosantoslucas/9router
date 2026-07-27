"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { commitToGitHub } from "@/lib/coder/githubCommit";
import { fetchCoderConnections } from "@/lib/coder/supabaseClient";

export default function GitHubCommitModal({ isOpen, onClose, files }) {
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [message, setMessage] = useState("feat: update project files via 9router Coder");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCoderConnections().then((conn) => {
        if (conn) {
          if (conn.githubRepo) setRepo(conn.githubRepo);
          if (conn.githubBranch) setBranch(conn.githubBranch);
          if (conn.githubToken) setToken(conn.githubToken);
          if (conn.githubRepo || conn.githubToken) setIsConnected(true);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const persistConnection = async ({ notify = false } = {}) => {
    try {
      const res = await fetch("/api/coder/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubRepo: repo, githubBranch: branch, githubToken: token }),
      });
      if (!res.ok) throw new Error("Falha ao salvar conexão.");
      if (notify) {
        setIsConnected(true);
        setResultMsg("✓ Conexão salva. Permanece até você alterar.");
      }
    } catch (err) {
      if (notify) setResultMsg(`Erro: ${err.message}`);
    }
  };

  const handleConnect = async () => {
    if (!repo.trim()) {
      setResultMsg("Informe o repositório do GitHub (ex: usuario/meu-projeto).");
      return;
    }
    setLoading(true);
    setResultMsg("");
    await persistConnection({ notify: true });
    setLoading(false);
  };

  const handleCommit = async () => {
    if (!repo.trim()) {
      setResultMsg("Informe o repositÃ³rio do GitHub (ex: usuario/meu-projeto).");
      return;
    }
    if (!message.trim()) {
      setResultMsg("Informe uma mensagem para o commit.");
      return;
    }

    setLoading(true);
    setResultMsg("");

    try {
      // Persist connection details in SQLite so they survive restarts/commits.
      await fetch("/api/coder/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubRepo: repo, githubBranch: branch, githubToken: token }),
      }).catch(() => {});

      const res = await commitToGitHub({ repo, branch, message, token, files });
      setResultMsg(`âœ“ ${res.message}`);
    } catch (err) {
      setResultMsg(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-elevated overflow-hidden text-text-main">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-bg-alt/50">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-brand-500 text-[20px]">code</span>
            <h2 className="font-bold text-base text-text-main">Commitar no GitHub</h2>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-main p-1 rounded-md hover:bg-surface-2 transition-colors">
            âœ•
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4 text-xs font-sans">
          {isConnected && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-2 font-medium">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>Conexão salva no SQLite. Permanece até você alterar.</span>
            </div>
          )}
          <div>
            <label className="block text-text-main font-semibold mb-1.5">RepositÃ³rio GitHub (usuario/repo)</label>
            <input
              type="text"
              placeholder="ex: LucasNorte/crystal-water-app"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              onBlur={() => persistConnection()}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text-main text-xs focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-text-main font-semibold mb-1.5">Branch</label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                onBlur={() => persistConnection()}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text-main text-xs focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-text-main font-semibold mb-1.5">GitHub Token (Salvo na DB)</label>
              <input
                type="password"
                placeholder="ghp_..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onBlur={() => persistConnection()}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text-main text-xs focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-text-main font-semibold mb-1.5">Mensagem do Commit</label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text-main text-xs focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>

          {resultMsg && (
            <p className={`text-xs ${resultMsg.startsWith("Erro") ? "text-danger" : "text-success font-semibold"}`}>
              {resultMsg}
            </p>
          )}
        </div>

        {/* Action Bar */}
        <div className="px-5 py-4 bg-bg border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleConnect}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-soft disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">{isConnected ? "check_circle" : "link"}</span>
              <span>{isConnected ? "Conectado" : "Conectar"}</span>
            </button>
            <button
              onClick={handleCommit}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-soft disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">commit</span>
              <span>{loading ? "Commitando..." : "Realizar Commit"}</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 text-text-muted text-xs font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

GitHubCommitModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  files: PropTypes.array.isRequired,
};








