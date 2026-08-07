// autoMemory: após cada troca (mensagem → resposta), pergunta ao LLM
// "algo aqui vale a pena lembrar como fato do usuário?" em background.
//
// Se sim, grava em memoryStore com tags — dispensa o usuário ter que dizer
// "guarda isso". Complementa (não substitui) o tool `save_memory` manual.
//
// Design:
//   - Fire-and-forget: não bloqueia resposta pro usuário
//   - Rate limit por chatId (max 1 avaliação a cada 10s) — anti-flood se
//     usuário mandar 5 msgs seguidas
//   - Filtro de heurística ANTES do LLM (não avalia msgs curtas tipo "ok",
//     "sim", "obrigado" — evita gastar token à toa)
//   - Salva NO MÁXIMO 1 memória por troca

const memoryStore = require("../memoryStore");
const { chatCompletion } = require("../lib/llmGatewayClient");

const MIN_LENGTH = 25;           // caracteres — msgs muito curtas nunca avaliam
const RATE_LIMIT_MS = 10_000;    // 1 avaliação por 10s por chatId
const MAX_TOKENS = 400;          // resposta enxuta

const lastEvalAt = new Map();    // chatId → timestamp

// Padrões de mensagens triviais que nunca vale rodar LLM em cima
const TRIVIAL_RE = /^(ok|okay|beleza|blz|show|top|obrigado|obrigada|valeu|tks|thanks|thx|sim|não|nao|entendi|👍|👌|🙏|kkk+|rs+|ah|oi|oi\?|opa|e ai|e aí|bom dia|boa tarde|boa noite|tchau|falou|até|abraço|abs)[\s!.?,]*$/i;

function evaluateSync(userMessage) {
  const trimmed = String(userMessage || "").trim();
  if (trimmed.length < MIN_LENGTH) return { skip: true, reason: "muito curta" };
  if (TRIVIAL_RE.test(trimmed)) return { skip: true, reason: "trivial" };
  return { skip: false };
}

async function evaluateAndSave(chatId, userMessage, agentReply, channel = "web") {
  // Rate limit
  const now = Date.now();
  const last = lastEvalAt.get(chatId) || 0;
  if (now - last < RATE_LIMIT_MS) return { saved: false, reason: "rate-limit" };

  // Heurística barata primeiro
  const heur = evaluateSync(userMessage);
  if (heur.skip) return { saved: false, reason: heur.reason };

  lastEvalAt.set(chatId, now);

  // Chama LLM classificador
  const messages = [
    { role: "system", content: `Você recebe uma troca (mensagem do usuário + resposta do agente). Sua tarefa é decidir se contém INFORMAÇÃO VALIOSA sobre o usuário que deveria ser lembrada em conversas futuras.

Vale salvar:
- Fatos permanentes: idade, profissão, cidade, empresa, família, hobbies
- Preferências: "gosto de X", "não como Y", "prefiro Z"
- Decisões tomadas: "vou começar a fazer X", "decidi mudar Y"
- Objetivos e metas: "quero atingir X até Y"
- Pessoas importantes: nomes de amigos, colegas, clientes mencionados
- Datas relevantes: aniversário, prazos, compromissos recorrentes
- Ferramentas/stack: "uso X pra Y", "estou aprendendo Z"
- Estado emocional relevante: "estou ansioso com X", "cansado de Y" (só se claro/repetido)

NÃO vale salvar:
- Perguntas técnicas triviais
- Conversas casuais/saudações
- Pedidos operacionais (agendar, mandar, criar automação) — o agent JÁ faz isso
- Informações que já são óbvias de contexto anterior

Responda APENAS com JSON válido, sem markdown, sem prosa:
{"save": true|false, "content": "resumo curto em 1a pessoa (ex: 'trabalho como PM na Aluminorte')", "tags": ["tag1", "tag2"]}
Se save=false, omita content e tags.` },
    { role: "user", content: `Troca:\nUsuário: ${userMessage.slice(0, 1500)}\nAgente: ${(agentReply || "").slice(0, 800)}` },
  ];

  try {
    const resp = await chatCompletion({ messages, temperature: 0.2, max_tokens: MAX_TOKENS });
    const text = resp?.choices?.[0]?.message?.content || "";
    const clean = text.replace(/^```(json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(clean);

    if (!parsed?.save) return { saved: false, reason: "llm-said-no" };
    if (!parsed.content) return { saved: false, reason: "sem-content" };

    const tags = Array.isArray(parsed.tags) ? parsed.tags : [];
    // Tag de origem sempre presente pra distinguir de save_memory manual
    tags.push(`chat:${chatId}`, "auto");
    memoryStore.save(parsed.content, tags, "auto-memory");
    console.log(`[autoMemory] salvou (chat=${chatId}): ${parsed.content.slice(0, 80)}`);
    return { saved: true, content: parsed.content, tags };
  } catch (err) {
    console.warn(`[autoMemory] falha na avaliação (chat=${chatId}): ${err.message}`);
    return { saved: false, reason: "error", error: err.message };
  }
}

// Fire-and-forget wrapper — não estoura promise rejection
function evaluateFireAndForget(chatId, userMessage, agentReply, channel) {
  Promise.resolve()
    .then(() => evaluateAndSave(chatId, userMessage, agentReply, channel))
    .catch((e) => console.warn("[autoMemory] promise error:", e.message));
}

module.exports = { evaluateAndSave, evaluateFireAndForget };
