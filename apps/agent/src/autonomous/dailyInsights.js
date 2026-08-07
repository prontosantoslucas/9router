// dailyInsights: cron leve que 1x/dia gera 1-2 mensagens espontâneas
// pra cada chat ativo. Empurra via proactiveNotifier (que drena pelo
// canal certo).
//
// Fonte de input:
//   - perfil psicológico atual (psychProfile.getCurrent)
//   - memórias recentes (memoryStore.recent + filter por chat)
//   - tarefas agendadas pendentes (scheduler.list)
//   - dia da semana + hora local (contexto humano)
//
// Output:
//   1-2 mensagens curtas (≤300 chars) em português, tag "daily-insight"
//   pro dedup impedir re-envio no mesmo dia.

const db = require("../db");
const { chatCompletion } = require("../lib/llmGatewayClient");
const proactiveNotifier = require("./proactiveNotifier");

// Cada tick verifica se está no horário-alvo e se ainda não rodou hoje.
// Tick a cada 30 min é suficiente pra pegar a janela sem drift.
const TICK_INTERVAL_MS = 30 * 60 * 1000;
const TARGET_HOUR = 8;                    // hora local Brasil (UTC-3): 8h
const TARGET_HOUR_TOLERANCE = 2;          // roda entre 8h e 10h se não tinha rodado ainda

// Cursor de "ultimo dia executado" por chatId
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_insight_cursor (
    chat_id TEXT PRIMARY KEY,
    last_run_ymd TEXT NOT NULL
  );
`);

function todayYmdBRT() {
  // UTC-3 (não considera horário de verão, mas o Brasil não usa mais)
  const d = new Date(Date.now() - 3 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function alreadyRanToday(chatId) {
  const row = db.prepare(`SELECT last_run_ymd FROM daily_insight_cursor WHERE chat_id = ?`).get(String(chatId));
  return row?.last_run_ymd === todayYmdBRT();
}

function markRan(chatId) {
  db.prepare(
    `INSERT INTO daily_insight_cursor (chat_id, last_run_ymd)
     VALUES (?, ?)
     ON CONFLICT(chat_id) DO UPDATE SET last_run_ymd = excluded.last_run_ymd`
  ).run(String(chatId), todayYmdBRT());
}

function currentHourBRT() {
  return new Date(Date.now() - 3 * 3600 * 1000).getUTCHours();
}

function collectContext(chatId) {
  // Perfil psicológico atual (se houver)
  let profile = null;
  try { profile = require("./psychProfile").getCurrent(chatId); } catch {}

  // Memórias recentes do usuário
  let memories = [];
  try {
    memories = db.prepare(
      `SELECT text FROM memories WHERE tags LIKE ? ORDER BY created_at DESC LIMIT 15`
    ).all(`%chat:${chatId}%`).map((r) => r.text);
  } catch {}

  // Tarefas agendadas pendentes desse chat
  let tasks = [];
  try {
    tasks = require("../scheduler").list()
      .filter((t) => t.meta?.chatId === chatId)
      .slice(0, 5)
      .map((t) => `${t.label} (em ~${Math.round(t.remaining / 60)} min)`);
  } catch {}

  // Feedback histórico dos últimos 30 dias — quais tipos de insight
  // funcionaram (up) vs foram rejeitados (down). Amostragem das mensagens
  // originais pra o LLM aprender o padrão.
  let feedback = { up: [], down: [] };
  try {
    const cutoff = Math.floor((Date.now() - 30 * 24 * 3600 * 1000) / 1000);
    const rows = db.prepare(
      `SELECT f.rating, f.note, pn.body
       FROM insight_feedback f
       JOIN proactive_notifications pn ON f.notification_id = pn.id
       WHERE f.chat_id = ? AND f.created_at >= ?
       ORDER BY f.created_at DESC LIMIT 20`
    ).all(String(chatId), cutoff);
    for (const r of rows) {
      const item = { body: (r.body || "").slice(0, 200), note: r.note };
      if (r.rating === "up") feedback.up.push(item);
      else feedback.down.push(item);
    }
  } catch {}

  return { profile, memories, tasks, feedback };
}

async function generateFor(chatId) {
  const { profile, memories, tasks, feedback } = collectContext(chatId);
  if (!profile && memories.length === 0) {
    return { generated: 0, reason: "sem-contexto" };
  }

  const day = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"][new Date(Date.now() - 3*3600*1000).getUTCDay()];

  // Bloco de feedback (aprendizado): usuário curtiu X, rejeitou Y — LLM
  // deve espelhar o padrão do que funcionou e evitar o que não.
  let feedbackHint = "";
  if (feedback.up.length || feedback.down.length) {
    const ups = feedback.up.slice(0, 5).map((f) => `👍 "${f.body}"${f.note ? ` (nota: ${f.note})` : ""}`).join("\n");
    const downs = feedback.down.slice(0, 5).map((f) => `👎 "${f.body}"${f.note ? ` (nota: ${f.note})` : ""}`).join("\n");
    feedbackHint = `\n\nFeedback histórico do usuário sobre insights anteriores (últimos 30d) — ESPELHE o padrão dos 👍 e evite o dos 👎:\n${ups}\n${downs}`;
  }

  const messages = [
    { role: "system", content: `Você é o agent pessoal do usuário. Gera 1 ou 2 mensagens curtas e espontâneas pra ele receber pela manhã. Formato: cada mensagem é 1-3 frases, direta, sem chavão.

