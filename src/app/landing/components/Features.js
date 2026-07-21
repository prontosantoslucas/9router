"use client";

export default function Features() {
  const featuresList = [
    {
      title: "Gateway OpenAI-Compatible",
      desc: "Um único endpoint para Claude Code, OpenAI Codex, Gemini, Groq e modelos locais com rotação de chaves e fallback.",
      icon: "dns",
    },
    {
      title: "Telegram Userbot (MTProto)",
      desc: "O Lucas responde no Telegram pela sua conta pessoal sem o selo de bot, atuando diretamente em chats privados.",
      icon: "send",
    },
    {
      title: "WhatsApp via Evolution API",
      desc: "Atendimento automático e inteligente no WhatsApp com pareamento simples por QR Code no painel.",
      icon: "chat",
    },
    {
      title: "Memória Obrigatória ai-memory",
      desc: "Engine de memória de longo prazo baseada em wiki markdown e busca semântica para retenção de contexto.",
      icon: "psychology",
    },
    {
      title: "Personalidade via GitHub",
      desc: "Sincronização dinâmica de instruções de conduta a partir de um documento .md público ou privado no GitHub.",
      icon: "code",
    },
    {
      title: "Modo Co-Piloto (Human-in-the-Loop)",
      desc: "Rascunhos de resposta gerados para você aprovar ou editar em 1-clique antes do envio final.",
      icon: "verified_user",
    },
    {
      title: "Áudio STT & TTS",
      desc: "Transcrição automática de notas de voz recebidas e síntese de voz realista para respostas em áudio.",
      icon: "record_voice_over",
    },
    {
      title: "Daily Executive Briefing",
      desc: "Relatório diário matinal às 8h compilando compromissos do Google Calendar, e-mails do Gmail e pendências.",
      icon: "free_breakfast",
    },
  ];

  return (
    <section id="features" className="py-24 px-6 relative bg-bg">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-text-main">Recursos de Classe Executiva</h2>
          <p className="text-base text-text-muted">
            Tudo o que você precisa para gerenciar modelos de IA e automatizar seu atendimento em um só lugar.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuresList.map((f, i) => (
            <div key={i} className="card-soft p-6 border border-border flex flex-col justify-between hover:border-brand-500/50 transition-all">
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500 mb-4">
                  <span className="material-symbols-outlined text-2xl">{f.icon}</span>
                </div>
                <h3 className="font-bold text-base text-text-main mb-2">{f.title}</h3>
                <p className="text-xs text-text-muted leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
