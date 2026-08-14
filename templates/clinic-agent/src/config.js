import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function need(key) {
  const v = process.env[key];
  if (!v) {
    if (process.env.NODE_ENV === "test" || process.env.VITEST) {
      return `test_${key.toLowerCase()}`;
    }
    throw new Error(`env var missing: ${key}`);
  }
  return v;
}
function opt(key, def = "") {
  return process.env[key] ?? def;
}


export const config = {
  server: {
    port: Number(opt("PORT", 3000)),
    env: opt("NODE_ENV", "production"),
    publicUrl: need("PUBLIC_URL"),
    dataDir: path.resolve(ROOT, opt("DATA_DIR", "./data")),
  },
  clinic: {
    name: need("CLINIC_NAME"),
    type: need("CLINIC_TYPE"),
    city: opt("CLINIC_CITY"),
    phone: opt("CLINIC_PHONE"),
    whatsapp: opt("CLINIC_WHATSAPP"),
    instagram: opt("CLINIC_INSTAGRAM"),
    website: opt("CLINIC_WEBSITE"),
    address: opt("CLINIC_ADDRESS"),
    consultationPrice: opt("CONSULTATION_PRICE", "avaliação gratuita"),
  },
  router: {
    baseUrl: opt("ROUTER_BASE_URL", "https://maxrouter.up.railway.app/v1"),
    apiKey: need("ROUTER_API_KEY"),
    model: opt("ROUTER_MODEL", "gemini-2.5-flash"),
  },
  evolution: {
    url: need("EVOLUTION_URL"),
    token: need("EVOLUTION_TOKEN"),
    instance: need("EVOLUTION_INSTANCE"),
    webhookToken: opt("EVOLUTION_WEBHOOK_TOKEN"),
  },
  google: {
    clientId: need("GOOGLE_CLIENT_ID"),
    clientSecret: need("GOOGLE_CLIENT_SECRET"),
    redirectUri: need("GOOGLE_REDIRECT_URI"),
    calendarId: opt("GOOGLE_CALENDAR_ID", "primary"),
  },
  agent: {
    mode: opt("AGENT_MODE", "test"),   // test | prod
    name: opt("AGENT_NAME", "atendimento"),
    ownerName: opt("AGENT_OWNER_NAME"),
    ownerWhatsapp: opt("AGENT_OWNER_WHATSAPP"),

    // Personalidade e guardrails. Ficavam só no memoria-template.md como
    // {{VARIÁVEIS}} que ninguém preenchia — o interpolate troca variável
    // desconhecida por string vazia, então tom de voz, palavras proibidas e
    // perfil do paciente sumiam silenciosamente do system prompt. Era a causa
    // do agente soar genérico independentemente do questionário preenchido.
    toneOfVoice: opt(
      "TONE_OF_VOICE",
      "Cordial e direto. Frases curtas (2-4 linhas). Português brasileiro informal, sem gíria excessiva."
    ),
    patientProfile: opt("PATIENT_PROFILE", "Pacientes adultos buscando atendimento particular ou por convênio."),
    brandWords: opt("BRAND_WORDS", ""),
    forbiddenWords: opt(
      "FORBIDDEN_WORDS",
      "Nunca prometa resultado clínico, não dê diagnóstico, não cite preço exato sem avaliação."
    ),
    emojiPolicy: opt("EMOJI_POLICY", "No máximo 1 emoji por mensagem, e não em todas."),
  },
  security: {
    dashboardPassword: need("DASHBOARD_PASSWORD"),
    webhookSecret: opt("WEBHOOK_SECRET"),
  },
  crm: {
    provider: opt("CRM_PROVIDER", ""),
    rdstation: {
      token: opt("RDSTATION_API_TOKEN"),
      identifier: opt("RDSTATION_IDENTIFIER", "maxrouter-clinic-agent"),
    },
    hubspot: {
      token: opt("HUBSPOT_PRIVATE_APP_TOKEN"),
    },
  },
  workers: {
    enabled: opt("WORKERS_ENABLED", "true") === "true",
    reminderHoursBefore: Number(opt("REMINDER_HOURS_BEFORE", 24)),
    reengageTiers: opt("REENGAGE_TIERS", "15,30,60"),
  },
  paths: {
    root: ROOT,
    memoria: path.join(ROOT, "setup/memoria-inicial.md"),
    schema: path.join(ROOT, "src/db/schema.sql"),
    db: path.join(path.resolve(ROOT, opt("DATA_DIR", "./data")), "clinic.db"),
    web: path.join(ROOT, "web"),
  },
};
