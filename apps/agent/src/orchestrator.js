const { complete } = require("./proxy");
const { getAgent, detectAgent, buildSystem, addAgentCorrection, addPsicanalistaInsight, scoreAgent } = require("./agents");
const { TOOL_SCHEMAS, runTool } = require("./tools");
const memory = require("./memory");
const db = require("./db");
const imagine = require("./imagine");

const MAX_TOOL_LOOPS = 6;

const histories = new Map();
const muted = new Set();

// Carregar históricos do SQLite
const rows = db.prepare("SELECT chat_id, messages FROM histories").all();
for (const row of rows) {
  try {
    const msgs = JSON.parse(row.messages);
    histories.set(row.chat_id, { msgs });
  } catch {}
}
console.log(`[History] ${histories.size} sessões carregadas do SQLite`);

function persistHistories() {
  const upsert = db.prepare(
    `INSERT INTO histories (chat_id, messages, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(chat_id) DO UPDATE SET messages = excluded.messages, updated_at = excluded.updated_at`
  );
  const txn = db.transaction((entries) => {
    for (const [chatId, data] of entries) {
      upsert.run(chatId, JSON.stringify(data.msgs));
    }
  });
  try { txn([...histories.entries()]); } catch (e) { console.error("[History] Erro ao persistir:", e.message); }
}

const TOOLS_PROMPT = `## Ferramentas disponíveis
Use tool_calls para invocar ferramentas quando necessário. O sistema executa e retorna o resultado.

## LinkedIn (job hunt + otimização de perfil)
Você tem 10 ferramentas relacionadas ao LinkedIn:

**Buscas de vaga:**
- \`linkedin_job_hunt\` — busca vagas alinhadas com o perfil do dono (GitHub prontosantoslucas), rankeia via LLM, retorna top N com links de aplicação. Cover letters opcionais pro top 5.
- Além do LinkedIn, busca em paralelo em fontes gratuitas sem login (RemoteOK, Remotive, Arbeitnow, Jobicy, WorkingNomads) — reduz chamadas ao LinkedIn (só as 2 primeiras queries vão pra lá) e cobre vaga remota que não tá no LinkedIn. Parâmetro \`sources\` filtra quais usar (default: todas).
- Filtros default do dono: **remote ou Cotia**, **salário R$ 5-10k+**, **últimos 7 dias**. Se o usuário não especificar filtro, use esses.
- Uso típico: "acha vagas AI engineer" → \`linkedin_job_hunt({location:"Remote", max_results:10})\`

**Alertas recorrentes:**
- \`schedule_job_hunt\` — cria alerta que roda automático (semanal por default). Envia só vagas NOVAS via webchat/Telegram/WhatsApp.
- \`list_scheduled_hunts\` — lista alertas ativos.
- \`cancel_scheduled_hunt\` — desabilita um alerta.
- \`run_scheduled_hunt_now\` — executa alerta agora fora do horário.
- Uso típico: "quero receber vagas AI engineer toda segunda" → \`schedule_job_hunt({label:"AI semanal", location:"Remote", interval_hours:168})\`

**Leitura de perfis (para otimização):**
- \`linkedin_person_profile\` — lê o perfil de alguém (inclusive o próprio dono, username "eusantoslucas") para análise. Use antes de sugerir headline/about/skills novos.
- \`linkedin_company_profile\`, \`linkedin_company_posts\` — pesquisa empresas antes de aplicar.

**IMPORTANTE — economia de sessão LinkedIn:**
LinkedIn detecta scraping automatizado e pode invalidar a sessão. **Não faça buscas em cascata** (>3 chamadas em <5min) — se o usuário pedir múltiplas coisas relacionadas ao LinkedIn de uma vez, execute uma por uma com espaçamento, ou consolide numa única chamada (linkedin_job_hunt já faz múltiplas queries internas). Prefira agendar (schedule_job_hunt) em vez de rodar manualmente toda hora.

**NUNCA use LinkedIn para:**
- Escrita automatizada (posts, DMs, connection requests) — LinkedIn bane conta. Se pedirem, ofereça gerar RASCUNHO em texto para copiar manualmente.
- Auto-aplicação em vagas ("Easy Apply" via bot) — mesmo motivo.

## Automações por conversa (create_automation)

Quando o usuário disser "toda vez que", "sempre que", "quando chegar", "toda segunda às", "todo dia" — VOCÊ é responsável por transformar isso numa automação persistente via \`create_automation\`.

Fluxo:
1. Confirme com o usuário: qual é o gatilho? qual é a ação? qual canal recebe?
2. Chame \`create_automation\` com trigger + action estruturados.
3. Diga o ID da automação (pra ele poder cancelar depois).

Exemplos:

- "toda vez que chegar email urgente no gmail, me manda no whatsapp"
  → trigger: \`{type:"gmail_new", config:{query:"is:unread label:urgente OR subject:urgente"}}\`
  → action: \`{type:"send_message", config:{chat_id:"<numero-do-wa>@c.us", template:"📧 {{trigger.from}}: {{trigger.subject}}\\n{{trigger.snippet}}"}}\`

- "toda segunda 9h faz resumo dos meus emails da semana"
  → trigger: \`{type:"schedule", config:{repeat_seconds:604800, first_at:"<próxima segunda 9h em ISO 8601>"}}\`
  → action: \`{type:"process_message", config:{chat_id:"<meu-chatId>", prompt_template:"me faz um resumo dos emails mais importantes desta semana"}}\`

- "todo dia às 8h me manda uma dica de produtividade"
  → trigger: \`{type:"schedule", config:{repeat_seconds:86400, first_at:"amanhã 8h ISO"}}\`
  → action: \`{type:"process_message", config:{chat_id:"<meu>", prompt_template:"me dá 1 dica curta de produtividade pra hoje, personalizada com o que sabe de mim"}}\`

Se o gatilho é vago ("me avisa quando for importante"), PERGUNTE especificamente o que é "importante" — pode ser query Gmail, palavra-chave, remetente. Nunca crie automação com trigger genérico.

Depois de criada, se ele pedir pra ver → \`list_automations\`. Cancelar → \`cancel_automation\`. Testar sem esperar → \`run_automation_now\`.`;

