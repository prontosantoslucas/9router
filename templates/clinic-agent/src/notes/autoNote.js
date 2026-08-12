import OpenAI from "openai";
import { config } from "../config.js";
import { addNote } from "../db/db.js";

const client = new OpenAI({
  baseURL: config.router.baseUrl,
  apiKey: config.router.apiKey,
});

// Heurística barata — se a mensagem é curta ou trivial, nem chama LLM
const TRIVIAL_PATTERNS = [
  /^(oi|olá|ola|bom dia|boa tarde|boa noite|obrigad|blz|ok|kk+|hj|ta)/i,
  /^(sim|não|nao|talvez|acho|pode ser)\.?$/i,
];

const AUTO_NOTE_PROMPT = `Você é um extrator de informação sobre pacientes de clínica. Dada uma mensagem do paciente, decida se contém algo IMPORTANTE que a clínica deveria salvar sobre ele (restrição médica, preferência, indicação, dor específica, histórico relevante).

Se SIM, retorne JSON: {"save": true, "category": "clinical|preference|restriction|general", "content": "<nota curta em pt-BR, no máx 120 chars>"}.
Se NÃO for relevante (small talk, dúvida genérica, oi/tchau), retorne {"save": false}.

Seja conservador — só salve se realmente ajudaria o profissional depois. NUNCA salve informação sensível sem contexto (nome social, orientação, religião só se relevante clinicamente).`;

/**
 * Avalia uma mensagem do usuário e — se relevante — cria uma nota automática.
 * É fire-and-forget: se falhar, só loga.
 */
export async function evaluateForNote(chatId, userMessage) {
  const text = (userMessage || "").trim();
  if (!text || text.length < 25) return;
  if (TRIVIAL_PATTERNS.some((r) => r.test(text))) return;

  try {
    const completion = await client.chat.completions.create({
      model: config.router.model,
      messages: [
        { role: "system", content: AUTO_NOTE_PROMPT },
        { role: "user", content: text },
      ],
      temperature: 0.1,
      max_tokens: 120,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content?.trim();
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed?.save) return;
    if (!parsed.category || !parsed.content) return;

    addNote({
      chatId,
      category: parsed.category,
      content: parsed.content,
      source: "agent",
    });
  } catch (err) {
    console.warn("[autoNote] skip:", err.message);
  }
}
