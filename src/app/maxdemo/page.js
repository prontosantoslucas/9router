import Link from "next/link";
import DemoChat from "./DemoChat";
import Icon from "./Icon";
import Reveal from "./Reveal";

// WhatsApp direto do Lucas (marca MaxRouter). Trocar o número aqui
// pelo chip separado quando o Business estiver ativo.
const CTA_WHATSAPP =
  "https://wa.me/5511999999999?text=Olá!%20Vi%20o%20MaxRouter%20e%20quero%20saber%20mais%20sobre%20o%20agente%20de%20WhatsApp%20pra%20minha%20clínica.";

function Nav() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-border-subtle bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/maxdemo" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-soft">
            <Icon name="smart_toy" className="w-4 h-4" />
          </span>
          <span className="text-lg font-bold tracking-tight text-text-main">
            MaxRouter
          </span>
        </Link>
        <a
          href={CTA_WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-all hover:bg-brand-600 hover:shadow-warm sm:inline-flex"
        >
          <Icon name="chat" className="w-4 h-4" />
          Falar comigo
        </a>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-32 pb-8 text-center">
      <Reveal variant="bounce" delay={0}>
        <span className="inline-block rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-500">
          Agente de IA para clínicas
        </span>
      </Reveal>
      <Reveal variant="up" delay={120}>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-text-main sm:text-5xl md:text-6xl">
          Seu WhatsApp respondendo{" "}
          <span className="bg-gradient-to-r from-brand-500 to-brand-400 bg-clip-text text-transparent">
            paciente sozinho
          </span>
          , 24 horas por dia.
        </h1>
      </Reveal>
      <Reveal variant="up" delay={260}>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-text-muted">
          Um agente que qualifica interesse, tira dúvida, agenda no seu Google
          Calendar e nunca perde lead fora do horário. Instalação em 5 dias.
        </p>
      </Reveal>
      <Reveal variant="scale" delay={400}>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={CTA_WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-3 text-base font-semibold text-white shadow-soft transition-all hover:bg-brand-600 hover:shadow-warm hover:scale-105"
          >
            <Icon name="chat" className="w-5 h-5" />
            Quero pra minha clínica
          </a>
          <a
            href="#demo"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-6 py-3 text-base font-semibold text-text-main transition-all hover:border-brand-500 hover:text-brand-500 hover:scale-105"
          >
            <Icon name="play_arrow" className="w-5 h-5" strokeWidth={0} fill="currentColor" />
            Testar agora
          </a>
        </div>
      </Reveal>
      <Reveal variant="up" delay={540}>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-text-subtle">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
            Setup em 5 dias
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
            Sem contrato longo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
            Integrado ao seu Google Calendar
          </span>
        </div>
      </Reveal>
    </section>
  );
}

