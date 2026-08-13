import Link from "next/link";
import DemoChat from "./DemoChat";
import Icon from "./Icon";
import Reveal from "./Reveal";

// Estrutura: PAS (Problem → Agitation → Solution) + prova social + garantia.
// Público: donos de clínica (odonto/estética/veterinária).
// Psicologia de cor: brand-500 (verde-esmeralda) = saúde+crescimento (mantido);
// bg-alt em seção de problema (leve tensão); brand em seção de solução (alívio);
// destaques em vermelho suave só no aviso de perda financeira concreta.

const BRAND = "Zenda";
const BRAND_DOMAIN = "zenda.app.br";

const CTA_WHATSAPP =
  "https://wa.me/5511913530262?text=Ol%C3%A1!%20Vi%20o%20Zenda%20e%20quero%20o%20agente%20que%20atende%20WhatsApp%20da%20minha%20cl%C3%ADnica%20automaticamente.";

function Nav() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-border-subtle bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/vsl1" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-soft">
            <Icon name="smart_toy" className="w-4 h-4" />
          </span>
          <span className="text-lg font-bold tracking-tight text-text-main">
            {BRAND}
          </span>
        </Link>
        <a
          href={CTA_WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-all hover:bg-brand-600 hover:shadow-warm hover:scale-105 sm:inline-flex"
        >
          <Icon name="chat" className="w-4 h-4" />
          Falar comigo
        </a>
      </div>
    </nav>
  );
}

