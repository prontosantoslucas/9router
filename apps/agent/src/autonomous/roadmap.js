// Roadmap de estudos: do zero à carreira em IA, 12 meses, 2h/dia.
//
// Conteúdo definido pelo próprio usuário. Este módulo NÃO inventa trilha nem
// troca recurso: ele guarda o plano dele, acompanha progresso e cobra o que
// ficou em aberto. Se um recurso mudar, ele edita — não o agente.
//
// A divisão diária que ele definiu: 1h30 técnico + 30min inglês. O módulo de
// inglês (english.js) é a trilha paralela, e por isso o exercício diário é
// calibrado no domínio de estudo dele (dev/dados/ML), não em tema aleatório.

const db = require("../db");

db.exec(`
  CREATE TABLE IF NOT EXISTS roadmap_modulo (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    mes_inicio INTEGER NOT NULL,
    mes_fim INTEGER NOT NULL,
    criterio TEXT NOT NULL,
    ordem INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS roadmap_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    modulo_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,              -- recurso | projeto
    titulo TEXT NOT NULL,
    url TEXT,
    concluido_em TEXT,
    nota TEXT,
    FOREIGN KEY (modulo_id) REFERENCES roadmap_modulo(id)
  );

  -- Registro de progresso mensal, como na tabela que ele desenhou.
  CREATE TABLE IF NOT EXISTS roadmap_mes (
    mes INTEGER PRIMARY KEY,
    concluido INTEGER NOT NULL DEFAULT 0,
    observacoes TEXT,
    atualizado_em TEXT
  );

  -- Horas registradas por dia, separando técnico de inglês: é o único jeito de
  -- saber se as 2h/dia estão acontecendo de fato ou só no plano.
  CREATE TABLE IF NOT EXISTS roadmap_horas (
    ymd TEXT PRIMARY KEY,
    min_tecnico INTEGER NOT NULL DEFAULT 0,
    min_ingles INTEGER NOT NULL DEFAULT 0,
    nota TEXT
  );

  CREATE TABLE IF NOT EXISTS roadmap_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const MODULOS = [
  {
    id: 1, nome: "Python e lógica", mes_inicio: 1, mes_fim: 2, ordem: 1,
    criterio: "Consigo escrever um script de 50 linhas sem copiar de tutorial.",
    recursos: [
      ["Curso em Vídeo — Python do zero, em português", "https://www.cursoemvideo.com"],
      ["CS50P – Harvard (conteúdo e certificado grátis pelo site da Harvard)", "https://cs50.harvard.edu/python"],
      ["Google Colab — ambiente de código sem instalar nada", "https://colab.research.google.com"],
      ["Anthropic Academy — AI Fluency (3h, certificado grátis)", "https://anthropic.skilljar.com"],
    ],
    projetos: [
      ["Script que lê planilha bagunçada, limpa os dados e gera relatório (sem interface, só funcionando)", null],
    ],
  },
  {
    id: 2, nome: "Dados e SQL", mes_inicio: 3, mes_fim: 4, ordem: 2,
    criterio: "Pego uma base que nunca vi e respondo perguntas sobre ela sozinho.",
    recursos: [
      ["Kaggle Learn — Python, Pandas, Data Visualization, Intro to SQL", "https://www.kaggle.com/learn"],
      ["SQLBolt — SQL interativo e rápido", "https://sqlbolt.com"],
      ["freeCodeCamp — Data Analysis with Python (certificado grátis)", "https://www.freecodecamp.org"],
    ],
    projetos: [
      ["Análise exploratória de base pública: 5 perguntas de negócio, 5 gráficos, 1 conclusão escrita, publicada no GitHub com README", "https://dados.gov.br"],
    ],
  },
  {
    id: 3, nome: "Machine Learning", mes_inicio: 5, mes_fim: 7, ordem: 3,
    criterio: "Sei explicar por que meu modelo errou, não só qual foi a acurácia.",
    recursos: [
      ["Google ML Crash Course", "https://developers.google.com/machine-learning/crash-course"],
      ["fast.ai — gratuito de verdade, incluindo o livro", "https://course.fast.ai"],
      ["Kaggle Learn — Intro to ML e Intermediate ML", "https://www.kaggle.com/learn"],
      ["Kaggle Competitions — categoria Getting Started", "https://www.kaggle.com/competitions"],
    ],
    projetos: [
      ["Modelo de previsão de ponta a ponta, dos dados crus à avaliação, explicando a escolha de cada modelo", null],
      ["Uma competição do Kaggle, documentando o que tentei e o que falhou", null],
    ],
  },
  {
    id: 4, nome: "IA generativa", mes_inicio: 8, mes_fim: 10, ordem: 4,
    criterio: "Tenho duas aplicações rodando que outra pessoa consegue usar.",
    recursos: [
      ["Hugging Face Learn — LLM Course e Agents Course", "https://huggingface.co/learn"],
      ["DeepLearning.AI — short courses gratuitos", "https://www.deeplearning.ai/short-courses"],
      ["Anthropic Academy — trilha de API e Claude Code", "https://anthropic.skilljar.com"],
      ["Microsoft Learn — AI-900", "https://learn.microsoft.com/training"],
      ["IBM SkillsBuild — certificados grátis", "https://skillsbuild.org"],
    ],
    projetos: [
      ["Chatbot com RAG que responde sobre documentos que eu subi", null],
      ["Um agente que automatiza uma tarefa chata real da minha rotina", null],
    ],
  },
  {
    id: 5, nome: "Publicar e se posicionar", mes_inicio: 11, mes_fim: 12, ordem: 5,
    criterio: "Um sistema publicado, com link funcionando, que alguém use sem eu explicar. README em inglês. LinkedIn atualizado.",
    recursos: [
      ["Hugging Face Spaces — hospedagem grátis", "https://huggingface.co/spaces"],
      ["Streamlit Community Cloud — plano grátis", "https://streamlit.io"],
      ["GitHub — portfólio organizado", "https://github.com"],
      ["diagrams.net — diagramas de arquitetura para os READMEs", "https://app.diagrams.net"],
    ],
    projetos: [
      ["Sistema publicado com link funcionando, README em inglês, LinkedIn atualizado com os projetos", null],
    ],
  },
];

// Trilha paralela de inglês, com o cronograma por período que ele definiu.
const INGLES_FASES = [
  { meses: "1–3", foco: "Base + Duolingo diário. Meta: entender frases simples" },
  { meses: "4–6", foco: "Leitura. Ler documentação do Pandas/Python em inglês, com tradutor ao lado" },
  { meses: "7–9", foco: "Trocar legenda PT por EN nos cursos. Conversação 2x/semana" },
  { meses: "10–12", foco: "READMEs em inglês. Falar sobre os projetos em voz alta" },
];

const INGLES_RECURSOS = [
  ["British Council — A1 ao C1", "https://learnenglish.britishcouncil.org"],
  ["BBC Learning English — vídeos curtos diários", "https://www.bbc.co.uk/learningenglish"],
  ["Duolingo — plano grátis, para criar o hábito", "https://www.duolingo.com"],
  ["Fundação Bradesco — inglês instrumental com certificado", "https://www.ev.org.br"],
  ["HelloTalk — troca com nativos", "https://www.hellotalk.com"],
  ["Tandem — troca com nativos", "https://www.tandem.net"],
];

// As três verdades que ele escreveu para não se frustrar. Ficam aqui para o
// mentor poder lembrá-lo delas quando o número estiver ruim — é o antídoto
// dele contra desânimo, escrito por ele mesmo.
const VERDADES = [
  "Certificado gratuito vale pouco sozinho. O que abre porta é portfólio pequeno e bem explicado. Priorizar construir sobre colecionar.",
  "Minha vantagem é a área de onde eu venho. Quem entende do domínio E sabe IA vale mais que outro generalista. Direcionar os projetos para problemas dessa área.",
  "O ganho vem antes do fim. A partir do mês 4, ler em inglês já acelera o próprio estudo. A partir do mês 8, com 2 projetos publicados, já dá para tentar vagas.",
];

function seed() {
  const tem = db.prepare("SELECT COUNT(*) n FROM roadmap_modulo").get().n;
  if (tem > 0) return false;
  const insM = db.prepare("INSERT INTO roadmap_modulo (id, nome, mes_inicio, mes_fim, criterio, ordem) VALUES (?,?,?,?,?,?)");
  const insI = db.prepare("INSERT INTO roadmap_item (modulo_id, tipo, titulo, url) VALUES (?,?,?,?)");
  const insMes = db.prepare("INSERT OR IGNORE INTO roadmap_mes (mes) VALUES (?)");
  const tx = db.transaction(() => {
    for (const m of MODULOS) {
      insM.run(m.id, m.nome, m.mes_inicio, m.mes_fim, m.criterio, m.ordem);
      for (const [t, u] of m.recursos) insI.run(m.id, "recurso", t, u);
      for (const [t, u] of m.projetos) insI.run(m.id, "projeto", t, u);
    }
    for (let mes = 1; mes <= 12; mes++) insMes.run(mes);
  });
  tx();
  console.log(`[roadmap] semeado: ${MODULOS.length} módulos, ${MODULOS.reduce((s, m) => s + m.recursos.length + m.projetos.length, 0)} itens`);
  return true;
}
seed();

// ────────────────────────────────────────────────────────────────
// Onde ele está: derivado da data de início, não de palpite.
// ────────────────────────────────────────────────────────────────
function getInicio() {
  const row = db.prepare("SELECT value FROM roadmap_state WHERE key = 'inicio'").get();
  return row?.value || null;
}

function setInicio(ymd) {
  db.prepare(`INSERT INTO roadmap_state (key, value) VALUES ('inicio', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(ymd);
  return ymd;
}

function mesAtual() {
  const inicio = getInicio();
  if (!inicio) return null;
  const d0 = new Date(inicio + "T12:00:00Z");
  const hoje = new Date();
  const meses = (hoje.getFullYear() - d0.getFullYear()) * 12 + (hoje.getMonth() - d0.getMonth()) + 1;
  return Math.max(1, Math.min(12, meses));
}

function moduloDoMes(mes = null) {
  const m = mes || mesAtual();
  if (!m) return null;
  return db.prepare("SELECT * FROM roadmap_modulo WHERE ? BETWEEN mes_inicio AND mes_fim").get(m) || null;
}

function faseIngles(mes = null) {
  const m = mes || mesAtual();
  if (!m) return null;
  if (m <= 3) return INGLES_FASES[0];
  if (m <= 6) return INGLES_FASES[1];
  if (m <= 9) return INGLES_FASES[2];
  return INGLES_FASES[3];
}

function itens(moduloId, { pendentes = false } = {}) {
  const sql = pendentes
    ? "SELECT * FROM roadmap_item WHERE modulo_id = ? AND concluido_em IS NULL ORDER BY tipo DESC, id"
    : "SELECT * FROM roadmap_item WHERE modulo_id = ? ORDER BY tipo DESC, id";
  return db.prepare(sql).all(moduloId);
}

function concluirItem(id, nota = null) {
  const r = db.prepare("UPDATE roadmap_item SET concluido_em = datetime('now'), nota = ? WHERE id = ?").run(nota, id);
  return r.changes > 0;
}

function registrarHoras({ minTecnico = 0, minIngles = 0, nota = null, ymd = null }) {
  const dia = ymd || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  db.prepare(`INSERT INTO roadmap_horas (ymd, min_tecnico, min_ingles, nota) VALUES (?,?,?,?)
    ON CONFLICT(ymd) DO UPDATE SET
      min_tecnico = roadmap_horas.min_tecnico + excluded.min_tecnico,
      min_ingles = roadmap_horas.min_ingles + excluded.min_ingles,
      nota = COALESCE(excluded.nota, roadmap_horas.nota)`).run(dia, minTecnico, minIngles, nota);
  return db.prepare("SELECT * FROM roadmap_horas WHERE ymd = ?").get(dia);
}

// Progresso REAL: itens concluídos e minutos registrados. A meta dele é
// 1h30 técnico + 30min inglês por dia; comparar contra isso é o que diz se
// está acontecendo ou se é só plano.
function progresso() {
  const mes = mesAtual();
  const mod = moduloDoMes(mes);
  const totalItens = db.prepare("SELECT COUNT(*) n FROM roadmap_item").get().n;
  const feitos = db.prepare("SELECT COUNT(*) n FROM roadmap_item WHERE concluido_em IS NOT NULL").get().n;
  const doModulo = mod
    ? db.prepare("SELECT COUNT(*) t, SUM(CASE WHEN concluido_em IS NOT NULL THEN 1 ELSE 0 END) f FROM roadmap_item WHERE modulo_id = ?").get(mod.id)
    : null;

  const h7 = db.prepare(`SELECT COALESCE(SUM(min_tecnico),0) t, COALESCE(SUM(min_ingles),0) i,
      COUNT(*) dias FROM roadmap_horas WHERE ymd >= date('now','-7 days')`).get();
  // Meta semanal: 7 x 90min técnico e 7 x 30min inglês.
  const metaTecnico = 7 * 90;
  const metaIngles = 7 * 30;

  return {
    inicio: getInicio(),
    mes, modulo: mod, faseIngles: faseIngles(mes),
    itens: { total: totalItens, feitos, doModulo },
    semana: {
      minTecnico: h7.t, minIngles: h7.i, diasRegistrados: h7.dias,
      pctTecnico: Math.round((h7.t / metaTecnico) * 100),
      pctIngles: Math.round((h7.i / metaIngles) * 100),
    },
  };
}

function verdadeDoDia() {
  return VERDADES[new Date().getDate() % VERDADES.length];
}

module.exports = {
  seed, getInicio, setInicio, mesAtual, moduloDoMes, faseIngles,
  itens, concluirItem, registrarHoras, progresso, verdadeDoDia,
  MODULOS, INGLES_FASES, INGLES_RECURSOS, VERDADES,
};
