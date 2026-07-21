"use client";

import { useRouter } from "next/navigation";

export default function GetStarted() {
  const router = useRouter();

  return (
    <section className="py-20 px-6 relative border-y border-border/40 bg-hero-gradient">
      <div className="max-w-4xl mx-auto text-center space-y-6">
        <h2 className="text-3xl sm:text-5xl font-extrabold text-text-main">
          Pronto para Automatizar seu Atendimento?
        </h2>
        <p className="text-base sm:text-lg text-text-muted max-w-2xl mx-auto">
          Simplifique sua infraestrutura de IA e tenha o Agente Lucas respondendo por você no WhatsApp, Telegram e Web.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <button
            onClick={() => router.push("/chat")}
            className="h-13 px-8 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-base transition-all shadow-warm flex items-center gap-2"
          >
            <span className="material-symbols-outlined">forum</span>
            <span>Testar Chat do Lucas</span>
          </button>
          <button
            onClick={() => router.push("/dashboard2")}
            className="h-13 px-8 rounded-xl border border-border bg-surface hover:bg-bg-alt text-text-main font-bold text-base transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined">tune</span>
            <span>Configurar no Dashboard</span>
          </button>
        </div>
      </div>
    </section>
  );
}
