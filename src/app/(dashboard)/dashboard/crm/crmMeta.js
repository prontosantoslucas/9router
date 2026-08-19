// Shared CRM metadata: statuses, priorities, stages and formatting helpers
// Design tokens (bg-label-*, text-label-*) are defined in src/app/globals.css

export const CONTACT_STATUSES = [
  { value: "lead", label: "Lead", color: "blue", icon: "radar" },
  { value: "prospect", label: "Prospect", color: "purple", icon: "filter_tilt_shift" },
  { value: "customer", label: "Cliente", color: "emerald", icon: "verified" },
  { value: "inactive", label: "Inativo", color: "grey", icon: "pause_circle" },
];

export const PRIORITIES = [
  { value: "urgent", label: "Urgente", color: "crimson", icon: "priority_high", badge: "URG" },
  { value: "high", label: "Alta", color: "orange", icon: "keyboard_double_arrow_up", badge: "ALTA" },
  { value: "medium", label: "Média", color: "blue", icon: "drag_handle", badge: "MÉD" },
  { value: "low", label: "Baixa", color: "grey", icon: "keyboard_arrow_down", badge: "BAIXA" },
  { value: "none", label: "Sem prioridade", color: "grey", icon: "remove", badge: "—" },
];

export const DEAL_STAGES = [
  { value: "lead", label: "Novo Lead", color: "blue", probability: 0.1, icon: "lightbulb" },
  { value: "qualified", label: "Qualificado", color: "cyan", probability: 0.25, icon: "contact_page" },
  { value: "proposal", label: "Proposta Enviada", color: "purple", probability: 0.5, icon: "description" },
  { value: "negotiation", label: "Em Negociação", color: "orange", probability: 0.75, icon: "handshake" },
  { value: "won", label: "Fechado / Ganho", color: "emerald", probability: 1.0, icon: "check_circle" },
  { value: "lost", label: "Perdido", color: "crimson", probability: 0.0, icon: "cancel" },
  { value: "cancelled", label: "Cancelado", color: "grey", probability: 0.0, icon: "block" },
];

export const LEAD_SOURCES = [
  { value: "whatsapp", label: "WhatsApp", icon: "chat", color: "emerald" },
  { value: "prospector", label: "Prospecção 24/7", icon: "smart_toy", color: "indigo" },
  { value: "inbound", label: "Site / Inbound", icon: "language", color: "cyan" },
  { value: "referral", label: "Indicação", icon: "people", color: "purple" },
  { value: "outbound", label: "Outbound", icon: "outgoing_mail", color: "blue" },
  { value: "other", label: "Outros", icon: "category", color: "grey" },
];

export const OPEN_STAGES = ["lead", "qualified", "proposal", "negotiation"];

const COLOR_MAP = {
  blue: { bg: "bg-label-blue-bg", text: "text-label-blue", border: "border-blue-500/30" },
  cyan: { bg: "bg-label-cyan-bg", text: "text-label-cyan", border: "border-cyan-500/30" },
  emerald: { bg: "bg-label-emerald-bg", text: "text-label-emerald", border: "border-emerald-500/30" },
  grey: { bg: "bg-label-grey-bg", text: "text-label-grey", border: "border-gray-500/30" },
  crimson: { bg: "bg-label-crimson-bg", text: "text-label-crimson", border: "border-red-500/30" },
  yellow: { bg: "bg-label-yellow-bg", text: "text-label-yellow", border: "border-yellow-500/30" },
  orange: { bg: "bg-label-orange-bg", text: "text-label-orange", border: "border-orange-500/30" },
  pink: { bg: "bg-label-pink-bg", text: "text-label-pink", border: "border-pink-500/30" },
  purple: { bg: "bg-label-purple-bg", text: "text-label-purple", border: "border-purple-500/30" },
  indigo: { bg: "bg-label-indigo-bg", text: "text-label-indigo", border: "border-indigo-500/30" },
};

export function statusMeta(status) {
  const found = CONTACT_STATUSES.find((s) => s.value === status);
  const color = found ? found.color : "grey";
  return {
    label: found ? found.label : status || "Lead",
    icon: found ? found.icon : "person",
    ...COLOR_MAP[color],
  };
}

export function priorityMeta(priority) {
  const found = PRIORITIES.find((p) => p.value === priority);
  const color = found ? found.color : "grey";
  return {
    label: found ? found.label : priority || "Sem prioridade",
    icon: found ? found.icon : "remove",
    badge: found ? found.badge : "—",
    ...COLOR_MAP[color],
  };
}

export function stageMeta(stage) {
  const found = DEAL_STAGES.find((s) => s.value === stage);
  const color = found ? found.color : "grey";
  return {
    label: found ? found.label : stage || "Lead",
    icon: found ? found.icon : "label",
    probability: found ? found.probability : 0.1,
    ...COLOR_MAP[color],
  };
}

export function sourceMeta(source) {
  const found = LEAD_SOURCES.find((s) => s.value === source);
  const color = found ? found.color : "grey";
  return {
    label: found ? found.label : source || "Geral",
    icon: found ? found.icon : "tag",
    ...COLOR_MAP[color],
  };
}

export function tagMeta(tag) {
  const palette = ["blue", "indigo", "purple", "pink", "emerald", "cyan", "orange", "yellow", "crimson", "grey"];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  const color = palette[hash % palette.length];
  return COLOR_MAP[color];
}

export function formatCurrency(cents, currency = "BRL") {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency || "BRL",
      maximumFractionDigits: 2,
    }).format((cents || 0) / 100);
  } catch {
    return `${((cents || 0) / 100).toFixed(2)} ${currency}`;
  }
}

export function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function timeAgo(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d atrás`;
  return formatDate(iso);
}

export function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function avatarColor(name = "") {
  const palette = [
    "bg-label-indigo-bg text-label-indigo border-indigo-500/20",
    "bg-label-purple-bg text-label-purple border-purple-500/20",
    "bg-label-emerald-bg text-label-emerald border-emerald-500/20",
    "bg-label-cyan-bg text-label-cyan border-cyan-500/20",
    "bg-label-orange-bg text-label-orange border-orange-500/20",
    "bg-label-pink-bg text-label-pink border-pink-500/20",
    "bg-label-blue-bg text-label-blue border-blue-500/20",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

export function formatWhatsAppUrl(phone, defaultText = "Olá, tudo bem?") {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;
  const normalized = digits.length <= 11 && !digits.startsWith("55") ? `55${digits}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(defaultText)}`;
}

