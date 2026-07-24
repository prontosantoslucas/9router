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

  useEffect(() => {
    if (isOpen) {
      // Load saved connections from SQLite DB
      fetchCoderConnections().then((conn) => {
        if (conn) {
          if (conn.githubRepo) setRepo(conn.githubRepo);
          if (conn.githubBranch) setBranch(conn.githubBranch);
          if (conn.githubToken) setToken(conn.githubToken);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCommit = async () => {
    if (!repo.trim()) {
      setResultMsg("Informe o repositório do GitHub (ex: usuario/meu-projeto).");
      return;
    }
    if (!message.trim()) {
      setResultMsg("Informe uma mensagem para o commit.");
      return;
    }

    setLoading(true);
    setResultMsg("");

    try {
      const res = await commitToGitHub({ repo, branch, message, token, files });
      setResultMsg(`✓ ${res.message}`);
    } catch (err) {
      setResultMsg(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#141417] border border-[#26262B] rounded-xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#26262B]">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-white text-[20px]">code</span>
            <h2 className="font-semibold text-base text-white">Commitar no GitHub</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#26262B] transition-colors">
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4 text-xs font-sans">
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Repositório GitHub (usuario/repo)</label>
            <input
              type="text"
              placeholder="ex: LucasNorte/crystal-water-app"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              className="w-full bg-[#1B1B1F] border border-[#2B2B32] rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Branch</label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full bg-[#1B1B1F] border border-[#2B2B32] rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">GitHub Token (Salvo na DB)</label>
              <input
                type="password"
                placeholder="ghp_..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full bg-[#1B1B1F] border border-[#2B2B32] rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Mensagem de Commit</label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-[#1B1B1F] border border-[#2B2B32] rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-sans resize-none"
            />
          </div>

          {resultMsg && (
            <div className="p-3 rounded bg-[#1C1C22] border border-[#2D2D35] text-slate-200 text-[11px] font-mono leading-relaxed">
              {resultMsg}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 bg-[#101013] border-t border-[#26262B] flex items-center justify-between">
          <button
            onClick={handleCommit}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">commit</span>
            <span>{loading ? "Commitando..." : "Executar Commit & Salvar Conexão"}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#222227] hover:bg-[#2C2C33] text-slate-300 text-xs font-medium transition-colors"
          >
            Cancelar
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
