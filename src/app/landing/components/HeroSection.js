"use client";

import { useRouter } from "next/navigation";

export default function HeroSection() {
  const router = useRouter();

  return (
    <section className="relative pt-32 pb-20 px-6 min-h-[90vh] flex flex-col items-center justify-center overflow-hidden">
      {/* Glow effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-[#f97815]/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="relative z-10 max-w-4xl w-full text-center flex flex-col items-center gap-8">
        {/* Version badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-[#3a2f27] bg-[#23180f]/50 px-4 py-1 text-xs font-medium text-[#f97815]">
          <span className="flex h-2 w-2 rounded-full bg-[#f97815] animate-pulse"></span>
          <span>MaxRouter v1.0 • Agente Lucas Integrado</span>
        </div>

        {/* Main heading */}
        <h1 className="text-5xl md:text-7xl font-black leading-[1.1] tracking-tight text-white">
          One Endpoint for <br />
          <span className="text-[#f97815]">All AI Providers</span>
        </h1>

        {/* Description */}
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto font-light">
          AI endpoint proxy com web dashboard. Funciona nativamente com Claude Code, OpenAI Codex, Cline, RooCode e inclui o **Agente Lucas** para atendimento no WhatsApp, Telegram e Web.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 w-full pt-2">
          <button
            onClick={() => router.push("/dashboard")}
            className="h-12 px-8 rounded-lg bg-[#f97815] hover:bg-[#e0650a] text-[#181411] text-base font-bold transition-all shadow-[0_0_15px_rgba(249,120,21,0.4)] flex items-center gap-2"
          >
            <span className="material-symbols-outlined">rocket_launch</span>
            <span>Acessar Dashboard</span>
          </button>
          <button
            onClick={() => router.push("/chat")}
            className="h-12 px-8 rounded-lg border border-[#3a2f27] bg-[#23180f] hover:bg-[#3a2f27] text-white text-base font-bold transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined">forum</span>
            <span>Chat do Lucas</span>
          </button>
        </div>
      </div>
    </section>
  );
}
