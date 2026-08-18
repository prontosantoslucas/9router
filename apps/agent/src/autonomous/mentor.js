// Mentor: eixo espiritual + profissional, com dois toques por dia.
//
// Manhã (7h BRT): devocional da Escola Sabatina + compromissos do dia + foco.
// Noite (22h BRT): trilha de doutrina/Ellen White + revisão do dia + humor.
// Domingo à noite: balanço da semana com NÚMERO REAL, não impressão.
//
// ────────────────────────────────────────────────────────────────
// REGRA QUE NÃO SE QUEBRA: doutrina não é gerada de memória do modelo.
//
// Conteúdo devocional e doutrinário vem SEMPRE de fonte oficial da IASD,
// buscada na hora, e a URL vai junto na mensagem para poder ser conferida.
// Um LLM "lembrando" de doutrina adventista produz versículo mal citado e
// interpretação que não é da igreja — o oposto de discipulado. Quando a fonte
// não responde, o toque devocional é PULADO com aviso, nunca substituído por
// texto inventado.
//
// Fontes verificadas (2026-08-18):
//   Escola Sabatina — adventistas.org/pt/escolasabatina/category/licao-semanal/
//     lições completas, verso para memorizar, seções diárias, cita Ellen White
//   Centro de Pesquisas Ellen G. White (IASD) — centrowhite.org.br
//     biografia, cronologia, escritos, crenças fundamentais
// ────────────────────────────────────────────────────────────────

const db = require("../db");
const config = require("../config");
const keyrotator = require("../keyrotator");
const channelSender = require("../channelSender");

const LICAO_INDEX = "https://www.adventistas.org/pt/escolasabatina/category/licao-semanal/";
const CENTRO_WHITE = "https://centrowhite.org.br";

const HORA_MANHA = 7;
const HORA_NOITE = 22;
const TICK_MS = 20 * 60 * 1000; // 20 min: pega a janela sem drift

