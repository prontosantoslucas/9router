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
      // 1. Try local storage
      const cfg = getSupabaseConfig();
      if (cfg && cfg.supabaseUrl) {
        setSupabaseUrl(cfg.supabaseUrl);
        setAnonKey(cfg.anonKey || "");
        setIsConnected(true);
      }

      // 2. Load persistent DB connections
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#141417] border border-[#26262B] rounded-xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#26262B]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">
              ⚡
            </div>
            <h2 className="font-semibold text-base text-white">Conectar Supabase (OAuth)</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#26262B] transition-colors">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs font-sans">
          {isConnected && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>Conectado ao Supabase (Persistido no SQLite DB)</span>
              </div>
              <button onClick={handleDisconnect} className="text-[11px] font-semibold text-rose-400 hover:underline">
                Desconectar
              </button>
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Supabase Project URL</label>
            <input
              type="text"
              placeholder="https://sua-instancia.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              className="w-full bg-[#1B1B1F] border border-[#2B2B32] rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Anon / Public API Key (Opcional)</label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5..."
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              className="w-full bg-[#1B1B1F] border border-[#2B2B32] rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          {statusMsg && (
            <div className="p-2.5 rounded bg-[#1C1C22] border border-[#2D2D35] text-slate-300 text-[11px]">
              {statusMsg}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 bg-[#101013] border-t border-[#26262B] flex items-center justify-between">
          <button
            onClick={handleSaveAndConnect}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">lock</span>
            <span>{loading ? "Conectando..." : "Autenticar via Supabase OAuth"}</span>
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

SupabaseModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
