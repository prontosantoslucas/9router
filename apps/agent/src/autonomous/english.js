// Inglês: input compreensível + repetição espaçada, no domínio do usuário.
//
// ────────────────────────────────────────────────────────────────
// POR QUE NÃO É "ESTILO DUOLINGO"
//
// A pesquisa aponta duas coisas que mudam o desenho:
//
// 1. Cobertura lexical de ~98% (Hu & Nation) é o limiar para compreensão sem
//    ajuda e para aprender palavra nova incidentalmente. Texto abaixo disso
//    deixa de ser leitura e vira decifração — o esforço vai para adivinhar, não
//    para adquirir. Então o texto é calibrado: quase tudo conhecido, 1 a 2
//    palavras novas por vez.
//
// 2. Repetição espaçada e input compreensível NÃO competem: o input dá o
//    contexto, a repetição consolida. Flashcard isolado — o modelo do Duolingo
//    — perde o contexto, que é justamente o que faz a palavra colar.
//
// Daí o formato: a palavra nova nasce DENTRO de uma frase do domínio dele
// (código, venda, clínica), e volta a aparecer em contexto novo nas revisões.
// Nunca "traduza cat".
// ────────────────────────────────────────────────────────────────

const db = require("../db");
const proxy = require("../proxy");

// Intervalos em dias. Leitner com passos largos o suficiente para o
// esquecimento acontecer — é a dificuldade de recuperar que fixa. Errar volta
// para o passo 0, e não zera o histórico: `encounters` segue contando, porque
// aquisição é cumulativa mesmo quando a recuperação falha.
const PASSOS = [1, 3, 7, 16, 35, 90];