db.exec(`
  CREATE TABLE IF NOT EXISTS mentor_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Humor diário: base do "mapa de humor da semana". Sem registro não há mapa,
  -- e sem mapa qualquer leitura sobre estar melhor ou pior é chute.
  CREATE TABLE IF NOT EXISTS mentor_mood (
    ymd TEXT PRIMARY KEY,
    score INTEGER NOT NULL,        -- 1 a 5
    nota TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Trilha progressiva. Um tópico por noite, na ordem, sem repetir.
  CREATE TABLE IF NOT EXISTS mentor_curriculum (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trilha TEXT NOT NULL,          -- 'ellen_white' | 'doutrina'
    ordem INTEGER NOT NULL,
    topico TEXT NOT NULL,
    entregue_em TEXT,
    fonte_url TEXT
  );

  -- Compromissos com o próprio usuário (não os do Calendar).
  CREATE TABLE IF NOT EXISTS mentor_compromisso (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    texto TEXT NOT NULL,
    prazo TEXT,
    status TEXT NOT NULL DEFAULT 'aberto',   -- aberto | feito | abandonado
    criado_em TEXT DEFAULT (datetime('now')),
    fechado_em TEXT
  );

  CREATE TABLE IF NOT EXISTS mentor_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,            -- manha | noite | semanal
    ymd TEXT NOT NULL,
    enviado INTEGER NOT NULL DEFAULT 0,
    detalhe TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ────────────────────────────────────────────────────────────────
// Trilha inicial. Começa por quem Ellen White foi, como pedido: origem,
// o acidente, as visões, o casamento, a organização da igreja. Cada tópico
// é uma PERGUNTA de pesquisa, não uma resposta pronta — a resposta vem da
// fonte, na hora da entrega.
// ────────────────────────────────────────────────────────────────
const TRILHA_ELLEN_WHITE = [
  "Quem foi Ellen G. White: nascimento, família e infância em Gorham, Maine (1827)",
  "O acidente na infância que mudou sua vida e as sequelas que carregou",
  "O movimento milerita e a Grande Decepção de 22 de outubro de 1844",
  "A primeira visão, em dezembro de 1844, e o que ela relatou ter visto",
  "O casamento com James White e a parceria na obra",
  "Como surgiu a observância do sábado entre os pioneiros adventistas",
  "A organização formal da Igreja Adventista do Sétimo Dia em 1863",
  "A visão sobre saúde de 1863 e a origem da mensagem de reforma de saúde",
  "A fundação das instituições: escolas, editoras e sanatórios",
  "Os anos na Austrália e a expansão missionária",
  "A crise de 1888 e a mensagem da justificação pela fé",
  "O conceito de Grande Conflito e como ele organiza a teologia adventista",
  "O dom profético segundo a IASD: como a igreja entende a autoridade dos escritos dela",
  "Os últimos anos, a morte em 1915 e o legado das publicações",
];

const TRILHA_DOUTRINA = [
  "As 28 crenças fundamentais: visão geral e por que estão nessa ordem",
  "A Bíblia como única regra de fé e prática",
  "O santuário e o ministério de Cristo como sumo sacerdote",
  "O juízo investigativo e o significado de 1844 para a IASD",
  "O sábado: fundamento bíblico e sentido prático hoje",
  "O estado dos mortos e a esperança da ressurreição",
  "A segunda vinda de Cristo: o que a IASD ensina e o que não ensina",
  "Mordomia: dízimo, ofertas e o sentido de administrar o que é de Deus",
  "Saúde e temperança como parte da fé, não como regra externa",
  "O grande conflito e o papel da igreja remanescente",
];

function seedTrilha() {
  const tem = db.prepare("SELECT COUNT(*) n FROM mentor_curriculum").get().n;
  if (tem > 0) return;
  const ins = db.prepare("INSERT INTO mentor_curriculum (trilha, ordem, topico) VALUES (?, ?, ?)");
  const tx = db.transaction(() => {
    TRILHA_ELLEN_WHITE.forEach((t, i) => ins.run("ellen_white", i + 1, t));
    TRILHA_DOUTRINA.forEach((t, i) => ins.run("doutrina", i + 1, t));
  });
  tx();
  console.log(`[mentor] trilha semeada: ${TRILHA_ELLEN_WHITE.length} tópicos de Ellen White + ${TRILHA_DOUTRINA.length} de doutrina`);
}
seedTrilha();

// ────────────────────────────────────────────────────────────────
// Tempo, sempre em Brasília
// ────────────────────────────────────────────────────────────────
function agoraBRT(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "numeric", weekday: "short", hour12: false,
  }).formatToParts(date);
  const get = (t) => fmt.find((p) => p.type === t)?.value;
  return {
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
    hora: Number(get("hour")),
    diaSemana: get("weekday"),
  };
}

function jaEnviou(tipo, ymd) {
  const row = db.prepare("SELECT 1 FROM mentor_log WHERE tipo = ? AND ymd = ? AND enviado = 1").get(tipo, ymd);
  return !!row;
}

function registrar(tipo, ymd, enviado, detalhe = null) {
  db.prepare("INSERT INTO mentor_log (tipo, ymd, enviado, detalhe) VALUES (?, ?, ?, ?)")
    .run(tipo, ymd, enviado ? 1 : 0, detalhe ? String(detalhe).slice(0, 500) : null);
}

// ────────────────────────────────────────────────────────────────
// Busca em fonte oficial. Usa o /v1/web/fetch do gateway (jina-reader), o
// mesmo caminho que o prospector usa e que já sabemos funcionar.
// ────────────────────────────────────────────────────────────────
async function buscarTexto(url, maxChars = 12000) {
  const base = (config.ROUTER_BASE_URL || "").replace(/\/v1$/, "").replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/v1/web/fetch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${keyrotator.getKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "jina-reader", url, format: "markdown", max_characters: maxChars }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.content?.text || null;
  } catch (err) {
    console.warn(`[mentor] falha ao buscar ${url}: ${err.message}`);
    return null;
  }
}

// Descobre a lição mais recente no índice oficial e traz o texto dela.
async function licaoDaSemana() {
  const indice = await buscarTexto(LICAO_INDEX, 6000);
  if (!indice) return null;

  // Links de lição no padrão /pt/escolasabatina/licao-N-slug/
  const encontrados = [...indice.matchAll(/https:\/\/www\.adventistas\.org\/pt\/escolasabatina\/licao-(\d+)-[a-z0-9-]+\//gi)]
    .map((m) => ({ url: m[0], n: Number(m[1]) }));
  if (encontrados.length === 0) return null;

  // O índice vem em ordem reversa; a de maior número é a mais recente.
  const alvo = encontrados.sort((a, b) => b.n - a.n)[0];
  const texto = await buscarTexto(alvo.url, 14000);
  if (!texto) return null;

  const verso = texto.match(/VERSO PARA MEMORIZAR:?\s*([\s\S]{0,320}?)(?:\n\n|\nDomingo|$)/i);
  return {
    numero: alvo.n,
    url: alvo.url,
    verso: verso ? verso[1].replace(/\s+/g, " ").trim() : null,
    texto,
  };
}

// ────────────────────────────────────────────────────────────────
// Métricas REAIS. Toda afirmação sobre progresso sai daqui, não de impressão.
// ────────────────────────────────────────────────────────────────
function metricasSemana() {
  const q = (sql, ...p) => { try { return db.prepare(sql).get(...p); } catch { return null; } };

  const leads7 = q("SELECT COUNT(*) n FROM prospector_leads WHERE created_at >= unixepoch('now','-7 days')")?.n ?? null;
  const leadsComContato = q(`SELECT COUNT(*) n FROM prospector_leads
      WHERE created_at >= unixepoch('now','-7 days')
        AND ((phone IS NOT NULL AND phone != '') OR (instagram_handle IS NOT NULL AND instagram_handle != '') OR (email IS NOT NULL AND email != ''))`)?.n ?? null;
  const enviadas7 = q("SELECT COUNT(*) n FROM prospector_outreach WHERE status = 'sent' AND sent_at >= unixepoch('now','-7 days')")?.n ?? null;
  const respostas = q("SELECT COUNT(*) n FROM prospector_outreach WHERE response_text IS NOT NULL AND response_text != ''")?.n ?? null;
  const rascunhos = q("SELECT COUNT(*) n FROM prospector_outreach WHERE status = 'draft'")?.n ?? null;

  const humor = db.prepare(`SELECT ymd, score, nota FROM mentor_mood
      WHERE ymd >= date('now','-7 days') ORDER BY ymd ASC`).all();
  const humorMedia = humor.length ? (humor.reduce((s, h) => s + h.score, 0) / humor.length) : null;

  const abertos = db.prepare("SELECT COUNT(*) n FROM mentor_compromisso WHERE status = 'aberto'").get().n;
  const feitos7 = db.prepare(`SELECT COUNT(*) n FROM mentor_compromisso
      WHERE status = 'feito' AND fechado_em >= datetime('now','-7 days')`).get().n;

  const devocionais7 = db.prepare(`SELECT COUNT(*) n FROM mentor_log
      WHERE tipo = 'manha' AND enviado = 1 AND ymd >= date('now','-7 days')`).get().n;

  return { leads7, leadsComContato, enviadas7, respostas, rascunhos, humor, humorMedia, abertos, feitos7, devocionais7 };
}

// Compara com a semana anterior — é o que permite dizer "melhorando" ou
// "piorando" sem inventar.
function comparativoSemana() {
  const q = (sql) => { try { return db.prepare(sql).get()?.n ?? null; } catch { return null; } };
  const atual = q("SELECT COUNT(*) n FROM prospector_leads WHERE created_at >= unixepoch('now','-7 days')");
  const anterior = q(`SELECT COUNT(*) n FROM prospector_leads
      WHERE created_at >= unixepoch('now','-14 days') AND created_at < unixepoch('now','-7 days')`);
  const humorAtual = db.prepare("SELECT AVG(score) v FROM mentor_mood WHERE ymd >= date('now','-7 days')").get()?.v;
  const humorAnt = db.prepare(`SELECT AVG(score) v FROM mentor_mood
      WHERE ymd >= date('now','-14 days') AND ymd < date('now','-7 days')`).get()?.v;
  return { leads: { atual, anterior }, humor: { atual: humorAtual, anterior: humorAnt } };
}

function seta(atual, anterior) {
  if (atual == null || anterior == null) return "";
  if (anterior === 0 && atual === 0) return " (igual)";
  if (anterior === 0) return " (subiu de 0)";
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (pct === 0) return " (igual à semana passada)";
  return pct > 0 ? ` (+${pct}% vs semana passada)` : ` (${pct}% vs semana passada)`;
}

// ────────────────────────────────────────────────────────────────
// Compromissos e humor — API usada pelas tools
// ────────────────────────────────────────────────────────────────
function registrarHumor(score, nota = null, ymd = null) {
  const n = Math.max(1, Math.min(5, Number(score) || 3));
  const dia = ymd || agoraBRT().ymd;
  db.prepare(`INSERT INTO mentor_mood (ymd, score, nota) VALUES (?, ?, ?)
    ON CONFLICT(ymd) DO UPDATE SET score = excluded.score, nota = excluded.nota`).run(dia, n, nota);
  return { ymd: dia, score: n };
}

function addCompromisso(texto, prazo = null) {
  const info = db.prepare("INSERT INTO mentor_compromisso (texto, prazo) VALUES (?, ?)").run(String(texto).trim(), prazo);
  return { id: info.lastInsertRowid, texto, prazo };
}

function fecharCompromisso(id, status = "feito") {
  const r = db.prepare("UPDATE mentor_compromisso SET status = ?, fechado_em = datetime('now') WHERE id = ?").run(status, id);
  return r.changes > 0;
}

function listarCompromissos(status = "aberto") {
  return db.prepare("SELECT * FROM mentor_compromisso WHERE status = ? ORDER BY COALESCE(prazo,'9999') ASC").all(status);
}

// ────────────────────────────────────────────────────────────────
// Próximo tópico da trilha, alternando Ellen White e doutrina
// ────────────────────────────────────────────────────────────────
function proximoTopico() {
  const pendentes = db.prepare(`SELECT * FROM mentor_curriculum WHERE entregue_em IS NULL
      ORDER BY CASE trilha WHEN 'ellen_white' THEN 0 ELSE 1 END, ordem ASC`).all();
  if (pendentes.length === 0) return null;

  const entregues = db.prepare("SELECT trilha, COUNT(*) n FROM mentor_curriculum WHERE entregue_em IS NOT NULL GROUP BY trilha").all();
  const cont = Object.fromEntries(entregues.map((e) => [e.trilha, e.n]));
  // Alterna: se já entregou mais de Ellen White que de doutrina, vai de doutrina.
  const preferir = (cont.ellen_white || 0) > (cont.doutrina || 0) ? "doutrina" : "ellen_white";
  return pendentes.find((p) => p.trilha === preferir) || pendentes[0];
}

function marcarTopicoEntregue(id, fonteUrl = null) {
  db.prepare("UPDATE mentor_curriculum SET entregue_em = datetime('now'), fonte_url = ? WHERE id = ?").run(fonteUrl, id);
}

// ────────────────────────────────────────────────────────────────
// Composição dos toques
//
// Todo texto devocional/doutrinário passa por aqui ANCORADO na fonte buscada:
// o modelo recebe o trecho oficial e só pode resumir e citar o que está nele.
// É a diferença entre resumir a lição da semana e "lembrar" de doutrina — a
// segunda produz versículo torto e interpretação que não é da igreja.
// ────────────────────────────────────────────────────────────────
const proxy = require("../proxy");

async function resumirAncorado(instrucao, fonteTexto, fonteUrl) {
  const res = await proxy.complete([
    {
      role: "system",
      content:
        "Você é um mentor adventista do sétimo dia. Regra absoluta: use SOMENTE o " +
        "texto da fonte fornecida. Não acrescente doutrina, versículo ou " +
        "interpretação que não esteja nele. Se a fonte não cobrir algo, diga que " +
        "não está na fonte em vez de completar de memória.",
    },
    { role: "user", content: `${instrucao}\n\nFONTE (${fonteUrl}):\n"""\n${fonteTexto.slice(0, 9000)}\n"""` },
  ], { timeoutMs: 30000, maxRetries: 1, caveman: false }); // caveman:false — a compressão deixa o texto telegráfico
  return res.content.trim();
}

// Manhã: devocional da Escola Sabatina + compromissos abertos + foco do dia.
async function composeManha() {
  const licao = await licaoDaSemana();
  if (!licao) {
    // A regra do módulo: sem fonte, o devocional é pulado — não inventado.
    return { ok: false, motivo: "a fonte da Escola Sabatina não respondeu" };
  }

  let devocional;
  try {
    devocional = await resumirAncorado(
      "Escreva o devocional da manhã em no máximo 12 linhas: o tema da lição, o verso " +
      "para memorizar (citado exatamente como está na fonte) e uma aplicação prática " +
      "curta para hoje. Português do Brasil, tom direto, sem saudação genérica.",
      licao.texto,
      licao.url,
    );
  } catch (err) {
    return { ok: false, motivo: `falha ao compor o devocional: ${err.message}` };
  }

  const partes = [devocional, "", `Fonte: ${licao.url}`];

  const abertos = listarCompromissos("aberto");
  if (abertos.length) {
    partes.push("", "Compromissos abertos:");
    for (const c of abertos.slice(0, 5)) {
      partes.push(`- ${c.texto}${c.prazo ? ` (até ${c.prazo})` : ""}`);
    }
  }

  return { ok: true, texto: partes.join("\n"), detalhe: `licao ${licao.numero}` };
}

// Noite: um tópico da trilha, buscado na fonte oficial, + revisão do dia.
// A revisão NÃO é doutrina, então ela sai mesmo quando a fonte falha — perder
// o acompanhamento junto com o devocional seria punir duas coisas por uma.
async function composeNoite() {
  const partes = [];
  let detalhe = null;

  const topico = proximoTopico();
  if (topico) {
    const achado = await acharFonteOficial(topico.topico);
    if (achado) {
      try {
        const estudo = await resumirAncorado(
          `Ensine este tópico em no máximo 14 linhas, para alguém começando a estudar ` +
          `a fé adventista: "${topico.topico}". Fatos e datas só se estiverem na fonte.`,
          achado.texto,
          achado.url,
        );
        partes.push(estudo, "", `Fonte: ${achado.url}`);
        marcarTopicoEntregue(topico.id, achado.url);
        detalhe = `topico ${topico.id}`;
      } catch (err) {
        partes.push(`Hoje o estudo sobre "${topico.topico}" não saiu: ${err.message}.`);
      }
    } else {
      // Pular é a única opção honesta aqui: o tópico permanece na fila para a
      // próxima noite, em vez de ser entregue com conteúdo de memória.
      partes.push(`Não consegui abrir a fonte oficial para "${topico.topico}" hoje. Fica para amanhã, sem improviso.`);
    }
  }

  const m = metricasSemana();
  const c = comparativoSemana();
  const rev = ["", "Como está a semana:"];
  if (m.leads7 != null) rev.push(`- ${m.leads7} lead(s) em 7 dias${seta(c.leads.atual, c.leads.anterior)}, ${m.leadsComContato ?? 0} com contato`);
  if (m.enviadas7 != null) rev.push(`- ${m.enviadas7} mensagem(ns) enviada(s), ${m.respostas ?? 0} resposta(s), ${m.rascunhos ?? 0} rascunho(s) parado(s)`);
  rev.push(`- ${m.abertos} compromisso(s) aberto(s), ${m.feitos7} fechado(s) nesta semana`);
  if (m.humorMedia != null) rev.push(`- humor médio ${m.humorMedia.toFixed(1)}/5 em ${m.humor.length} registro(s)`);
  else rev.push("- humor: sem registro nesta semana — me diga de 1 a 5 como foi hoje");
  partes.push(...rev);

  // Domingo à noite fecha a semana: é quando o comparativo tem sentido.
  const { diaSemana } = agoraBRT();
  if (/^dom/i.test(diaSemana)) {
    partes.push("", `Balanço da semana: devocional em ${m.devocionais7} de 7 dias.`);
    if (m.rascunhos) partes.push(`Há ${m.rascunhos} rascunho(s) esperando envio — sem enviar, não há resposta.`);
  }

  return { ok: true, texto: partes.join("\n"), detalhe };
}

// Localiza a página oficial de um tópico da trilha. Restringe ao domínio do
// Centro White: o valor aqui é a fonte ser da própria IASD.
async function acharFonteOficial(topico) {
  let resultados = [];
  try {
    const webSearch = require("../tools/webSearch");
    resultados = await webSearch.searchWeb(`site:centrowhite.org.br ${topico}`, 4);
  } catch (err) {
    console.warn(`[mentor] busca falhou: ${err.message}`);
  }
  const candidatos = resultados
    .map((r) => r.url)
    .filter((u) => /(^|\.)centrowhite\.org\.br/i.test(String(u)));
  // Sem resultado da busca, a home ainda é fonte oficial e serve de porta.
  candidatos.push(CENTRO_WHITE);

  for (const url of candidatos.slice(0, 3)) {
    const texto = await buscarTexto(url, 12000);
    // Página curta é menu ou erro, não conteúdo de estudo.
    if (texto && texto.length > 600) return { url, texto };
  }
  return null;
}

// ────────────────────────────────────────────────────────────────
// Agendador. Enfileira no proactiveNotifier, que entrega por push dedicado.
// ────────────────────────────────────────────────────────────────
async function tick() {
  const { ymd, hora } = agoraBRT();
  const tipo = hora === HORA_MANHA ? "manha" : hora === HORA_NOITE ? "noite" : null;
  if (!tipo) return;
  if (jaEnviou(tipo, ymd)) return;

  const destino = channelSender.ownerChatId();
  if (!destino) {
    // Registra a tentativa para o motivo aparecer no histórico, em vez de o
    // toque simplesmente nunca acontecer sem explicação.
    registrar(tipo, ymd, false, "OWNER_CHAT_ID não configurado");
    console.warn("[mentor] sem OWNER_CHAT_ID — toque não enviado");
    return;
  }

  let r;
  try {
    r = tipo === "manha" ? await composeManha() : await composeNoite();
  } catch (err) {
    registrar(tipo, ymd, false, `erro ao compor: ${err.message}`);
    console.error(`[mentor] erro ao compor ${tipo}: ${err.message}`);
    return;
  }

  if (!r.ok) {
    registrar(tipo, ymd, false, r.motivo);
    console.warn(`[mentor] toque ${tipo} pulado: ${r.motivo}`);
    return;
  }

  const notifier = require("./proactiveNotifier");
  notifier.push({ chatId: destino, body: r.texto, tag: `mentor-${tipo}`, priority: 3 });
  registrar(tipo, ymd, true, r.detalhe);
  console.log(`[mentor] toque ${tipo} enfileirado (${ymd})`);
}

let timer = null;
function start() {
  if (timer) return;
  timer = setInterval(() => {
    tick().catch((e) => console.error("[mentor] tick error:", e.message));
  }, TICK_MS);
  tick().catch(() => {});
  console.log(`[mentor] iniciado — toques ${HORA_MANHA}h e ${HORA_NOITE}h BRT (tick ${TICK_MS / 60000}min)`);
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

module.exports = {
  // agendamento
  start, stop, tick, composeManha, composeNoite, acharFonteOficial,
  // tempo e estado
  agoraBRT, jaEnviou, registrar,
  // fontes
  buscarTexto, licaoDaSemana, LICAO_INDEX, CENTRO_WHITE,
  // métricas
  metricasSemana, comparativoSemana, seta,
  // humor e compromissos
  registrarHumor, addCompromisso, fecharCompromisso, listarCompromissos,
  // trilha
  proximoTopico, marcarTopicoEntregue, TRILHA_ELLEN_WHITE, TRILHA_DOUTRINA,
  // constantes
  HORA_MANHA, HORA_NOITE, TICK_MS,
};
