// psychProfile: gera semanalmente um resumo comportamental do usuário
// a partir das interações + memórias autosalvas dos últimos 7 dias.
//
// Não é diagnóstico — é síntese de padrões que ajuda o próprio agent a
// "conhecer" o usuário melhor em turnos futuros. Injetado no system prompt
// (getCurrent).
//
// Ciclo: cron a cada N horas → coleta → LLM synthesize → salva versionado.

const db = require("../db");
const memoryStore = require("../memoryStore");
const { chatCompletion } = require("../lib/llmGatewayClient");

// Refresh do perfil 1x/dia — chega até ~7d de janela sem sobrecarregar
const REFRESH_INTERVAL_MS = 24 * 3600 * 1000;
const WINDOW_DAYS = 7;
const MIN_INTERACTIONS = 5; // se muito pouca conversa, nem gera

db.exec(`
  CREATE TABLE IF NOT EXISTS psych_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    content TEXT NOT NULL,
    window_days INTEGER NOT NULL,
    interactions_used INTEGER NOT NULL,
    memories_used INTEGER NOT NULL,
    generated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS psych_by_chat ON psych_profile (chat_id, generated_at DESC);
`);

// Pega ÚLTIMA versão do perfil de um chatId (usada pra injetar no system prompt)
function getCurrent(chatId) {
  return db.prepare(
    `SELECT content, generated_at FROM psych_profile
     WHERE chat_id = ? ORDER BY generated_at DESC LIMIT 1`
  ).get(String(chatId));
}

// Coleta bruta pra síntese
function collectRecent(chatId, days = WINDOW_DAYS) {
  const cutoff = Math.floor((Date.now() - days * 24 * 3600 * 1000) / 1000);

  // Interações — se a tabela existe. Fallback: sem histórico.
  let interactions = [];
  try {
    interactions = db.prepare(
      `SELECT user_message, agent_reply, created_at FROM interactions
       WHERE chat_id = ? AND created_at >= ?
       ORDER BY created_at DESC LIMIT 100`
    ).all(String(chatId), cutoff);
  } catch { /* tabela pode não existir */ }

  // autoMemory salva com tag "chat:<chatId>"
  let memories = [];
  try {
    memories = db.prepare(
      `SELECT text, tags, created_at FROM memories
       WHERE tags LIKE ? AND created_at >= datetime(?, 'unixepoch')
       ORDER BY created_at DESC LIMIT 50`
    ).all(`%chat:${chatId}%`, cutoff);
  } catch { /* schema pode ser outro */ }

  return { interactions, memories };
}

async function synthesize(chatId, force = false) {
  const { interactions, memories } = collectRecent(chatId);
  if (!force && interactions.length + memories.length < MIN_INTERACTIONS) {
    return { generated: false, reason: "poucas-interações", count: interactions.length + memories.length };
  }

  // Recorta amostra pra caber no context: última semana de trocas + todas memórias
  const sampleInter = interactions.slice(0, 30).map((r) =>
    `[${r.created_at}] usuario: ${(r.user_message || "").slice(0, 300)}\n         agent: ${(r.agent_reply || "").slice(0, 200)}`
  ).join("\n\n");
  const sampleMem = memories.slice(0, 30).map((r) => `- ${r.text}`).join("\n");

  const messages = [
    { role: "system", content: `Você recebe o histórico recente (7 dias) de conversas + memórias autosalvas de UM usuário. Produza um resumo comportamental em 5 seções curtas, em português brasileiro, MÁXIMO 200 palavras total.

Estrutura:
1. **Temas recorrentes** — sobre o que o usuário fala mais (2-4 tópicos)
2. **Prioridades atuais** — o que parece estar buscando/resolvendo agora
3. **Estado emocional** — humor predominante (positivo/estressado/focado/etc). Se pouca info, escreve "insuficiente"
4. **Padrões de decisão** — como ele decide (analítico/intuitivo/pede confirmação/executivo)
5. **Sugestões pro agent** — 1-2 bullets do tipo "quando ele X, considere Y" (usado pelo próprio agent como guia)

Regras:
- Fatos, não conjecturas. Se não tem base, diz "insuficiente" na seção.
- Nunca diagnóstico psicológico. É observação de padrão de conversa.
- 1a pessoa impessoal ("o usuário").` },
    { role: "user", content: `Interações (${interactions.length}):\n${sampleInter || "(vazio)"}\n\nMemórias autosalvas (${memories.length}):\n${sampleMem || "(vazio)"}` },
  ];

  let content;
  try {
    const resp = await chatCompletion({ messages, temperature: 0.4, max_tokens: 800 });
    content = resp?.choices?.[0]?.message?.content?.trim();
  } catch (e) {
    return { generated: false, reason: "llm-error", error: e.message };
  }
  if (!content) return { generated: false, reason: "sem-content" };

  db.prepare(
    `INSERT INTO psych_profile (chat_id, content, window_days, interactions_used, memories_used)
     VALUES (?, ?, ?, ?, ?)`
  ).run(String(chatId), content, WINDOW_DAYS, interactions.length, memories.length);

  console.log(`[psychProfile] gerado pra chat=${chatId} (${interactions.length} int + ${memories.length} mem)`);
  return { generated: true, content, interactions: interactions.length, memories: memories.length };
}

// Lista chatIds ativos (que trocaram mensagens na janela)
function activeChats(days = WINDOW_DAYS) {
  const cutoff = Math.floor((Date.now() - days * 24 * 3600 * 1000) / 1000);
  try {
    return db.prepare(
      `SELECT DISTINCT chat_id FROM interactions WHERE created_at >= ?`
    ).all(cutoff).map((r) => r.chat_id);
  } catch {
    // Sem tabela interactions: usa autoMemory tags como fonte
    const rows = db.prepare(`SELECT DISTINCT tags FROM memories WHERE created_at >= datetime(?, 'unixepoch')`).all(cutoff);
    const set = new Set();
    for (const r of rows) {
      try {
        JSON.parse(r.tags || "[]").forEach((t) => {
          if (t.startsWith("chat:")) set.add(t.slice(5));
        });
      } catch {}
    }
    return [...set];
  }
}

async function refreshAll() {
  const chats = activeChats();
  console.log(`[psychProfile] refresh pra ${chats.length} chats ativos`);
  for (const chatId of chats) {
    try { await synthesize(chatId); }
    catch (e) { console.warn(`[psychProfile] erro em ${chatId}:`, e.message); }
    await new Promise((r) => setTimeout(r, 3000)); // pausa entre chats
  }
}

let timer = null;
function start() {
  if (timer) return;
  timer = setInterval(() => {
    refreshAll().catch((e) => console.error("[psychProfile] refreshAll error:", e.message));
  }, REFRESH_INTERVAL_MS);
  console.log(`[psychProfile] iniciado (refresh a cada ${REFRESH_INTERVAL_MS / 3600000}h)`);
}

function stop() { if (timer) { clearInterval(timer); timer = null; } }

module.exports = { getCurrent, synthesize, refreshAll, activeChats, start, stop };
