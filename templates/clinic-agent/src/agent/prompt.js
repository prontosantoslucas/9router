import fs from "node:fs";
import { config } from "../config.js";
import { getNotesFor } from "../db/db.js";

// Substitui {{VARIÁVEIS}} da memoria pelos valores reais
function interpolate(text, vars) {
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => vars[k] ?? "");
}

function loadMemoriaBase() {
  if (!fs.existsSync(config.paths.memoria)) {
    console.warn(`[Prompt] memoria-inicial.md não existe em ${config.paths.memoria} — usando fallback`);
    return `Você é o agente de atendimento da ${config.clinic.name}. Seja cordial e profissional.`;
  }
  return fs.readFileSync(config.paths.memoria, "utf8");
}

const MEMORIA_BASE = loadMemoriaBase();

/**
 * Monta o system prompt para uma conversa específica.
 * Inclui: memória base + notas do paciente (se existir).
 */
export function buildSystemPrompt(chatId) {
  const vars = {
    CLINIC_NAME: config.clinic.name,
    CLINIC_TYPE: config.clinic.type,
    CLINIC_CITY: config.clinic.city,
    CLINIC_ADDRESS: config.clinic.address,
    CLINIC_PHONE: config.clinic.phone,
    CLINIC_WHATSAPP: config.clinic.whatsapp,
    CLINIC_INSTAGRAM: config.clinic.instagram,
    CLINIC_WEBSITE: config.clinic.website,
    AGENT_NAME: config.agent.name,
    OWNER_NAME: config.agent.ownerName,
    OWNER_WHATSAPP: config.agent.ownerWhatsapp,
    NOW: new Date().toISOString(),
  };

  let system = interpolate(MEMORIA_BASE, vars);

  // Anexa notas já salvas pra esse paciente (persistência entre conversas)
  if (chatId) {
    const notes = getNotesFor(chatId);
    if (notes.length) {
      system += `\n\n## Notas anteriores deste paciente\n\n`;
      for (const n of notes) {
        system += `- [${n.category}] ${n.content}\n`;
      }
    }
  }

  return system;
}