function DemoSection() {
  return (
    <section
      id="demo"
      className="mx-auto max-w-6xl px-6 py-16"
    >
      <Reveal variant="up">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-text-main sm:text-4xl">
            Teste com uma clínica de verdade
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-text-muted">
            Escolha um cenário e converse. O agente responde igual atenderia um
            paciente real da sua clínica.
          </p>
        </div>
      </Reveal>
      <Reveal variant="bounce" delay={200}>
        <DemoChat />
      </Reveal>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: "hearing",
      title: "1. Escuta",
      desc: "Recebe a mensagem do paciente no WhatsApp e entende o que ele quer, mesmo em português informal ou com erros.",
    },
    {
      icon: "psychology",
      title: "2. Qualifica",
      desc: "Pergunta o essencial (motivo, convênio, urgência) e diferencia curioso de paciente com interesse real.",
    },
    {
      icon: "event_available",
      title: "3. Agenda",
      desc: "Marca direto no seu Google Calendar, envia confirmação e cria lembrete. Sem passar pela sua secretária.",
    },
  ];
  return (
    <section className="border-t border-border-subtle bg-bg-alt py-16">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal variant="up">
          <h2 className="text-center text-3xl font-bold tracking-tight text-text-main sm:text-4xl">
            Como funciona
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.title} variant="bounce" delay={i * 150}>
              <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft transition-all hover:shadow-elev hover:-translate-y-1 duration-300">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                  <Icon name={s.icon} className="w-6 h-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-text-main">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">
                  {s.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-4xl px-6">
        <Reveal variant="up">
          <h2 className="text-center text-3xl font-bold tracking-tight text-text-main sm:text-4xl">
            Investimento
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-text-muted">
            Simples. Sem letra miúda. Sem lock-in.
          </p>
        </Reveal>

        <Reveal variant="bounce" delay={220}>
        <div className="mt-10 rounded-3xl border-2 border-brand-500 bg-surface p-8 shadow-elev transition-transform hover:scale-[1.01] duration-300">
          <div className="flex flex-col items-center text-center">
            <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-500">
              Plano Padrão
            </span>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-5xl font-bold tracking-tight text-text-main">
                R$ 1.997
              </span>
              <span className="text-text-muted">setup</span>
            </div>
            <p className="mt-1 text-sm text-text-muted">
              + R$ 297/mês de manutenção e hospedagem
            </p>

            <ul className="mt-8 space-y-3 text-left text-sm text-text-main">
              {[
                "Agente treinado com os dados da sua clínica",
                "Integração com WhatsApp Business (Evolution API)",
                "Agendamento direto no Google Calendar",
                "Painel de conversas e métricas",
                "Suporte técnico durante os primeiros 30 dias",
                "Sem contrato de fidelidade",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Icon name="check_circle" className="mt-0.5 w-[18px] h-[18px] text-brand-500 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <a
              href={CTA_WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-500 px-8 py-3 text-base font-semibold text-white shadow-soft transition-all hover:bg-brand-600 hover:shadow-warm"
            >
              Falar com o Lucas no WhatsApp
              <Icon name="arrow_forward" className="w-[18px] h-[18px]" />
            </a>
          </div>
        </div>
        </Reveal>
      </div>
    </section>
  );
}

function Faq() {
  const items = [
    {
      q: "Preciso mudar meu número de WhatsApp?",
      a: "Não. O agente conecta no seu número atual via WhatsApp Business API. Você continua atendendo pelo mesmo número — o agente só responde quando você não estiver disponível ou quando quiser filtrar.",
    },
    {
      q: "E se o agente errar uma resposta?",
      a: "Você tem controle total. No painel dá pra ver toda conversa, pausar o agente numa conversa específica, e ajustar o prompt em minutos. Nos primeiros 30 dias eu acompanho pessoalmente pra afinar.",
    },
    {
      q: "Funciona pra qualquer especialidade?",
      a: "Sim — odontologia, estética, veterinária, medicina, fisioterapia, psicologia. O agente é personalizado com os dados e o tom da sua clínica.",
    },
    {
      q: "Quanto tempo pra ficar rodando?",
      a: "5 dias corridos após a contratação. Dia 1-2: eu coleto dados da clínica. Dia 3-4: treino o agente. Dia 5: coloco no ar.",
    },
  ];
  return (
    <section className="border-t border-border-subtle bg-bg-alt py-16">
      <div className="mx-auto max-w-3xl px-6">
        <Reveal variant="up">
          <h2 className="text-center text-3xl font-bold tracking-tight text-text-main sm:text-4xl">
            Perguntas frequentes
          </h2>
        </Reveal>
        <div className="mt-8 space-y-4">
          {items.map((item, i) => (
            <Reveal key={item.q} variant="left" delay={i * 90}>
              <details className="group rounded-2xl border border-border bg-surface p-5 shadow-soft transition-shadow hover:shadow-elev">
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-semibold text-text-main">
                  {item.q}
                  <Icon name="add" className="w-5 h-5 text-brand-500 transition-transform group-open:rotate-45 shrink-0 duration-300" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-text-muted">
                  {item.a}
                </p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaFinal() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <Reveal variant="up">
          <h2 className="text-3xl font-bold tracking-tight text-text-main sm:text-4xl">
            Toda mensagem sem resposta é um paciente indo pra concorrência.
          </h2>
        </Reveal>
        <Reveal variant="up" delay={200}>
          <p className="mt-4 text-lg text-text-muted">
            Configura em 5 dias. Nunca mais perde lead fora do horário.
          </p>
        </Reveal>
        <Reveal variant="bounce" delay={400}>
          <a
            href={CTA_WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-500 px-8 py-4 text-lg font-semibold text-white shadow-elev transition-all hover:bg-brand-600 hover:scale-105 duration-300"
          >
            <Icon name="chat" className="w-5 h-5" />
            Chamar Lucas no WhatsApp
          </a>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border-subtle py-8 text-center text-sm text-text-subtle">
      <p>
        © 2026 MaxRouter — Automação com IA para clínicas
      </p>
      <p className="mt-1 text-xs">
        Feito com foco em clínicas pequenas e médias no Brasil.
      </p>
    </footer>
  );
}

export default function MaxDemoPage() {
  return (
    <main className="min-h-screen bg-bg">
      <Nav />
      <Hero />
      <DemoSection />
      <HowItWorks />
      <Pricing />
      <Faq />
      <CtaFinal />
      <Footer />
    </main>
  );
}
