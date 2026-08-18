// Rastreador de hábitos.
//
// ────────────────────────────────────────────────────────────────
// DUAS DECISÕES QUE MUDAM O COMPORTAMENTO DO PAINEL
//
// 1. O dia de hoje NÃO quebra a sequência enquanto não terminar.
//    Um rastreador que zera o streak às 00h01 porque o hábito de hoje ainda
//    não foi marcado pune a pessoa por um dia que ainda está acontecendo. Aqui
//    a sequência é contada a partir do último dia FECHADO (ontem), e hoje só
//    entra quando marcado. Efeito: às 8h da manhã o painel mostra a sequência
//    real, não uma queda falsa.
//
// 2. Hábito semanal é medido por semana, não por sequência de dias.
//    "Academia 3x por semana" com streak diário estaria sempre quebrado. Para
//    esses, o que vale é quantas vezes na semana corrente contra a meta.
//
// Sem registro não há painel: toda métrica aqui sai de check-in explícito, e o
// que não foi marcado aparece como não marcado — nunca como feito por omissão.
// ────────────────────────────────────────────────────────────────

const db = require("../db");

db.exec(`
  CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    tipo TEXT NOT NULL DEFAULT 'diario',      -- diario | semanal
    meta_semanal INTEGER,                      -- só para tipo 'semanal'
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS habit_checkins (
    habit_id INTEGER NOT NULL,
    ymd TEXT NOT NULL,
    feito INTEGER NOT NULL DEFAULT 1,
    nota TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (habit_id, ymd),
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_habit_ymd ON habit_checkins(ymd);
`);