function getHistory(chatId) {
  if (!histories.has(chatId)) histories.set(chatId, { msgs: [] });
  return histories.get(chatId);
}

function clearHistory(chatId) {
  histories.set(chatId, { msgs: [] });
}

function isMuted(agentId) {
  return muted.has(agentId);
}

function agentSystem(agent, userName) {
  let base = buildSystem(agent.system, userName, agent.id);
  if (agent.tools.length > 0) {
    base += `\n\n${TOOLS_PROMPT}`;
  }
  return base;
}

const AGENT_IDS = "dev|pesquisador|escritor|sysadmin|psicanalista|lucas|geral";

// Mute/unmute sao COMANDOS: so valem quando a mensagem COMECA com o gatilho
// (opcionalmente apos "/"). Assim "estamos de volta" ou "ele fala muito" no meio
// de uma frase normal nao disparam mais o comando.
function parseMuteCommand(text) {
  const m = text.trim().toLowerCase().match(new RegExp(`^/?(cala a boca|cale a boca|quiet|shut up|silêncio|silence)\\b\\s*(${AGENT_IDS})?`, "i"));
  return m ? (m[2] ? m[2].toLowerCase() : "geral") : null;
}

function parseUnmuteCommand(text) {
  const m = text.trim().toLowerCase().match(new RegExp(`^/?(volta|fala|acorda|fale|aparece|unmute)\\b\\s*(${AGENT_IDS})?`, "i"));
  return m ? (m[2] ? m[2].toLowerCase() : "geral") : null;
}

function isCorrection(text) {
  return /(errado|não é|não foi|na verdade|você errou|corrigindo|discordo)/i.test(text);
}

function isRelevantFor(question, agentId) {
  if (agentId === "lucas") return true;
  return scoreAgent(question, agentId) >= 5;
}

const { BRAIN_ENTRY_BY_LABEL, BRAIN_LABELS } = require("./brainCategories");

const BRAIN_SIGNALS = /plano|meta|objetivo|ideia|sonho|virada|mudança|importante|lembrar|memóri|decidir|decidimos|vou começar|quero criar|quero construir|conversa profunda|segundo cérebro|anota|salva|agenda|compromisso|reunião|tarefa|to-?do|financ|gasto|receita|dinheiro|orçamento|comi|comida|refeição|almoço|jantar|dieta|atalho|link útil/i;

