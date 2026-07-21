"use client";

export default function HowItWorks() {
  const steps = [
    {
      num: "01",
      title: "Conecte seus Provedores & Gateway",
      desc: "Cadastre suas chaves de IA (Gemini, Claude, OpenAI) no 9Router e use uma única URL OpenAI-compatible.",
      icon: "hub",
    },
    {
      num: "02",
      title: "Personalize o Agente Lucas",
      desc: "Cole a URL de um documento Markdown no GitHub (público ou privado) para definir as regras e personalidade do Lucas.",
      icon: "tune",
    },
    {
      num: "03",
      title: "Conecte WhatsApp & Telegram",
      desc: "Pareie seu WhatsApp via QR Code (Evolution API) e conecte sua conta pessoal no Telegram via Userbot MTProto.",
      icon: "devices",
    },
    {
      num: "04",
      title: "Atendimento & Memória Contínua",
      desc: "O Lucas atende autonomamente com busca semântica no ai-memory, áudio STT/TTS e aprovação no Modo Co-Piloto.",
      icon: "psychology",
    },
  ];

  return (
    <section id="how-it-works" className="py-24 px-6 relative border-t border-border/40 bg-hero-gradient">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-text-main">Como Funciona</h2>
          <p className="text-base text-text-muted">
            Da orquestração de LLMs ao atendimento automático em menos de 5 minutos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step) => (
            <div key={step.num} className="card-soft p-6 border border-border relative flex flex-col justify-between hover:border-brand-500/50 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-black text-brand-500">{step.num}</span>
                  <span className="material-symbols-outlined text-text-muted text-2xl">{step.icon}</span>
                </div>
                <h3 className="font-bold text-base text-text-main mb-2">{step.title}</h3>
                <p className="text-xs text-text-muted leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
