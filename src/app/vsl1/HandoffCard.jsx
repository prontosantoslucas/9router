"use client";

import Icon from "./Icon";
import { buildDemoHandoffMessage, whatsappUrl } from "./cta";
import { track } from "./track";

// Fechamento da demo. Aparece DEPOIS que a pessoa realmente conversou com o
// agente — é o pico de intenção da visita (ela acabou de sentir o produto
// funcionando, não leu sobre ele).
//
// Fica FORA do frame do celular de propósito: dentro dele quem fala é o agente
// da clínica fictícia ("Clínica Sorriso Vivo"), e seria incoerente esse agente
// vender o Zenda. Aqui é o Zenda falando, e isso tem que ficar claro.
//
// O link carrega o cenário + as perguntas reais no texto, então a conversa no
// WhatsApp começa com contexto em vez de "Olá".
export default function HandoffCard({ scenarioLabel, questions, variant = "engaged" }) {
  const message = buildDemoHandoffMessage({ scenarioLabel, questions });
  const href = whatsappUrl(message);

  const isFallback = variant === "fallback";

  return (
    <div
      className={`w-full max-w-[380px] rounded-2xl border p-5 text-center shadow-elev ${
        isFallback
          ? "border-border bg-surface"
          : "border-brand-500/40 bg-brand-500/5"
      }`}
    >
      <p className="text-sm font-semibold text-text-main">
        {isFallback
          ? "A demo travou — mas eu não."
          : "Gostou da resposta?"}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
        {isFallback
          ? "Essa demo roda num modelo gratuito e às vezes engasga. No WhatsApp da sua clínica o agente roda em infra dedicada. Fala comigo que eu te mostro ao vivo."
          : "Esse mesmo agente pode estar atendendo o WhatsApp da sua clínica em 5 dias. Levo o que você perguntou aqui pra conversa."}
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() =>
          track("demo_handoff_click", {
            cta_location: "demo",
            demo_scenario: scenarioLabel,
            demo_questions: questions.length,
            demo_variant: variant,
          })
        }
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-soft transition-all hover:bg-brand-600 hover:scale-105"
      >
        <Icon name="chat" className="w-[18px] h-[18px]" />
        Continuar no meu WhatsApp
      </a>
      <p className="mt-2.5 text-[11px] text-text-subtle">
        Abre o WhatsApp com a conversa já contextualizada
      </p>
    </div>
  );
}
