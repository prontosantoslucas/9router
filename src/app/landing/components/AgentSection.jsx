"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function AgentSection() {
  const router = useRouter();

  return (
    <section className="py-24 px-6 relative border-t border-border/40 bg-hero-gradient">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-500 text-xs font-bold uppercase tracking-wider">
              <span className="material-symbols-outlined text-sm">smart_toy</span>
              <span>Assistente Autônomo Unificado</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-text-main leading-tight">
              Conheça o <span className="text-brand-500">Agente Lucas</span>
            </h2>

            <p className="text-base sm:text-lg text-text-muted leading-relaxed">
              O Agente Lucas atende você e seus clientes autonomamente no **WhatsApp (Evolution API)**, **Telegram (Userbot MTProto)** e **Web Chat**, mantendo memórias contínuas via `ai-memory` e personalidade personalizada do GitHub.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-surface border border-border dark:bg-surface-2">
                <span className="material-symbols-outlined text-brand-500 text-2xl">chat</span>
                <div>
                  <h4 className="font-bold text-sm text-text-main">Multi-Canal Pessoal</h4>
                  <p className="text-xs text-text-muted">Atendimento no WhatsApp e Telegram usando sua conta pessoal (sem tag bot).</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-surface border border-border dark:bg-surface-2">
                <span className="material-symbols-outlined text-brand-500 text-2xl">psychology</span>
                <div>
                  <h4 className="font-bold text-sm text-text-main">Memória Obrigatória</h4>
                  <p className="text-xs text-text-muted">Sincronização contínua de preferências e contexto histórico via ai-memory.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-surface border border-border dark:bg-surface-2">
                <span className="material-symbols-outlined text-brand-500 text-2xl">verified_user</span>
                <div>
                  <h4 className="font-bold text-sm text-text-main">Modo Co-Piloto</h4>
                  <p className="text-xs text-text-muted">Aprovação em 1-clique antes do envio de mensagens rascunhadas.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-surface border border-border dark:bg-surface-2">
                <span className="material-symbols-outlined text-brand-500 text-2xl">record_voice_over</span>
                <div>
                  <h4 className="font-bold text-sm text-text-main">Áudio STT & TTS</h4>
                  <p className="text-xs text-text-muted">Transcrição de notas de voz recebidas e respostas em áudio sintetizado.</p>
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-wrap gap-4">
              <button
                onClick={() => router.push("/chat")}
                className="h-12 px-8 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm transition-all shadow-warm flex items-center gap-2"
              >
                <span className="material-symbols-outlined">forum</span>
                <span>Abrir Chat do Lucas</span>
              </button>
              <button
                onClick={() => router.push("/dashboard2")}
                className="h-12 px-8 rounded-lg border border-border hover:bg-bg-alt text-text-main font-bold text-sm transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined">tune</span>
                <span>Configurar Lucas no Dashboard</span>
              </button>
            </div>
          </div>

          <div className="flex-1 w-full max-w-md">
            <div className="card-elev p-6 border border-border rounded-2xl relative overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border pb-4 mb-4">
                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-brand-600 to-amber-400 flex items-center justify-center text-white font-bold text-lg">
                  L
                </div>
                <div>
                  <h3 className="font-bold text-text-main">Lucas</h3>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                    <span className="text-xs text-text-muted">Conectado • WhatsApp & Telegram</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-bg-alt p-3 rounded-lg text-text-muted">
                  <span className="font-bold text-text-main">Você (WhatsApp):</span>
                  <p className="mt-1">Lucas, você pode me enviar o resumo das reuniões de hoje?</p>
                </div>

                <div className="bg-brand-500/10 border border-brand-500/20 p-3 rounded-lg text-text-main">
                  <span className="font-bold text-brand-500">Lucas:</span>
                  <p className="mt-1">Claro! Você tem 2 compromissos agendados no Google Calendar hoje às 14h e 16:30h. Enviei os detalhes no seu e-mail!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
