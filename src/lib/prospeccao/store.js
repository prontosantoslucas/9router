import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR } from "@/lib/dataDir.js";
import { SEED_LEADS } from "./seed.js";

// Persistência simples em JSON no volume — escolhida deliberadamente em vez de
// migração no SQLite principal (dado o histórico de fragilidade de deploy).
// Uso single-user (Lucas), então sem preocupação com concorrência.
const FILE = path.join(DATA_DIR, "prospeccao.json");

function ensureDir() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
}

function newId() {
  return crypto.randomBytes(8).toString("hex");
}

function nowISO() {
  return new Date().toISOString();
}

function seedLead(l) {
  return {
    id: newId(),
    name: l.name || "",
    niche: l.niche || "outro",
    city: l.city || "",
    instagram: l.instagram || "",
    whatsapp: l.whatsapp || "",
    contactName: l.contactName || "",
    context: l.context || "",
    source: l.source || "seed",
    status: "novo", // novo | gerado | enviado | respondeu | sem_resposta | descartado
    dmInstagram: "",
    dmWhatsapp: "",
    followup: "",
    lastSentAt: null,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
}

function load() {
  ensureDir();
  if (!fs.existsSync(FILE)) {
    const seeded = SEED_LEADS.map(seedLead);
    fs.writeFileSync(FILE, JSON.stringify({ leads: seeded, seededAt: nowISO() }, null, 2));
    return { leads: seeded };
  }
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { leads: [] };
  }
}

function save(data) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// ── API pública do store ──

export function listLeads({ status, niche, q } = {}) {
  const { leads } = load();
  let out = leads;
  if (status) out = out.filter((l) => l.status === status);
  if (niche) out = out.filter((l) => l.niche === niche);
  if (q) {
    const s = q.toLowerCase();
    out = out.filter(
      (l) =>
        l.name.toLowerCase().includes(s) ||
        l.instagram.toLowerCase().includes(s) ||
        l.city.toLowerCase().includes(s) ||
        l.contactName.toLowerCase().includes(s)
    );
  }
  // mais recentes/atualizados primeiro, mas 'novo' e 'gerado' no topo pra ação
  const order = { gerado: 0, novo: 1, enviado: 2, respondeu: 3, sem_resposta: 4, descartado: 5 };
  return out.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || b.updatedAt.localeCompare(a.updatedAt));
}

export function getLead(id) {
  const { leads } = load();
  return leads.find((l) => l.id === id) || null;
}

export function addLead(input) {
  const data = load();
  const lead = seedLead({ ...input, source: input.source || "manual" });
  data.leads.push(lead);
  save(data);
  return lead;
}

export function addManyLeads(inputs = []) {
  const data = load();
  const existingKeys = new Set(
    data.leads.map((l) => (l.instagram || l.whatsapp || l.name).toLowerCase())
  );
  const added = [];
  for (const input of inputs) {
    const key = (input.instagram || input.whatsapp || input.name || "").toLowerCase();
    if (!key || existingKeys.has(key)) continue; // dedup
    const lead = seedLead({ ...input, source: input.source || "import" });
    data.leads.push(lead);
    existingKeys.add(key);
    added.push(lead);
  }
  save(data);
  return added;
}

export function updateLead(id, patch) {
  const data = load();
  const lead = data.leads.find((l) => l.id === id);
  if (!lead) return null;
  Object.assign(lead, patch, { updatedAt: nowISO() });
  save(data);
  return lead;
}

export function stats() {
  const { leads } = load();
  const by = {};
  for (const l of leads) by[l.status] = (by[l.status] || 0) + 1;
  return { total: leads.length, byStatus: by };
}