async function captureToNotion(userText, agentAnswer, channel) {
  const notion = require("./notion");
  if (!notion.isConfigured()) return;
  const combined = `${userText}\n${agentAnswer}`;
  if (combined.length < 80 || !BRAIN_SIGNALS.test(combined)) return;
  try {
    const res = await complete([
      {
        role: "system",
        content:
          `Você é o classificador do segundo cérebro de Lucas. Analise a conversa e decida se merece ser salva no Notion (plano, meta, ideia, virada de chave, memória, insight, agenda, tarefa, finanças, alimentação, atalho útil ou algo importante). Se SIM, responda APENAS JSON sem markdown: {"categoria":"<um dos rótulos exatos>","titulo":"<título curto>","resumo":"<resumo 1-3 frases>"}. Se NÃO, responda apenas: null. Rótulos: ${BRAIN_LABELS.join(", ")}`,
      },
      { role: "user", content: `Usuário: ${userText.slice(0, 1500)}\n\nLucas: ${agentAnswer.slice(0, 1500)}` },
    ]);
    const content = (res?.content || "").trim();
    if (!content || content === "null" || content.startsWith("null")) return;
    const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, ""));
    const entry = parsed?.categoria && BRAIN_ENTRY_BY_LABEL.get(parsed.categoria);
    if (!entry || !parsed?.titulo) return;
    const targetDb = entry.db();
    if (!targetDb) return; // família sem database configurado — não perde silenciosamente, só não tenta
    const nota = `${parsed.resumo || ""}\n\n---\n\nUsuário: ${userText}\nLucas: ${agentAnswer}`;
    const r = await notion.saveToCategory(entry.categoria, parsed.titulo, nota.slice(0, 2000), [], channel, targetDb);
    if (r.ok) console.log(`[Brain] Nota anexada (${entry.label}): ${r.url || parsed.titulo}`);
  } catch (err) {
    console.warn(`[Brain] Captura falhou: ${err.message}`);
  }
}

async function runAgentWithTools(agent, msgs, chatId, ctx = {}) {
  const tools = agent.tools.length > 0 ? TOOL_SCHEMAS : undefined;
  let answer = "";
  let prevToolSig = "";

  for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
    const result = await complete(msgs, { tools, tool_choice: tools ? "auto" : undefined, model: ctx.model });

    if (i > 0 && result.model) {
      console.log(`[Tools] Loop ${i}/${MAX_TOOL_LOOPS} — modelo: ${result.model}`);
    }

    msgs.push({ role: "assistant", content: result.content, tool_calls: result.tool_calls });

    if (!result.tool_calls || result.tool_calls.length === 0) {
      answer = result.content;
      break;
    }

    let repeatedTool = false;
    for (const tc of result.tool_calls) {
      if (tc.type !== "function") continue;
      let args = {};
      try { args = JSON.parse(tc.function.arguments); } catch {}
      const sig = `${tc.function.name}:${JSON.stringify(args)}`;
      if (sig === prevToolSig) { repeatedTool = true; break; }
      prevToolSig = sig;
      const toolResult = await runTool(tc.function.name, args, { chatId, ...ctx });
      msgs.push({ role: "tool", tool_call_id: tc.id, content: toolResult.slice(0, 3000) });
    }

    if (repeatedTool) {
      console.log(`[Tools] Loop detectado (mesma ferramenta chamada de novo) — parando`);
      answer = result.content || "(assunto concluído)";
      break;
    }

    answer = result.content || "(usando ferramentas...)";
  }
  return answer;
}

