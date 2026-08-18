"use client";

import React, { useState } from "react";
import { cn } from "@/shared/utils/cn";

export function SupabaseDatabaseView({ supabaseConfig, onOpenConfig, onPromptSchema }) {
  const [activeTab, setActiveTab] = useState("tables");
  const isConnected = !!(supabaseConfig?.url && supabaseConfig?.key);

  const mockTables = [
    { name: "profiles", rows: 12, columns: ["id (uuid)", "email (text)", "name (text)", "avatar_url (text)", "created_at (timestamp)"] },
    { name: "projects", rows: 5, columns: ["id (uuid)", "user_id (uuid)", "title (text)", "status (text)", "updated_at (timestamp)"] },
    { name: "tasks", rows: 34, columns: ["id (uuid)", "project_id (uuid)", "title (text)", "completed (boolean)", "due_date (date)"] }
  ];

  return (
    <div className="flex flex-col h-full bg-surface text-text-main">
      {/* Header do Database Manager */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center size-8 rounded-lg bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
            <span className="material-symbols-outlined text-[18px]">database</span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-text-main flex items-center gap-2">
              Supabase Database
              {isConnected ? (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30">
                  Conectado
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/30">
                  Não Configurado
                </span>
              )}
            </h3>
            <p className="text-[11px] text-text-muted truncate max-w-[280px]">
              {isConnected ? supabaseConfig.url : "Conecte sua URL e Chave Anon para habilitar backend real."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenConfig}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-surface text-xs font-semibold text-text-muted hover:text-text-main hover:border-brand-500/40 transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">settings</span>
            <span>{isConnected ? "Gerenciar Chaves" : "Conectar Supabase"}</span>
          </button>

          {isConnected && (
            <button
              type="button"
              onClick={() => onPromptSchema && onPromptSchema("Gere o esquema SQL completo no Supabase para as tabelas deste projeto com Row Level Security (RLS).")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 text-white text-xs font-bold shadow-soft hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-[15px]">auto_fix_high</span>
              <span>Gerar Schema IA</span>
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {!isConnected ? (
          <div className="max-w-md mx-auto my-12 text-center space-y-4 p-6 rounded-2xl bg-surface-2 border border-border">
            <div className="flex items-center justify-center size-12 rounded-2xl bg-brand-500/15 text-brand-400 mx-auto">
              <span className="material-symbols-outlined text-[26px]">database</span>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-text-main">Habilite Backend PostgreSQL com 1 Clique</h4>
              <p className="text-xs text-text-muted leading-relaxed">
                O Lovable e o Coder integram-se nativamente ao Supabase para autenticação de usuários, banco relacional e armazenamento de arquivos.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenConfig}
              className="w-full py-2.5 rounded-xl bg-brand-500 text-white text-xs font-bold shadow-soft hover:bg-brand-600 transition-colors"
            >
              Configurar Conexão Supabase
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Tabelas Detectadas no Projeto
            </h4>

            <div className="grid grid-cols-1 gap-3">
              {mockTables.map((t) => (
                <div key={t.name} className="p-3.5 rounded-xl bg-surface-2 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-brand-500 text-[16px]">table_chart</span>
                      <span className="text-xs font-bold text-text-main">{t.name}</span>
                    </div>
                    <span className="text-[10px] text-text-muted">{t.rows} registros</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {t.columns.map((col) => (
                      <span key={col} className="px-2 py-0.5 rounded-md bg-surface text-[10px] font-mono text-text-muted border border-border">
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
