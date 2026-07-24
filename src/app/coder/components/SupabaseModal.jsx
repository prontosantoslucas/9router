"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { getSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig, initiateSupabaseOAuth, fetchCoderConnections } from "@/lib/coder/supabaseClient";

export default function SupabaseModal({ isOpen, onClose }) {
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = getSupabaseConfig();
      if (cfg && cfg.supabaseUrl) {
        setSupabaseUrl(cfg.supabaseUrl);
        setAnonKey(cfg.anonKey || "");
        setIsConnected(true);
      }

      fetchCoderConnections().then((conn) => {
        if (conn && conn.supabaseUrl) {
          setSupabaseUrl(conn.supabaseUrl);
          setAnonKey(conn.supabaseAnonKey || "");
          setIsConnected(true);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveAndConnect = async () => {
    if (!supabaseUrl.trim()) {
      setStatusMsg("Informe a URL do seu projeto Supabase (ex: https://xyz.supabase.co).");
      return;
    }

    setLoading(true);
    setStatusMsg("");

    try {
      await saveSupabaseConfig({ supabaseUrl, anonKey });
      setStatusMsg("Redirecionando para login OAuth no Supabase...");
      await initiateSupabaseOAuth("github", supabaseUrl, anonKey);
    } catch (err) {
      setStatusMsg(`Erro: ${err.message}`);
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    await clearSupabaseConfig();
    setIsConnected(false);
    setSupabaseUrl("");
    setAnonKey("");
    setStatusMsg("Conexão com Supabase removida.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-elevated overflow-hidden text-text-main">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-bg-alt/50">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm">
              ⚡
            </div>
            <h2 className="font-bold text-base text-text-main">Conectar Supabase (OAuth)</h2>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-main p-1 rounded-md hover:bg-surface-2 transition-colors">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs font-sans">
          {isConnected && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-between font-medium">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>Conectado ao Supabase (Persistido no SQLite DB)</span>
              </div>
              <button onClick={handleDisconnect} className="text-[11px] font-bold text-danger hover:underline">
                Desconectar
              </button>
            </div>
          )}

          <div>
            <label className="block text-text-main font-semibold mb-1.5">Supabase Project URL</label>
            <input
              type="text"
              placeholder="https://sua-instancia.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text-main text-xs focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-text-main font-semibold mb-1.5">Anon API Key (Opcional)</label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text-main text-xs focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>

          {statusMsg && (
            <p className={`text-xs ${statusMsg.startsWith("Erro") ? "text-danger" : "text-brand-500"}`}>
              {statusMsg}
            </p>
          )}
        </div>

        {/* Action Bar */}
        <div className="px-5 py-4 bg-bg border-t border-border flex items-center justify-between">
          <button
            onClick={handleSaveAndConnect}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-soft disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">bolt</span>
            <span>{loading ? "Conectando..." : "Salvar & Login OAuth"}</span>
          </button>

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

SupabaseModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
