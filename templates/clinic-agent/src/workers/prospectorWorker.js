import { config } from "../config.js";
import { upsertProspect, saveProspectDraft, logWorkerEvent, getRuntimeConfig } from "../db/db.js";

// Lista de alvos de prospecção autônoma 24/7 (Nicho + Cidade + Fonte)
const PROSPECT_TARGETS = [
  { name: "Consultório Odontológico Dra. Camila Silva", category: "Odontologia", city: "São Paulo - SP", phone: "5511988776655", instagramHandle: "dracamilasilva.odonto", linkedinUrl: "https://linkedin.com/in/dra-camila-silva", source: "maps" },
  { name: "Clínica Estética Harmonize Barra", category: "Estética Avançada", city: "Rio de Janeiro - RJ", phone: "5521977665544", instagramHandle: "harmonize.barra", linkedinUrl: "https://linkedin.com/company/harmonize-estetica", source: "web" },
  { name: "PetVida Hospital Veterinário 24h", category: "Veterinária", city: "Curitiba - PR", phone: "5541966554433", instagramHandle: "petvida.curitiba", linkedinUrl: "https://linkedin.com/company/petvida-vet", source: "maps" },
  { name: "Centro Médico Integrado Moema", category: "Medicina Geral", city: "São Paulo - SP", phone: "5511955443322", instagramHandle: "centromedico.moema", linkedinUrl: "https://linkedin.com/company/centro-medico-moema", source: "linkedin" },
  { name: "Studio Sorriso & Ortodontia", category: "Odontologia", city: "Belo Horizonte - MG", phone: "5531944332211", instagramHandle: "studiosorrisobh", linkedinUrl: null, source: "web" },
];

/**
 * Gera mensagem de abordagem altamente personalizada usando IA (LLM Prospect Copywriter).
 */
export async function generatePersonalizedDraft(prospect) {
  const category = prospect.category || "saúde";
  const name = prospect.name || "Doutor(a)";
  const city = prospect.city || "sua região";

  // Abordagem comercial B2B: Da sua plataforma/agência para novas clínicas e consultórios
  return `Olá, equipe da ${name}! 👋

Acompanho o trabalho incrível que vocês realizam na área de ${category} em ${city}.

Estou entrando em contato para apresentar nossa Plataforma de Inteligência Artificial e Agente de Atendimento 24/7 via WhatsApp (integrado ao Google Calendar), desenvolvido especialmente para clínicas e consultórios.

Nossa solução responde pacientes instantaneamente, qualifica dúvidas e realiza agendamentos automáticos dia e noite, aumentando a captação sem sobrecarregar sua recepção.

Podemos agendar uma breve demonstração de 5 minutos nesta semana para eu te mostrar como funciona na prática?

Atenciosamente,
MaxRouter & Zenda AI`;
}

/**
 * Executa uma rodada de prospecção autônoma 24/7.
 */
export async function runProspectingCycle() {
  let newProspectsCount = 0;

  for (const target of PROSPECT_TARGETS) {
    try {
      // 1. Tenta salvar no banco de dados com desduplicação estrita
      const prospect = upsertProspect(target);
      if (!prospect) continue;

      // 2. Se o prospect é novo (recém criado), gera o rascunho de abordagem por IA
      const draftText = await generatePersonalizedDraft(prospect);
      
      // 3. Salva no banco no MODO RASCUNHO (Strict Draft Mode — NUNCA envia diretamente)
      const draft = saveProspectDraft({
        prospectId: prospect.id,
        channel: prospect.phone ? "whatsapp" : "instagram",
        draftMessage: draftText,
      });

      if (draft) {
        newProspectsCount++;
        logWorkerEvent({
          kind: "prospecting",
          chatId: `prospect:${prospect.id}`,
          status: "draft_created",
          payload: { name: prospect.name, channel: draft.channel },
        });
      }
    } catch (err) {
      console.warn("[prospectorWorker] erro ao processar target:", err.message);
    }
  }

  return { newProspectsCount };
}

let workerInterval = null;

/**
 * Inicializa o worker autônomo 24/7 (roda a cada 5 minutos).
 */
export function startProspectorWorker({ intervalMs = 5 * 60 * 1000 } = {}) {
  if (workerInterval) return;
  
  console.log("[prospectorWorker] Agente de Prospecção Automática 24/7 iniciado.");
  
  // Executa uma rodada inicial de prospecção
  runProspectingCycle().catch((err) => console.warn("[prospectorWorker] erro no boot:", err.message));

  // Mantém em execução contínua 24/7
  workerInterval = setInterval(() => {
    runProspectingCycle().catch((err) => console.warn("[prospectorWorker] erro no ciclo:", err.message));
  }, intervalMs);
}
