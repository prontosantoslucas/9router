// Agregador do painel: um único lugar que reúne hábitos, humor, metas,
// aprendizado e progresso, para o front não precisar conhecer seis módulos.
//
// ────────────────────────────────────────────────────────────────
// REGRA: campo sem dado vem como null, nunca como zero.
//
// Zero e "não medido" são coisas diferentes, e confundi-los é o jeito mais
// rápido de um painel mentir. "0 leads nesta semana" é um fato acionável;
// "não há registro de leads" é uma lacuna de instrumentação. O front precisa
// poder mostrar "—" no segundo caso, então cada seção carrega o motivo de
// estar vazia em vez de virar zero silenciosamente.
//
// Cada seção é isolada num try: se o módulo de inglês quebrar, o painel ainda
// mostra hábitos e humor, com o erro daquela seção visível.
// ────────────────────────────────────────────────────────────────

const db = require("../db");

function secao(nome, fn) {
  try {
    return { ok: true, dados: fn() };
  } catch (err) {
    console.warn(`[painel] seção ${nome} falhou: ${err.message}`);
    return { ok: false, erro: err.message, dados: null };
  }
}

function hojeBRT() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

// Mapa de humor: série contínua de dias, com lacuna explícita nos dias sem
// registro. Uma série que só traz os dias respondidos esconde justamente o
// dado mais importante — quantos dias ficaram sem resposta.
function mapaHumor(dias = 30) {
  // Carregar o modulo dono garante o schema: mentor.js cria mentor_mood no
  // require. Sem isso o painel quebra com "no such table" quando e aberto
  // antes de o mentor ter sido carregado por outro caminho.
  require("./mentor");
  const habits = require("./habits");
  const linhas = db.prepare(
    "SELECT ymd, score, nota FROM mentor_mood WHERE ymd >= ? ORDER BY ymd ASC"
  ).all(habits.diasAtras(dias - 1));
  const mapa = new Map(linhas.map((r) => [r.ymd, r]));

  const serie = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = habits.diasAtras(i);
    const r = mapa.get(d);
    serie.push({ ymd: d, score: r ? r.score : null, nota: r?.nota || null });
  }
  const comRegistro = serie.filter((s) => s.score != null);
  const media = comRegistro.length
    ? Number((comRegistro.reduce((s, x) => s + x.score, 0) / comRegistro.length).toFixed(2))
    : null;

  // Duas metades da janela: é o que permite dizer "melhorando" sem inventar.
  const meio = Math.floor(dias / 2);
  const recente = serie.slice(meio).filter((s) => s.score != null);
  const antiga = serie.slice(0, meio).filter((s) => s.score != null);
  const mediaRecente = recente.length ? recente.reduce((s, x) => s + x.score, 0) / recente.length : null;
  const mediaAntiga = antiga.length ? antiga.reduce((s, x) => s + x.score, 0) / antiga.length : null;
  let tendencia = null;
  // Exige as duas metades com dado: comparar contra nada produziria seta falsa.
  if (mediaRecente != null && mediaAntiga != null) {
    const dif = mediaRecente - mediaAntiga;
    tendencia = Math.abs(dif) < 0.25 ? "estavel" : dif > 0 ? "melhorando" : "piorando";
  }

  return {
    serie,
    media,
    tendencia,
    dias_registrados: comRegistro.length,
    dias_sem_registro: dias - comRegistro.length,
  };
}

function metas() {
  require("./mentor"); // dono de mentor_compromisso
  const abertos = db.prepare(
    "SELECT id, texto, prazo, criado_em FROM mentor_compromisso WHERE status = 'aberto' ORDER BY (prazo IS NULL), prazo ASC"
  ).all();
  const fechados7 = db.prepare(
    `SELECT id, texto, fechado_em FROM mentor_compromisso
     WHERE status = 'feito' AND fechado_em >= datetime('now','-7 days') ORDER BY fechado_em DESC`
  ).all();
  const abandonados = db.prepare("SELECT COUNT(*) n FROM mentor_compromisso WHERE status = 'abandonado'").get().n;

  const hoje = hojeBRT();
  return {
    abertos: abertos.map((c) => ({
      ...c,
      // Atrasado é fato, não julgamento: só marca quando há prazo definido.
      atrasado: !!c.prazo && c.prazo < hoje,
    })),
    fechados_7d: fechados7,
    abandonados,
  };
}

