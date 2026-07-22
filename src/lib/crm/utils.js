// Utilitários puros do CRM — extraídos para viabilizar TDD sem RTL.
// Nada de JSX, nada de fetch. Só transformações.

export const STAGE_ORDER = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];

export const STAGE_LABELS = {
  lead: "Lead",
  qualified: "Qualificado",
  proposal: "Proposta",
  negotiation: "Negociação",
  won: "Ganho",
  lost: "Perdido",
};

export const ACTIVITY_ICONS = {
  call: "call",
  email: "mail",
  note: "sticky_note_2",
  meeting: "event",
  task: "task",
};

/**
 * Formata cents → moeda pt-BR. Aceita `null|undefined|NaN` retornando "—".
 * Se Intl.NumberFormat falhar (locale ausente em runtime restrito), cai em fallback simples.
 */
export function formatCurrency(cents, currency = "BRL") {
  if (!Number.isFinite(cents)) return "—";
  const value = cents / 100;
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
  } catch {
    return `R$ ${value.toFixed(2)}`;
  }
}

/**
 * Retorna o Material Symbol para um tipo de activity conhecido, ou "history" como fallback.
 */
export function iconForActivity(type) {
  return ACTIVITY_ICONS[type] || "history";
}

/**
 * Parse defensivo de JSON — devolve o objeto se já for objeto, `null` em qualquer falha.
 * Serve pro campo `metadata` das activities que vem serializado do SQLite.
 */
export function safeParse(json) {
  if (!json) return null;
  if (typeof json === "object") return json;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Converte input do formulário de deal em payload para a API.
 * O usuário digita valor em Reais (ex.: "1500.50") → mandamos cents (150050).
 * Se o input vier vazio, valor vai 0.
 */
export function toDealPayload(form) {
  const valueCents = form.valueCents ? Math.round(Number(form.valueCents) * 100) : 0;
  return {
    contactId: form.contactId || undefined,
    title: (form.title || "").trim(),
    valueCents: Number.isFinite(valueCents) ? valueCents : 0,
    currency: form.currency || "BRL",
    stage: form.stage || "lead",
    source: form.source || null,
    notes: form.notes || null,
  };
}

/**
 * Valida payload de deal antes de mandar. Retorna array de mensagens de erro (vazio = ok).
 */
export function validateDealPayload(payload, { requireContact = true } = {}) {
  const errors = [];
  if (!payload.title) errors.push("Título do deal é obrigatório.");
  if (requireContact && !payload.contactId && !payload.contactName) {
    errors.push("Contato é obrigatório (selecione um existente ou preencha nome).");
  }
  if (payload.valueCents != null && payload.valueCents < 0) {
    errors.push("Valor não pode ser negativo.");
  }
  if (payload.stage && !STAGE_ORDER.includes(payload.stage)) {
    errors.push(`Stage inválido: ${payload.stage}.`);
  }
  return errors;
}

/**
 * Filtra contatos por nome/email/empresa case-insensitive.
 */
export function filterContacts(contacts, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return contacts;
  return contacts.filter(
    (c) =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.company && c.company.toLowerCase().includes(q))
  );
}

/**
 * Divide uma string de tags "a, b, c" em array limpo.
 */
export function parseTagsInput(str) {
  return (str || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}