Estilo — como um amigo próximo mandaria:
- Concreto, referenciando algo específico do perfil/memória
- Sem "bom dia" genérico
- Sem lista corporativa
- Cada mensagem termina com pergunta OU sugestão de ação (opcional)

Regras:
- MÁXIMO 300 caracteres por mensagem
- Se contexto é raso, gera SÓ 1 mensagem
- Nunca alucine dados. Se não sabe algo, não menciona.
- Se há feedback histórico, siga o padrão do que funcionou (👍).
- Retorne APENAS JSON: {"messages": ["msg1", "msg2"]}` },
    { role: "user", content: `Hoje é ${day}.

Perfil comportamental:
${profile?.content || "(sem perfil ainda)"}

Últimas coisas que o usuário compartilhou (autosalvo):
${memories.slice(0, 8).map((m) => `- ${m}`).join("\n") || "(nenhuma)"}

Tarefas agendadas pra hoje:
${tasks.join("\n") || "(nenhuma)"}${feedbackHint}` },
  ];

  let parsed;
  try {
    const resp = await chatCompletion({ messages, temperature: 0.7, max_tokens: 400 });
    const text = resp?.choices?.[0]?.message?.content || "";
    const clean = text.replace(/^```(json)?\s*|\s*```$/g, "").trim();
    parsed = JSON.parse(clean);
  } catch (e) {
    return { generated: 0, reason: "llm-error", error: e.message };
  }
  const list = Array.isArray(parsed?.messages) ? parsed.messages : [];
  if (list.length === 0) return { generated: 0, reason: "sem-messages" };

  let count = 0;
  for (const msg of list.slice(0, 2)) {
    if (!msg || typeof msg !== "string") continue;
    proactiveNotifier.push({
      chatId,
      body: msg.slice(0, 500),
      tag: `daily-insight-${todayYmdBRT()}`,
      priority: 4,
    });
    count++;
  }
  return { generated: count };
}

async function tick() {
  const hr = currentHourBRT();
  if (hr < TARGET_HOUR || hr >= TARGET_HOUR + TARGET_HOUR_TOLERANCE) return;

  // Chats ativos = quem tem cursor OU quem apareceu em memories/interactions
  let chats = [];
  try {
    chats = require("./psychProfile").activeChats(14);
  } catch {}
  if (chats.length === 0) return;

  for (const chatId of chats) {
    if (alreadyRanToday(chatId)) continue;
    try {
      const r = await generateFor(chatId);
      if (r.generated > 0) {
        console.log(`[dailyInsights] ${r.generated} mensagem(ns) gerada(s) pra chat=${chatId}`);
        markRan(chatId);
      }
    } catch (e) {
      console.warn(`[dailyInsights] erro em ${chatId}:`, e.message);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

let timer = null;
function start() {
  if (timer) return;
  timer = setInterval(() => {
    tick().catch((e) => console.error("[dailyInsights] tick error:", e.message));
  }, TICK_INTERVAL_MS);
  console.log(`[dailyInsights] iniciado (janela ${TARGET_HOUR}h-${TARGET_HOUR + TARGET_HOUR_TOLERANCE}h BRT)`);
}

function stop() { if (timer) { clearInterval(timer); timer = null; } }

module.exports = { generateFor, tick, start, stop };
