// Número + construtores de mensagem do CTA WhatsApp.
//
// Ficava hardcoded dentro de page.js. Foi extraído porque a demo (DemoChat)
// agora também precisa gerar links de WhatsApp — número de contato comercial
// duplicado em dois arquivos é o tipo de coisa que fica dessincronizada na
// primeira troca de chip.

export const WHATSAPP_NUMBER = "5511913530262";

export function whatsappUrl(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

// CTA genérico (nav, hero, pricing, cta final) — visitante que não passou
// pela demo, então não há contexto de conversa pra carregar.
export const CTA_DEFAULT_MESSAGE =
  "Olá! Vi o Zenda e quero o agente que atende WhatsApp da minha clínica automaticamente.";

export const CTA_WHATSAPP = whatsappUrl(CTA_DEFAULT_MESSAGE);

// Limite por pergunta ao montar a mensagem contextual. wa.me passa a mensagem
// na query string; pergunta longa demais estoura o limite prático de URL e o
// WhatsApp trunca do jeito errado (ou o link simplesmente não abre).
const MAX_QUESTION_LEN = 120;
const MAX_QUESTIONS = 3;

function trim(q) {
  const s = String(q || "").trim().replace(/\s+/g, " ");
  return s.length > MAX_QUESTION_LEN ? `${s.slice(0, MAX_QUESTION_LEN - 1)}…` : s;
}

// Handoff da demo → WhatsApp real. A mensagem carrega o cenário escolhido e
// o que a pessoa de fato perguntou, então a conversa começa com contexto
// ("dono de clínica de estética que perguntou preço") em vez de um "Olá" seco.
export function buildDemoHandoffMessage({ scenarioLabel, questions = [] }) {
  const lines = [
    `Olá! Acabei de testar o agente do Zenda no site (demo de ${scenarioLabel}).`,
  ];

  const asked = questions.map(trim).filter(Boolean).slice(0, MAX_QUESTIONS);
  if (asked.length) {
    lines.push("", "O que eu perguntei pro agente:");
    for (const q of asked) lines.push(`• ${q}`);
  }

  lines.push("", "Quero saber como isso fica pra minha clínica.");
  return lines.join("\n");
}