function aprendizado() {
  require("./mentor"); // dono de mentor_curriculum e mentor_log
  const en = require("./english");
  const rm = require("./roadmap");

  const ingles = en.stats();
  const rmp = rm.progresso();

  // Trilha do mentor: doutrina e Ellen White.
  const trilha = db.prepare(
    `SELECT trilha, COUNT(*) total, SUM(CASE WHEN entregue_em IS NOT NULL THEN 1 ELSE 0 END) entregues
     FROM mentor_curriculum GROUP BY trilha`
  ).all();

  const devocional7 = db.prepare(
    `SELECT COUNT(*) n FROM mentor_log WHERE tipo = 'manha' AND enviado = 1 AND ymd >= date('now','-7 days')`
  ).get().n;

  return {
    ingles: {
      vocabulario: ingles.total,
      consolidadas: ingles.consolidadas,
      para_revisar_hoje: ingles.due,
      // taxaAcerto7 é null quando não houve revisão — mantém como null.
      taxa_acerto_7d: ingles.taxaAcerto7,
      sessoes_7d: ingles.sessoes7,
      por_dominio: ingles.porDominio,
    },
    roadmap: {
      // Sem data de início não há mês: devolver 1 seria inventar progresso.
      inicio: rmp.inicio,
      mes: rmp.inicio ? rmp.mes : null,
      modulo: rmp.inicio ? rmp.modulo : null,
      fase_ingles: rmp.inicio ? rmp.faseIngles : null,
      itens: rmp.itens,
      semana: rmp.semana,
    },
    trilha_espiritual: trilha,
    devocionais_7d: devocional7,
  };
}

// Métricas de negócio: só o que já existe medido no prospector.
function negocio() {
  const q = (sql) => { try { return db.prepare(sql).get()?.n ?? null; } catch { return null; } };
  const leads7 = q("SELECT COUNT(*) n FROM prospector_leads WHERE created_at >= unixepoch('now','-7 days')");
  const leadsAnt = q(`SELECT COUNT(*) n FROM prospector_leads
      WHERE created_at >= unixepoch('now','-14 days') AND created_at < unixepoch('now','-7 days')`);
  return {
    leads_7d: leads7,
    leads_7d_anterior: leadsAnt,
    com_contato_7d: q(`SELECT COUNT(*) n FROM prospector_leads
        WHERE created_at >= unixepoch('now','-7 days')
          AND ((phone IS NOT NULL AND phone != '') OR (instagram_handle IS NOT NULL AND instagram_handle != '') OR (email IS NOT NULL AND email != ''))`),
    enviadas_7d: q("SELECT COUNT(*) n FROM prospector_outreach WHERE status = 'sent' AND sent_at >= unixepoch('now','-7 days')"),
    rascunhos: q("SELECT COUNT(*) n FROM prospector_outreach WHERE status = 'draft'"),
    respostas: q("SELECT COUNT(*) n FROM prospector_outreach WHERE response_text IS NOT NULL AND response_text != ''"),
  };
}

function tudo({ dias = 30 } = {}) {
  return {
    gerado_em: new Date().toISOString(),
    hoje: hojeBRT(),
    janela_dias: dias,
    habitos: secao("habitos", () => require("./habits").resumo({ dias })),
    humor: secao("humor", () => mapaHumor(dias)),
    metas: secao("metas", () => metas()),
    aprendizado: secao("aprendizado", () => aprendizado()),
    negocio: secao("negocio", () => negocio()),
  };
}

module.exports = { tudo, mapaHumor, metas, aprendizado, negocio };