db.exec(`
  CREATE TABLE IF NOT EXISTS english_vocab (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    palavra TEXT NOT NULL UNIQUE,
    significado TEXT NOT NULL,
    contexto TEXT,                       -- a frase onde apareceu (input compreensível)
    dominio TEXT DEFAULT 'geral',        -- dev | vendas | clinica | geral
    passo INTEGER NOT NULL DEFAULT 0,
    proxima_em TEXT NOT NULL DEFAULT (date('now')),
    encounters INTEGER NOT NULL DEFAULT 1,
    acertos INTEGER NOT NULL DEFAULT 0,
    erros INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT DEFAULT (datetime('now')),
    ultima_revisao TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_english_due ON english_vocab(proxima_em);

  CREATE TABLE IF NOT EXISTS english_session (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ymd TEXT NOT NULL,
    revisadas INTEGER NOT NULL DEFAULT 0,
    acertos INTEGER NOT NULL DEFAULT 0,
    novas INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS english_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

function hoje() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

// ────────────────────────────────────────────────────────────────
// Vocabulário
// ────────────────────────────────────────────────────────────────
function addWord({ palavra, significado, contexto = null, dominio = "geral" }) {
  const p = String(palavra || "").trim().toLowerCase();
  if (!p) throw new Error("palavra obrigatória");
  const existe = db.prepare("SELECT id, encounters FROM english_vocab WHERE palavra = ?").get(p);
  if (existe) {
    // Reencontro conta: aquisição vem de encontrar a mesma palavra em
    // contextos diferentes, não de cadastrá-la duas vezes.
    db.prepare("UPDATE english_vocab SET encounters = encounters + 1, contexto = COALESCE(?, contexto) WHERE id = ?")
      .run(contexto, existe.id);
    return { id: existe.id, novo: false, encounters: existe.encounters + 1 };
  }
  const info = db.prepare(
    "INSERT INTO english_vocab (palavra, significado, contexto, dominio) VALUES (?, ?, ?, ?)"
  ).run(p, String(significado).trim(), contexto, dominio);
  return { id: info.lastInsertRowid, novo: true, encounters: 1 };
}

function dueWords(limit = 5) {
  return db.prepare(
    "SELECT * FROM english_vocab WHERE proxima_em <= date('now') ORDER BY proxima_em ASC, passo ASC LIMIT ?"
  ).all(limit);
}

// acertou=true avança um passo; false volta ao início. O intervalo é sempre
// recalculado a partir de HOJE, não da data prevista, senão atraso acumulado
// empilha revisões todas no mesmo dia.
function review(id, acertou) {
  const w = db.prepare("SELECT * FROM english_vocab WHERE id = ?").get(id);
  if (!w) return null;
  const passo = acertou ? Math.min(w.passo + 1, PASSOS.length - 1) : 0;
  const dias = PASSOS[passo];
  db.prepare(`UPDATE english_vocab SET passo = ?, proxima_em = date('now', '+' || ? || ' days'),
      encounters = encounters + 1, acertos = acertos + ?, erros = erros + ?,
      ultima_revisao = datetime('now') WHERE id = ?`)
    .run(passo, dias, acertou ? 1 : 0, acertou ? 0 : 1, id);
  return { palavra: w.palavra, passo, voltaEm: dias, acertou: !!acertou };
}

function stats() {
  const total = db.prepare("SELECT COUNT(*) n FROM english_vocab").get().n;
  const due = db.prepare("SELECT COUNT(*) n FROM english_vocab WHERE proxima_em <= date('now')").get().n;
  // "Consolidada" = passou do passo 3 (16 dias sem errar). Antes disso ainda
  // está em construção, e chamar de aprendida seria inflar o número.
  const consolidadas = db.prepare("SELECT COUNT(*) n FROM english_vocab WHERE passo >= 3").get().n;
  const porDominio = db.prepare("SELECT dominio, COUNT(*) n FROM english_vocab GROUP BY dominio").all();
  const ultimas7 = db.prepare(`SELECT COUNT(*) n FROM english_session WHERE ymd >= date('now','-7 days')`).get().n;
  const acertos7 = db.prepare(`SELECT COALESCE(SUM(acertos),0) a, COALESCE(SUM(revisadas),0) r
      FROM english_session WHERE ymd >= date('now','-7 days')`).get();
  const taxa = acertos7.r > 0 ? Math.round((acertos7.a / acertos7.r) * 100) : null;
  return { total, due, consolidadas, porDominio, sessoes7: ultimas7, taxaAcerto7: taxa };
}

function registrarSessao({ revisadas, acertos, novas }) {
  db.prepare("INSERT INTO english_session (ymd, revisadas, acertos, novas) VALUES (?, ?, ?, ?)")
    .run(hoje(), revisadas || 0, acertos || 0, novas || 0);
}

// ────────────────────────────────────────────────────────────────
// Exercício do dia
//
// Gera texto — e aqui gerar é legítimo, diferente de doutrina: o objetivo é
// input calibrado ao nível dele, e um texto sob medida atende melhor a regra
// dos 98% do que um texto aleatório da internet.
// ────────────────────────────────────────────────────────────────
async function exercicioDoDia({ dominio = null, novas = 2 } = {}) {
  const due = dueWords(4);
  const conhecidas = db.prepare(
    "SELECT palavra FROM english_vocab WHERE passo >= 2 ORDER BY RANDOM() LIMIT 25"
  ).all().map((r) => r.palavra);

  const dom = dominio || ["dev", "vendas", "clinica"][new Date().getDate() % 3];

  const prompt = [
    "Você é professor de inglês para um brasileiro que precisa LER e ENTENDER inglês técnico e comercial.",
    "",
    `Domínio de hoje: ${dom === "dev" ? "desenvolvimento de software" : dom === "vendas" ? "vendas B2B e negociação" : "clínicas e atendimento a pacientes"}.`,
    "",
    "REGRA CENTRAL — cobertura de 98%: o texto deve ser quase totalmente compreensível para ele.",
    `Use no máximo ${novas} palavra(s) nova(s). Todo o resto precisa ser vocabulário comum ou palavra que ele já conhece.`,
    conhecidas.length ? `Palavras que ele já domina (pode usar à vontade): ${conhecidas.join(", ")}` : "",
    due.length ? `RECICLE estas palavras que ele está revisando, em contexto NOVO: ${due.map((d) => d.palavra).join(", ")}` : "",
    "",
    "Monte o exercício EXATAMENTE neste formato, em português para as instruções e inglês para o conteúdo:",
    "",
    "TEXTO",
    "<3 a 4 frases em inglês, sobre uma situação real do domínio de hoje>",
    "",
    "PALAVRAS NOVAS",
    "<para cada palavra nova: a palavra — significado em português — a frase do texto onde ela aparece>",
    "",
    "ENTENDIMENTO",
    "<1 pergunta em inglês sobre o texto, que exija entender e não só localizar palavra>",
    "",
    "SUA VEZ",
    "<peça 1 frase escrita por ele em inglês, aplicando uma das palavras novas numa situação do trabalho dele>",
    "",
    "Não traduza o texto inteiro: traduzir mata o esforço de compreensão, que é o que ensina.",
    "Não use palavra rara nem jargão acadêmico.",
  ].filter(Boolean).join("\n");

  try {
    const res = await proxy.complete([
      { role: "system", content: "Você é professor de inglês especializado em leitura para adultos, guiado por input compreensível (cobertura lexical de 98%) e repetição espaçada em contexto." },
      { role: "user", content: prompt },
    ], { timeoutMs: 20000, maxRetries: 1, caveman: false });

    return { ok: true, dominio: dom, due, texto: res.content.trim() };
  } catch (err) {
    // Sem LLM não há exercício novo — mas a revisão do que está vencido não
    // depende de geração nenhuma, então ela continua valendo.
    return { ok: false, error: err.message, dominio: dom, due, texto: null };
  }
}

// Correção por reformulação (recast): devolve a frase natural em vez de marcar
// erro. Corrigir com caneta vermelha inibe produção; reformular ensina sem
// travar quem está escrevendo.
async function corrigir(fraseDoUsuario) {
  const prompt = [
    "O aluno brasileiro escreveu esta frase em inglês:",
    `"${String(fraseDoUsuario).trim()}"`,
    "",
    "Responda em no máximo 4 linhas, nesta ordem:",
    "1. A frase reescrita como um nativo diria (só a frase, sem rótulo de erro).",
    "2. O que mudou e por quê, em uma linha, em português.",
    "3. Se a frase já estava natural, diga isso e proponha uma variação mais idiomática.",
    "",
    "Não liste erros nem use termos como 'incorreto'. Reformule.",
  ].join("\n");

  try {
    const res = await proxy.complete([
      { role: "system", content: "Você corrige inglês por reformulação (recast), não por marcação de erro." },
      { role: "user", content: prompt },
    ], { timeoutMs: 15000, maxRetries: 1, caveman: false });
    return { ok: true, resposta: res.content.trim() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { addWord, dueWords, review, stats, registrarSessao, exercicioDoDia, corrigir, PASSOS, hoje };