async function processMessage(chatId, text, userName, ctx = {}) {
  const startTime = Date.now();
  const session = getHistory(chatId);

  // Reply-to-message: injeta contexto da mensagem original no histórico
  if (ctx.replyTo) {
    const quoted = `[Respondendo a ${ctx.replyTo.from}: "${ctx.replyTo.text}"]`;
    text = `${quoted}\n${text}`;
  }

  // Comandos mute/unmute - so respondem quando o estado REALMENTE muda.
  // Se ja esta no estado pedido (ex.: liberar com todos ja liberados), nao e
  // tratado como comando: segue para o fluxo normal de conversa.
  const MUTABLE = ["dev", "pesquisador", "escritor", "sysadmin"];
  const muteTarget = parseMuteCommand(text);
  if (muteTarget) {
    if (muteTarget === "geral") {
      if (MUTABLE.some((a) => !muted.has(a))) {
        MUTABLE.forEach((a) => muted.add(a));
        return { content: "🤐 Entendido. Só o Lucas responde agora.", model: "system", agent: "lucas" };
      }
    } else if (!muted.has(muteTarget)) {
      muted.add(muteTarget);
      return { content: `🤐 ${getAgent(muteTarget).emoji} **${getAgent(muteTarget).name}** calado.`, model: "system", agent: "lucas" };
    }
  }

  const unmuteTarget = parseUnmuteCommand(text);
  if (unmuteTarget) {
    if (unmuteTarget === "geral") {
      if (muted.size > 0) {
        muted.clear();
        return { content: "🗣️ Todos podem falar!", model: "system", agent: "lucas" };
      }
    } else if (muted.has(unmuteTarget)) {
      muted.delete(unmuteTarget);
      return { content: `🗣️ ${getAgent(unmuteTarget).emoji} **${getAgent(unmuteTarget).name}** pode falar!`, model: "system", agent: "lucas" };
    }
  }

  // Comando /imagine
  const imagineMatch = text.match(/^\/imagine\s+(.+)/i);
  if (imagineMatch) {
    session.msgs.push({ role: "user", content: text });
    try {
      const result = await imagine.generate(imagineMatch[1]);
      const fullUrl = result.url;
      const content = `🎨 *Imagem gerada*\n\n_${result.revised_prompt}_`;
      session.msgs.push({ role: "assistant", content });
      persistHistories();
      return { content, model: result.model, agent: "geral", image: fullUrl };
    } catch (err) {
      const errMsg = `❌ Erro ao gerar imagem: ${err.message}`;
      session.msgs.push({ role: "assistant", content: errMsg });
      persistHistories();
      return { content: errMsg, model: "error", agent: "geral" };
    }
  }

  // Correção: salva por agente para aprendizado dirigido
  if (isCorrection(text)) {
    memory.addCorrection(text);
    const primaryId = detectAgent(text);
    addAgentCorrection(primaryId, text);
  }

  const primaryId = detectAgent(text);
  const primary = getAgent(primaryId);
  const isDirectCall = text.toLowerCase().includes(primaryId);
  const usePrimary = !isMuted(primaryId) || isDirectCall;
  const activePrimaryId = usePrimary ? primaryId : "lucas";
  const activePrimary = getAgent(activePrimaryId);

  // Check se é o primeiro turno da sessão para resgatar o handoff
  const isFirstTurn = session.msgs.length <= 1;

  session.msgs.push({ role: "user", content: text });

  // 1. Carregar Personalidade do GitHub (ou fallback local)
  const { getActivePersonality } = require("./personality/personalityPoller");
  const githubPersonality = getActivePersonality();

  // 2. Recuperar Contexto Relevante do ai-memory (inclui handoff de sessão no primeiro turno)
  const { retrieveContext } = require("./memory/contextRetriever");
  const memoryContext = await retrieveContext(text, chatId, { isFirstTurn });

  const systemPrompt = `${agentSystem(activePrimary, userName)}\n\n## Diretrizes de Personalidade:\n${githubPersonality}${memoryContext}`;

  const msgs = [
    { role: "system", content: systemPrompt },
    ...session.msgs.slice(-20),
  ];

  // VISÃO: se vieram imagens, substitui o conteúdo da última mensagem do usuário
  // por formato multimodal (texto + image_url). O histórico (session.msgs) mantém
  // só o texto — não guardamos base64 gigante nem reenviamos a imagem nos próximos turnos.
  if (Array.isArray(ctx.images) && ctx.images.length > 0) {
    const idx = msgs.length - 1;
    if (msgs[idx] && msgs[idx].role === "user") {
      msgs[idx] = {
        role: "user",
        content: [
          { type: "text", text: text || "Analise a imagem." },
          ...ctx.images
            .filter((img) => img && img.base64)
            .map((img) => ({
              type: "image_url",
              image_url: { url: `data:${img.mimeType || "image/jpeg"};base64,${img.base64}` },
            })),
        ],
      };
    }
  }

  const primaryAnswer = await runAgentWithTools(activePrimary, msgs, chatId, ctx);

  // 3. Gravação Obrigatória no ai-memory
  const { recordInteraction } = require("./memory/interactionRecorder");
  recordInteraction(chatId, text, primaryAnswer, ctx.channel || "web");

  // 3b. Segundo cérebro: captura automática de conteúdo relevante → Notion (não bloqueia resposta)
  captureToNotion(text, primaryAnswer, ctx.channel || "web").catch(() => {});

  // 4. Se o modo Co-Piloto estiver ativado para canais externos (WhatsApp/Telegram), criar rascunho
  const { addDraft } = require("./copilot/copilotQueue");
  if (ctx.copilotMode && ["whatsapp", "telegram"].includes(ctx.channel)) {
    addDraft(ctx.channel, chatId, userName, text, primaryAnswer);
    return { content: "⏳ Resposta rascunhada pelo Lucas e enviada para aprovação no Modo Co-Piloto.", model: "copilot", agent: "lucas" };
  }

  session.msgs.push({ role: "assistant", content: primaryAnswer });

  // Secundários paralelos — TODOS os agentes relevantes podem contribuir
  const secondaryComments = [];
  const AGENT_ORDER = ["dev", "sysadmin", "pesquisador", "escritor", "psicanalista"];
  const secondaryPromises = AGENT_ORDER
    .filter((id) => id !== activePrimaryId && !isMuted(id) && isRelevantFor(text, id))
    .map(async (id) => {
      const reviewPrompt = `O usuário perguntou: "${text}"

O especialista respondeu:
${primaryAnswer}

Como especialista em ${getAgent(id).name}, você pode acrescentar algo relevante do seu ponto de vista? Se sim, responda bem curto (1-2 frases). Se não: —`;

      const r = await runAgentWithTools(getAgent(id), [
        { role: "system", content: agentSystem(getAgent(id), userName) },
        { role: "user", content: reviewPrompt },
      ], chatId, ctx);

      if (r && r.trim() !== "—" && r.trim() !== "-") {
        return { content: r, agent: id };
      }
      return null;
    });

  const secondaryResults = await Promise.all(secondaryPromises);
  for (const r of secondaryResults) {
    if (r) secondaryComments.push(r);
  }

  // Psicanalista: se primário ou presente nos secundários, registra insights
  const psicoAnswer = activePrimaryId === "psicanalista"
    ? primaryAnswer
    : secondaryComments.find(s => s.agent === "psicanalista")?.content;
  if (psicoAnswer && psicoAnswer.length > 60) {
    addPsicanalistaInsight(`[${new Date().toLocaleDateString()}] ${psicoAnswer.slice(0, 300)}`);
  }

  // Se psicanalista detectou padrão e primário não é psicanalista, adiciona alerta separado
  let psicoAlert = null;
  if (activePrimaryId !== "psicanalista") {
    const psicoScore = scoreAgent(text, "psicanalista");
    const needsPsicoAnalysis = psicoScore >= 15 || /resumo|me analisa|o que acha de mim|padrão.*comportamento|minha vida/i.test(text);
    if (needsPsicoAnalysis && !secondaryComments.find(s => s.agent === "psicanalista")) {
      const alertPrompt = `O usuário disse: "${text}"

A resposta do especialista foi:
${primaryAnswer}

Como psicanalista, faça uma análise breve (2-3 frases) destacando padrões de comportamento ou reflexões relevantes. Se não houver padrão, responda apenas: —`;

      const r = await runAgentWithTools(getAgent("psicanalista"), [
        { role: "system", content: agentSystem(getAgent("psicanalista"), userName) },
        { role: "user", content: alertPrompt },
      ], chatId, ctx);

      if (r && r.trim() !== "—" && r.trim() !== "-") {
        psicoAlert = { content: r, agent: "psicanalista" };
        addPsicanalistaInsight(`[${new Date().toLocaleDateString()}] ${r.slice(0, 300)}`);
      }
    }
  }

  // Montagem da resposta
  let content = primaryAnswer;
  let formatted = `${activePrimary.emoji} *${activePrimary.name}*:\n${primaryAnswer}`;

  for (const sc of secondaryComments) {
    const sa = getAgent(sc.agent);
    content += `\n\n${sa.name}: ${sc.content}`;
    formatted += `\n\n${sa.emoji} *${sa.name}*:\n${sc.content}`;
  }

  if (psicoAlert) {
    const sa = getAgent(psicoAlert.agent);
    content += `\n\n🔔 ${sa.name}: ${psicoAlert.content}`;
    formatted += `\n\n🔔 ${sa.emoji} *${sa.name}*:\n${psicoAlert.content}`;
  }

  if (!usePrimary) {
    const note = `ℹ️ ${primary.emoji} ${primary.name} mutado, redirecionado para ${activePrimary.emoji} ${activePrimary.name}.`;
    formatted += `\n\n_${note}_`;
  }

  const latencyMs = Date.now() - startTime;
  const promptTokens = Math.max(1, Math.round((text || "").length / 4));
  const completionTokens = Math.max(1, Math.round((content || "").length / 4));
  const estimatedCost = Number(((promptTokens * 0.00000015) + (completionTokens * 0.0000006)).toFixed(6));

  persistHistories();
  return {
    content,
    formatted,
    model: "9router",
    agent: activePrimaryId,
    telemetry: {
      latencyMs,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCost
    }
  };
}


async function askAgent(agentId, prompt, userName) {
  const agent = getAgent(agentId);
  const result = await complete([
    { role: "system", content: agentSystem(agent, userName) },
    { role: "user", content: prompt },
  ]);
  return { agent: agentId, content: result.content, model: result.model };
}

function getHistorySize() {
  return histories.size;
}

function resetMuted() {
  muted.clear();
}

module.exports = { getHistory, clearHistory, processMessage, isMuted, getHistorySize, resetMuted };