// Mesma convenção do mentor e do módulo de inglês: o dia é o de Brasília.
function hoje() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function diasAtras(n, base = null) {
  const d = base ? new Date(base + "T12:00:00Z") : new Date(hoje() + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// ────────────────────────────────────────────────────────────────
// CRUD
// ────────────────────────────────────────────────────────────────
function criar({ nome, tipo = "diario", metaSemanal = null }) {
  const n = String(nome || "").trim();
  if (!n) throw new Error("nome obrigatório");
  const t = tipo === "semanal" ? "semanal" : "diario";
  const meta = t === "semanal" ? Math.max(1, Math.min(Number(metaSemanal) || 3, 7)) : null;

  const existe = db.prepare("SELECT id, ativo FROM habits WHERE nome = ?").get(n);
  if (existe) {
    // Reativar em vez de recriar preserva o histórico de check-ins.
    if (!existe.ativo) db.prepare("UPDATE habits SET ativo = 1 WHERE id = ?").run(existe.id);
    return { id: existe.id, novo: false, reativado: !existe.ativo };
  }
  const info = db.prepare("INSERT INTO habits (nome, tipo, meta_semanal) VALUES (?, ?, ?)").run(n, t, meta);
  return { id: info.lastInsertRowid, novo: true, reativado: false };
}

function arquivar(id) {
  // Nunca apaga: o histórico é o valor do rastreador.
  return db.prepare("UPDATE habits SET ativo = 0 WHERE id = ?").run(Number(id)).changes > 0;
}

function listar({ incluirArquivados = false } = {}) {
  return db.prepare(
    `SELECT id, nome, tipo, meta_semanal, ativo FROM habits
     ${incluirArquivados ? "" : "WHERE ativo = 1"} ORDER BY ativo DESC, nome ASC`
  ).all();
}

function marcar(habitId, feito = true, { ymd = null, nota = null } = {}) {
  const dia = ymd || hoje();
  const h = db.prepare("SELECT id, nome FROM habits WHERE id = ?").get(Number(habitId));
  if (!h) return null;
  db.prepare(
    `INSERT INTO habit_checkins (habit_id, ymd, feito, nota) VALUES (?, ?, ?, ?)
     ON CONFLICT(habit_id, ymd) DO UPDATE SET feito = excluded.feito, nota = COALESCE(excluded.nota, nota)`
  ).run(h.id, dia, feito ? 1 : 0, nota);
  return { id: h.id, nome: h.nome, ymd: dia, feito: !!feito };
}

function porNome(nome) {
  const n = String(nome || "").trim().toLowerCase();
  return db.prepare("SELECT id, nome, tipo, meta_semanal FROM habits WHERE LOWER(nome) = ?").get(n)
    // Busca parcial: no chat o usuário escreve "academia", não o nome exato.
    || db.prepare("SELECT id, nome, tipo, meta_semanal FROM habits WHERE ativo = 1 AND LOWER(nome) LIKE ?").get(`%${n}%`);
}

// ────────────────────────────────────────────────────────────────
// Sequência (streak)
//
// Conta dias consecutivos feitos, terminando em hoje SE hoje foi marcado, ou
// em ontem caso contrário — hoje ainda não fechou e não deve derrubar nada.
// Um dia marcado explicitamente como NÃO feito quebra, porque aí houve resposta.
// ────────────────────────────────────────────────────────────────
function streak(habitId) {
  const feitos = new Set(
    db.prepare("SELECT ymd FROM habit_checkins WHERE habit_id = ? AND feito = 1").all(Number(habitId)).map((r) => r.ymd)
  );
  if (feitos.size === 0) return 0;

  let inicio = 0;
  if (!feitos.has(hoje())) inicio = 1; // começa de ontem: hoje está em aberto
  let n = 0;
  for (let i = inicio; i < 400; i++) {
    if (feitos.has(diasAtras(i))) n++;
    else break;
  }
  return n;
}

function melhorStreak(habitId) {
  const dias = db.prepare(
    "SELECT ymd FROM habit_checkins WHERE habit_id = ? AND feito = 1 ORDER BY ymd ASC"
  ).all(Number(habitId)).map((r) => r.ymd);
  let melhor = 0, atual = 0, anterior = null;
  for (const d of dias) {
    atual = anterior && diasAtras(-1, anterior) === d ? atual + 1 : 1;
    if (atual > melhor) melhor = atual;
    anterior = d;
  }
  return melhor;
}

// Quantas vezes na semana corrente (últimos 7 dias, incluindo hoje).
function naSemana(habitId) {
  return db.prepare(
    `SELECT COUNT(*) n FROM habit_checkins
     WHERE habit_id = ? AND feito = 1 AND ymd >= ? AND ymd <= ?`
  ).get(Number(habitId), diasAtras(6), hoje()).n;
}

// Série dos últimos N dias, para a grade do painel. Distingue os três estados
// que importam: feito, marcado como não feito, e sem resposta.
function serie(habitId, dias = 30) {
  const linhas = db.prepare(
    "SELECT ymd, feito FROM habit_checkins WHERE habit_id = ? AND ymd >= ?"
  ).all(Number(habitId), diasAtras(dias - 1));
  const mapa = new Map(linhas.map((r) => [r.ymd, r.feito]));
  const out = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = diasAtras(i);
    out.push({ ymd: d, estado: mapa.has(d) ? (mapa.get(d) ? "feito" : "falhou") : "sem_registro" });
  }
  return out;
}

// ────────────────────────────────────────────────────────────────
// Resumo para o painel e para o toque da noite
// ────────────────────────────────────────────────────────────────
function resumo({ dias = 30 } = {}) {
  const hs = listar();
  const dia = hoje();
  return hs.map((h) => {
    const hojeRow = db.prepare("SELECT feito FROM habit_checkins WHERE habit_id = ? AND ymd = ?").get(h.id, dia);
    const semana = naSemana(h.id);
    return {
      id: h.id,
      nome: h.nome,
      tipo: h.tipo,
      meta_semanal: h.meta_semanal,
      hoje: hojeRow ? (hojeRow.feito ? "feito" : "falhou") : "sem_registro",
      streak: h.tipo === "diario" ? streak(h.id) : null,
      melhor_streak: h.tipo === "diario" ? melhorStreak(h.id) : null,
      na_semana: semana,
      // Para semanal, a aderência é contra a meta; para diário, contra 7 dias.
      aderencia_pct: h.tipo === "semanal" && h.meta_semanal
        ? Math.min(100, Math.round((semana / h.meta_semanal) * 100))
        : Math.round((semana / 7) * 100),
      serie: serie(h.id, dias),
    };
  });
}

// Hábitos ativos ainda sem resposta hoje — é o que o toque da noite pergunta.
function pendentesHoje() {
  const dia = hoje();
  return db.prepare(
    `SELECT h.id, h.nome FROM habits h
     LEFT JOIN habit_checkins c ON c.habit_id = h.id AND c.ymd = ?
     WHERE h.ativo = 1 AND c.ymd IS NULL
     ORDER BY h.nome`
  ).all(dia);
}

module.exports = {
  criar, arquivar, listar, marcar, porNome,
  streak, melhorStreak, naSemana, serie, resumo, pendentesHoje,
  hoje, diasAtras,
};