// ============================================================
// HERO — Attention: dor calibrada, específica, quantificada
// ============================================================
function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-12">
      {/* halo suave decorativo — cor de crescimento */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(16,163,127,0.10),transparent_45%)]" />

      <div className="relative mx-auto max-w-6xl px-6 text-center">
        <Reveal variant="bounce" delay={0}>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-500">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
            </span>
            Já funcionando em clínicas no Brasil
          </span>
        </Reveal>

        <Reveal variant="up" delay={120}>
          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold leading-[1.1] tracking-tight text-text-main sm:text-5xl md:text-6xl">
            Sua clínica está{" "}
            <span className="bg-gradient-to-r from-brand-500 to-brand-400 bg-clip-text text-transparent">
              perdendo pacientes
            </span>{" "}
            enquanto você lê isso.
          </h1>
        </Reveal>

        <Reveal variant="up" delay={260}>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-text-muted">
            Toda mensagem que fica sem resposta no WhatsApp é um paciente
            escolhendo a concorrência. <b className="text-text-main">6 em cada 10</b> desistem
            se ninguém responde em <b className="text-text-main">10 minutos</b>.
            <br />
            <span className="mt-2 inline-block">
              Nosso agente de IA responde em <b className="text-brand-500">15 segundos</b>,
              qualifica o paciente e agenda direto no seu Google Calendar —{" "}
              <b className="text-text-main">24 horas por dia</b>.
            </span>
          </p>
        </Reveal>

        <Reveal variant="scale" delay={420}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#demo"
              className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-7 py-3.5 text-base font-semibold text-white shadow-elev transition-all hover:bg-brand-600 hover:shadow-warm hover:scale-105"
            >
              <Icon name="play_arrow" className="w-5 h-5" strokeWidth={0} fill="currentColor" />
              Ver o agente funcionando (grátis)
            </a>
            <a
              href={CTA_WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-6 py-3.5 text-base font-semibold text-text-main transition-all hover:border-brand-500 hover:text-brand-500 hover:scale-105"
            >
              <Icon name="chat" className="w-5 h-5" />
              Falar direto no WhatsApp
            </a>
          </div>
        </Reveal>

        <Reveal variant="up" delay={560}>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-text-subtle">
            <span className="flex items-center gap-1.5">
              <Icon name="check_circle" className="w-4 h-4 text-brand-500" />
              Funcionando em 5 dias
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="check_circle" className="w-4 h-4 text-brand-500" />
              Sem contrato de fidelidade
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="check_circle" className="w-4 h-4 text-brand-500" />
              Garantia de 30 dias
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ============================================================
// Números — capacidades REAIS do produto (nada inventado de mercado)
// ============================================================
function NumbersBar() {
  const stats = [
    { number: "15s", label: "tempo médio de resposta do agente a cada mensagem" },
    { number: "24/7", label: "atende madrugada, feriado e fim de semana sem parar" },
    { number: "5 dias", label: "do questionário até o agente rodando no seu WhatsApp" },
    { number: "R$ 0", label: "de lead perdido por ninguém responder fora do horário" },
  ];
  return (
    <section className="border-y border-border-subtle bg-bg-alt py-10">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 md:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal key={s.label} variant="up" delay={i * 90}>
            <div className="text-center">
              <div className="text-3xl font-bold tracking-tight text-brand-500 md:text-4xl">
                {s.number}
              </div>
              <div className="mt-1 text-xs text-text-muted md:text-sm">{s.label}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// PROBLEM — nomeia a dor com exemplos concretos do dia a dia
// ============================================================
function Problem() {
  const pains = [
    {
      icon: "hearing",
      title: "Mensagens perdidas na madrugada",
      desc: "Paciente vê o Insta às 22h, chama no WhatsApp — ninguém responde. Amanhã, ele já marcou em outro lugar.",
    },
    {
      icon: "psychology",
      title: "Secretária sobrecarregada",
      desc: "Ela atende telefone, recebe paciente, controla fila. WhatsApp acumula. Você perde consulta sem nem saber.",
    },
    {
      icon: "event_available",
      title: "Agenda com buracos caros",
      desc: "Horários que ficam vazios porque ninguém teve tempo de correr atrás. Cada slot vago é uma consulta que evaporou.",
    },
  ];
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal variant="up">
          <p className="text-center text-sm font-semibold uppercase tracking-widest text-brand-500">
            O que acontece hoje
          </p>
          <h2 className="mx-auto mt-2 max-w-3xl text-center text-3xl font-bold tracking-tight text-text-main sm:text-4xl">
            Você já perdeu esta semana — só ainda não sabe quantos.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-text-muted">
            A maior perda de receita numa clínica não é procedimento não vendido.
            É lead que chegou e ninguém atendeu a tempo.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {pains.map((p, i) => (
            <Reveal key={p.title} variant="bounce" delay={i * 130}>
              <div className="group rounded-2xl border border-border bg-surface p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-brand-500/40 hover:shadow-elev">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-danger/10 text-danger transition-colors group-hover:bg-brand-500/10 group-hover:text-brand-500">
                  <Icon name={p.icon} className="w-6 h-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-text-main">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{p.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// SOLUTION — a demo (contexto de alívio depois da dor)
// ============================================================
function DemoSection() {
  return (
    <section
      id="demo"
      className="relative border-y border-border-subtle bg-bg-alt py-20"
    >
      <div className="mx-auto max-w-6xl px-6">
        <Reveal variant="up">
          <p className="text-center text-sm font-semibold uppercase tracking-widest text-brand-500">
            A solução em ação
          </p>
          <h2 className="mx-auto mt-2 max-w-3xl text-center text-3xl font-bold tracking-tight text-text-main sm:text-4xl">
            Conversa com o agente agora. Ele responde em 15 segundos.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-text-muted">
            Escolha o cenário da sua área e faça perguntas como se você fosse um
            paciente. O que você vê aqui é o mesmo comportamento que ele terá no
            WhatsApp da sua clínica.
          </p>
        </Reveal>
        <Reveal variant="bounce" delay={220}>
          <div className="mt-12">
            <DemoChat />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ============================================================
// HOW IT WORKS — desmistifica ("não é um chatbot burro")
// ============================================================
function HowItWorks() {
  const steps = [
    {
      icon: "hearing",
      title: "1. Escuta e entende",
      desc: "Recebe a mensagem em português informal, com abreviações, erros — e entende. Não trava em 'digite 1 para agendar'.",
    },
    {
      icon: "psychology",
      title: "2. Qualifica com naturalidade",
      desc: "Pergunta o essencial (motivo, urgência, convênio) sem parecer formulário. Filtra curioso de paciente com interesse real.",
    },
    {
      icon: "event_available",
      title: "3. Agenda direto no seu calendário",
      desc: "Cria o evento no Google Calendar, envia confirmação e agenda lembrete 24h antes. Sua secretária vê a agenda pronta.",
    },
  ];
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal variant="up">
          <p className="text-center text-sm font-semibold uppercase tracking-widest text-brand-500">
            Como funciona
          </p>
          <h2 className="mx-auto mt-2 max-w-2xl text-center text-3xl font-bold tracking-tight text-text-main sm:text-4xl">
            Nem robô com árvore de menu. Nem promessa mágica.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-text-muted">
            É um agente de IA treinado com os dados <b className="text-text-main">da sua</b> clínica — o tom que você usa, os serviços que oferece, os convênios que aceita, as respostas que você já dá todo dia.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.title} variant="bounce" delay={i * 150}>
              <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-elev">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                  <Icon name={s.icon} className="w-6 h-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-text-main">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// COMPARISON — sua secretária vs seu agente (anchoring)
// ============================================================
function Comparison() {
  const rows = [
    { label: "Custo mensal", human: "R$ 2.500 – R$ 4.000", agent: "R$ 297" },
    { label: "Horário de atendimento", human: "8h às 18h, seg-sáb", agent: "24h por dia, 7 dias por semana" },
    { label: "Tempo de resposta médio", human: "20 min a 2h", agent: "15 segundos" },
    { label: "Escala com mais mensagens", human: "Trava (fila fica pra depois)", agent: "Responde 100 ao mesmo tempo" },
    { label: "Precisa férias / atestado", human: "Sim, e agenda fica descoberta", agent: "Não" },
    { label: "Erra tom com paciente irritado", human: "Depende do humor", agent: "Sempre calmo" },
  ];
  return (
    <section className="border-y border-border-subtle bg-bg-alt py-20">
      <div className="mx-auto max-w-4xl px-6">
        <Reveal variant="up">
          <p className="text-center text-sm font-semibold uppercase tracking-widest text-brand-500">
            Comparação honesta
          </p>
          <h2 className="mt-2 text-center text-3xl font-bold tracking-tight text-text-main sm:text-4xl">
            O agente não substitui sua secretária. Trabalha do lado dela.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-text-muted">
            Ele responde WhatsApp e agenda; ela cuida do paciente presencial e casos delicados. Custa 10x menos do que contratar uma segunda pessoa — e cobre o que ninguém cobria antes.
          </p>
        </Reveal>

        <Reveal variant="bounce" delay={220}>
          <div className="mt-12 overflow-hidden rounded-3xl border border-border bg-surface shadow-elev">
            <div className="grid grid-cols-3 border-b border-border bg-bg-alt p-4 text-xs font-semibold uppercase tracking-wider text-text-muted md:text-sm">
              <div>Aspecto</div>
              <div className="text-center">Secretária extra</div>
              <div className="text-center text-brand-500">Agente de IA</div>
            </div>
            {rows.map((r) => (
              <div key={r.label} className="grid grid-cols-3 border-b border-border-subtle p-4 text-sm last:border-b-0">
                <div className="font-medium text-text-main">{r.label}</div>
                <div className="text-center text-text-muted">{r.human}</div>
                <div className="text-center font-semibold text-brand-600 dark:text-brand-400">{r.agent}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ============================================================
// FOUNDER NOTE — honestidade radical em vez de testemunho fake.
// Cria dinâmica "entre cedo" + prova de que tem gente de verdade atrás.
// ============================================================
function FounderNote() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-3xl px-6">
        <Reveal variant="scale">
          <div className="relative rounded-3xl border border-border bg-surface p-8 shadow-elev md:p-12">
            <div className="absolute -top-4 left-8 rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white">
              Uma conversa honesta
            </div>
            <p className="text-lg leading-relaxed text-text-main md:text-xl">
              &ldquo;Sou desenvolvedor e construí o Zenda porque cansei de ver
              clínica boa perdendo paciente por um motivo bobo: ninguém respondeu
              a tempo no WhatsApp. Estou selecionando as primeiras clínicas pra
              rodar comigo de perto — por isso limito a 4 setups por mês e
              acompanho cada um pessoalmente nos primeiros 30 dias. Se você entrar
              agora, fala direto comigo, não com um suporte genérico.&rdquo;
            </p>
            <div className="mt-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 font-bold text-white">
                L
              </div>
              <div>
                <div className="font-semibold text-text-main">Lucas — fundador do Zenda</div>
                <div className="text-sm text-text-muted">Desenvolvedor · fala com você no WhatsApp</div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ============================================================
// PRICING — anchoring + scarcity real
// ============================================================
function Pricing() {
  const includes = [
    "Agente treinado com os dados da SUA clínica (tom, serviços, convênios)",
    "Integração com WhatsApp Business (Evolution API)",
    "Agendamento automático no Google Calendar",
    "Follow-up automático 24h antes da consulta",
    "Painel de conversas + métricas semanais",
    "Suporte técnico personalizado nos primeiros 30 dias",
    "Ajustes de prompt/tom sob demanda",
    "Sem contrato de fidelidade — cancela quando quiser",
  ];
  return (
    <section className="border-y border-border-subtle bg-bg-alt py-20">
      <div className="mx-auto max-w-4xl px-6">
        <Reveal variant="up">
          <p className="text-center text-sm font-semibold uppercase tracking-widest text-brand-500">
            Investimento
          </p>
          <h2 className="mt-2 text-center text-3xl font-bold tracking-tight text-text-main sm:text-4xl">
            Uma consulta perdida por mês já paga o agente.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-text-muted">
            Cada paciente novo agendado paga R$ 200-800 (dependendo da sua área). Se o agente traz 1 paciente extra por mês, você já ficou no zero. A partir do 2º, é lucro.
          </p>
        </Reveal>

        <Reveal variant="bounce" delay={220}>
          <div className="mt-12 overflow-hidden rounded-3xl border-2 border-brand-500 bg-surface shadow-elev transition-transform hover:scale-[1.01] duration-300">
            <div className="bg-brand-500 py-2 text-center text-xs font-semibold uppercase tracking-widest text-white">
              ⚡ Vagas limitadas — só 4 setups por mês
            </div>
            <div className="p-8 md:p-10">
              <div className="flex flex-col items-center text-center">
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-6xl font-bold tracking-tight text-text-main">
                    R$ 1.997
                  </span>
                  <span className="text-lg text-text-muted">setup</span>
                </div>
                <p className="mt-2 text-sm text-text-muted">
                  + R$ 297/mês (hospedagem, manutenção e suporte)
                </p>
                <p className="mt-1 text-xs text-text-subtle">
                  Comparado a contratar secretária extra: R$ 2.500 – R$ 4.000/mês
                </p>

                <ul className="mt-8 grid gap-3 text-left text-sm md:grid-cols-2">
                  {includes.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Icon name="check_circle" className="mt-0.5 w-[18px] h-[18px] text-brand-500 shrink-0" />
                      <span className="text-text-main">{item}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={CTA_WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-10 inline-flex items-center gap-2 rounded-full bg-brand-500 px-8 py-4 text-lg font-semibold text-white shadow-elev transition-all hover:bg-brand-600 hover:scale-105 duration-300"
                >
                  Quero garantir minha vaga
                  <Icon name="arrow_forward" className="w-[18px] h-[18px]" />
                </a>
                <p className="mt-3 text-xs text-text-subtle">
                  Pagamento no PIX ou cartão em até 12x. Sem letra miúda.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ============================================================
// GUARANTEE — reduz atrito da decisão
// ============================================================
function Guarantee() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-3xl px-6">
        <Reveal variant="scale">
          <div className="flex flex-col items-center gap-6 rounded-3xl border-2 border-dashed border-brand-500/40 bg-brand-500/5 p-8 text-center md:flex-row md:text-left">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white shadow-elev">
              <Icon name="check_circle" className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-text-main">
                Garantia de 30 dias ou seu dinheiro de volta
              </h3>
              <p className="mt-2 text-text-muted">
                Se em 30 dias o agente não resolver a dor do seu WhatsApp,
                devolvo os R$ 1.997 do setup — sem perguntas.{" "}
                <b className="text-text-main">O risco é meu, não seu.</b>
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ============================================================
// FAQ — objeções antecipadas
// ============================================================
function Faq() {
  const items = [
    {
      q: "Vou perder o toque humano com meus pacientes?",
      a: "Não. O agente cobre a triagem inicial e as perguntas repetitivas que sua equipe responde 30x por dia (horário, preço médio, convênio, disponibilidade). Quando a conversa exige empatia real ou decisão clínica, ele escala pra você — automaticamente. O paciente sente a diferença: rápido no operacional, humano onde importa.",
    },
    {
      q: "E se o agente errar uma resposta?",
      a: "Nos primeiros 30 dias, você acompanha TODA conversa antes dela ir. É modo revisão: eu ajusto o tom, adiciono FAQ, corrijo o que passar do desejado. Depois do 30º dia, você já confia (e ainda tem o painel pra pausar em qualquer conversa específica).",
    },
    {
      q: "Preciso mudar meu número atual de WhatsApp?",
      a: "Não. Conectamos no seu número via WhatsApp Business API. Continua o mesmo pra pacientes. Você define quando quer o agente responder (só fora do horário? sempre? só depois de X minutos sem resposta humana? — tudo configurável).",
    },
    {
      q: "Funciona pra minha especialidade?",
      a: "Se você lida com WhatsApp de pacientes/clientes, funciona. Já uso pra odontologia, estética, veterinária, dermatologia, fisioterapia, psicologia. O agente é personalizado com os dados da SUA clínica — não é template genérico.",
    },
    {
      q: "Quanto tempo pra ficar rodando?",
      a: "5 dias corridos depois que você preenche o questionário. Dia 1-2: eu coleto seus dados e treino o agente. Dia 3-4: você testa e valida com mensagens simuladas. Dia 5: entra em modo revisão no seu WhatsApp real.",
    },
    {
      q: "E se eu cancelar depois de 3 meses?",
      a: "Cancela. Sem contrato, sem multa, sem letra miúda. O painel + histórico ficam disponíveis por 90 dias caso queira voltar depois.",
    },
  ];
  return (
    <section className="border-t border-border-subtle bg-bg-alt py-20">
      <div className="mx-auto max-w-3xl px-6">
        <Reveal variant="up">
          <p className="text-center text-sm font-semibold uppercase tracking-widest text-brand-500">
            Dúvidas comuns
          </p>
          <h2 className="mt-2 text-center text-3xl font-bold tracking-tight text-text-main sm:text-4xl">
            Perguntas que outros donos de clínica fizeram antes de fechar
          </h2>
        </Reveal>
        <div className="mt-10 space-y-4">
          {items.map((item, i) => (
            <Reveal key={item.q} variant="left" delay={i * 60}>
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

// ============================================================
// CTA FINAL — urgência calibrada + micro-copy que reduz atrito
// ============================================================
function CtaFinal() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,163,127,0.14),transparent_60%)]" />
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <Reveal variant="up">
          <h2 className="text-3xl font-bold tracking-tight text-text-main sm:text-4xl md:text-5xl">
            Enquanto você pensa, mais um paciente foi pro concorrente.
          </h2>
        </Reveal>
        <Reveal variant="up" delay={180}>
          <p className="mt-5 text-lg text-text-muted">
            Configuro no máximo <b className="text-text-main">4 clínicas por mês</b> pra
            garantir treinamento personalizado. Chama no WhatsApp que eu te mostro se faz sentido pra sua clínica.
          </p>
        </Reveal>
        <Reveal variant="bounce" delay={360}>
          <a
            href={CTA_WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-brand-500 px-10 py-5 text-lg font-semibold text-white shadow-elev transition-all hover:bg-brand-600 hover:scale-105 hover:shadow-warm duration-300 sm:text-xl"
          >
            <Icon name="chat" className="w-6 h-6" />
            Quero ver se funciona pra minha clínica
          </a>
        </Reveal>
        <Reveal variant="up" delay={520}>
          <p className="mt-5 text-xs text-text-subtle">
            15 min de conversa · Sem compromisso · Se não fizer sentido, saio na hora
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border-subtle bg-bg-alt py-10 text-center text-sm text-text-subtle">
      <p>
        © 2026 {BRAND} · <a href={`https://${BRAND_DOMAIN}`} className="hover:text-brand-500">{BRAND_DOMAIN}</a>
      </p>
      <p className="mt-1 text-xs">
        Agente de IA para clínicas — feito com foco em clínicas pequenas e médias no Brasil.
      </p>
    </footer>
  );
}

export default function MaxDemoPage() {
  return (
    <main className="min-h-screen bg-bg">
      <Nav />
      <Hero />
      <NumbersBar />
      <Problem />
      <DemoSection />
      <HowItWorks />
      <Comparison />
      <FounderNote />
      <Pricing />
      <Guarantee />
      <Faq />
      <CtaFinal />
      <Footer />
    </main>
  );
}
