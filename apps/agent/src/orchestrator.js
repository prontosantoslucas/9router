const { complete } = require("./proxy");
const { getAgent, getSecondary, detectAgent } = require("./agents");
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
Use tool_calls para invocar ferramentas quando necessário. O sistema executa e retorna o resultado.`;

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
  let base = agent.system(userName);
  const corrections = memory.getRecentCorrections(5);
  if (corrections.length > 0) {
    base += `\n\n## Correções anteriores\n${corrections.map((c) => `- ${c}`).join("\n")}`;
  }
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
  const lower = question.toLowerCase();
  const patterns = {
    dev: /(code|código|codigo|programa|função|funcao|script|bug|debug|compilar|npm|git|api|router|app|classe|html|css|js|python|sql|banco|endpoint)/i,
    pesquisador: /(pesquisa|busca|google|notícia|noticia|quem é|o que é|como funciona|por que|quando|onde|história|historia|fato|dado|estatística)/i,
    escritor: /(documenta|escreve|artigo|traduz|readme|tutorial|texto|email|redação|redacao|ortografia|gramática)/i,
    sysadmin: /(deploy|servidor|docker|railway|infra|instalar|config|serviço|nginx|cloud|devops|container)/i,
    lucas: /(você|como está|quem é|sobre|conversa|tudo bem|oi|olá)/i,
  };
  return patterns[agentId]?.test(lower) ?? true;
}

async function runAgentWithTools(agent, msgs, chatId, ctx = {}) {
  const tools = agent.tools.length > 0 ? TOOL_SCHEMAS : undefined;
  let answer = "";
  let prevToolSig = "";

  for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
    const result = await complete(msgs, { tools, tool_choice: tools ? "auto" : undefined });

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
  const session = getHistory(chatId);

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

  if (isCorrection(text)) {
    memory.addCorrection(text);
  }

  const primaryId = detectAgent(text);
  const primary = getAgent(primaryId);
  const isDirectCall = text.toLowerCase().includes(primaryId);
  const usePrimary = !isMuted(primaryId) || isDirectCall;
  const activePrimaryId = usePrimary ? primaryId : "lucas";
  const activePrimary = getAgent(activePrimaryId);

  session.msgs.push({ role: "user", content: text });

  // 1. Carregar Personalidade do GitHub (ou fallback local)
  const { getActivePersonality } = require("./personality/personalityPoller");
  const githubPersonality = getActivePersonality();

  // 2. Recuperar Contexto Relevante do ai-memory (obrigatório)
  const { retrieveContext } = require("./memory/contextRetriever");
  const memoryContext = await retrieveContext(text, chatId);

  const systemPrompt = `${agentSystem(activePrimary, userName)}\n\n## Diretrizes de Personalidade:\n${githubPersonality}${memoryContext}`;

  const msgs = [
    { role: "system", content: systemPrompt },
    ...session.msgs.slice(-20),
  ];

  const primaryAnswer = await runAgentWithTools(activePrimary, msgs, chatId, ctx);

  // 3. Gravação Obrigatória no ai-memory
  const { recordInteraction } = require("./memory/interactionRecorder");
  recordInteraction(chatId, text, primaryAnswer, ctx.channel || "web");

  // 4. Se o modo Co-Piloto estiver ativado para canais externos (WhatsApp/Telegram), criar rascunho
  const { addDraft } = require("./copilot/copilotQueue");
  if (ctx.copilotMode && ["whatsapp", "telegram"].includes(ctx.channel)) {
    addDraft(ctx.channel, chatId, userName, text, primaryAnswer);
    return { content: "⏳ Resposta rascunhada pelo Lucas e enviada para aprovação no Modo Co-Piloto.", model: "copilot", agent: "lucas" };
  }

  session.msgs.push({ role: "assistant", content: primaryAnswer });

  // Secundário paralelo
  let secondaryComment = null;
  const secondaryId = getSecondary(activePrimaryId);
  if (usePrimary && secondaryId !== activePrimaryId && !isMuted(secondaryId) && isRelevantFor(text, secondaryId)) {
    const reviewPrompt = `O usuário perguntou: "${text}"

O especialista respondeu:
${primaryAnswer}

Como outro especialista, tem algo útil a acrescentar? Se for relevante, responda bem curto. Se não: —`;

    const p = runAgentWithTools(getAgent(secondaryId), [
      { role: "system", content: agentSystem(getAgent(secondaryId), userName) },
      { role: "user", content: reviewPrompt },
    ], chatId, ctx);

    const [r] = await Promise.all([p]);
    if (r && r.trim() !== "—" && r.trim() !== "-") {
      secondaryComment = { content: r, agent: secondaryId };
    }
  }

    let content = primaryAnswer;
  let formatted = `${activePrimary.emoji} *${activePrimary.name}*:\n${primaryAnswer}`;
  if (secondaryComment) {
    const sa = getAgent(secondaryComment.agent);
    content += `\n\n${sa.name}: ${secondaryComment.content}`;
    formatted += `\n\n${sa.emoji} *${sa.name}*:\n${secondaryComment.content}`;
  }
  if (!usePrimary) {
    const note = `ℹ️ ${primary.emoji} ${primary.name} mutado, redirecionado para ${activePrimary.emoji} ${activePrimary.name}.`;
    formatted += `\n\n_${note}_`;
  }

  persistHistories();
  return { content, formatted, model: "9router", agent: activePrimaryId };
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
