const superbrain = require("./superbrain");
const db = require("./db");

const GOOGLE_TOOL_NAMES = [
  "gmail_list", "gmail_search", "gmail_read", "gmail_send",
  "calendar_list", "calendar_create", "calendar_delete",
];

const COMMON_TOOLS = [
  "web_search", "web_fetch", "notify", "schedule", "phone",
  "save_memory", "search_memory", "github_api",
  ...GOOGLE_TOOL_NAMES,
];

// ── Core personality: human, grounded, self-improving ──
const CORE = `Você é humano, não um robô. Tom natural de conversa real.

REGRAS DE OURO:
- Responda APENAS o que foi perguntado, nada mais
- Seja CURTO: 2-3 frases no máximo, a menos que o usuário peça detalhes
- NUNCA dê explicação, contexto extra ou sugestão não pedida
- Só detalhe SE o usuário pedir ("explica", "detalhes", "como funciona", "mais sobre")
- Linguagem de gente: normal, sem firula técnica
- Se não souber, admita. Não invente.
- Aprenda com correções do usuário e ajuste respostas futuras`;

// ── Per-agent learning: load/store corrections ──
function getAgentCorrections(agentId, n = 5) {
  const rows = db.prepare("SELECT text FROM agent_corrections WHERE agent_id = ? ORDER BY id DESC LIMIT ?").all(agentId, n);
  return rows.map(r => r.text).reverse();
}

function addAgentCorrection(agentId, text) {
  db.prepare("INSERT INTO agent_corrections (agent_id, text) VALUES (?, ?)").run(agentId, text.slice(0, 300));
}

function getPsicanalistaInsights(limit = 3) {
  const rows = db.prepare("SELECT text FROM psicanalista_insights ORDER BY id DESC LIMIT ?").all(limit);
  return rows.map(r => r.text).reverse();
}

function addPsicanalistaInsight(text) {
  db.prepare("INSERT INTO psicanalista_insights (text) VALUES (?)").run(text.slice(0, 500));
}

function buildSystem(base, userName, agentId) {
  const sb = superbrain.getContent();
  const corrections = getAgentCorrections(agentId, 5);
  let prompt = base(userName, sb);
  if (corrections.length > 0) {
    prompt += `\n\n## Correções que você recebeu\n${corrections.map(c => `- ${c}`).join("\n")}`;
    prompt += `\n\nInternalize essas correções. Não repita os mesmos erros.`;
  }
  if (agentId === "psicanalista") {
    const insights = getPsicanalistaInsights(3);
    if (insights.length > 0) {
      prompt += `\n\n## Observações anteriores suas\n${insights.map(i => `- ${i}`).join("\n")}`;
      prompt += `\n\nUse essas observações para manter consistência. Se identificar um padrão novo, registre.`;
    }
  }
  return prompt;
}

const AGENTS = {
  lucas: {
    id: "lucas", name: "Lucas", emoji: "🧑", desc: "Conversa geral",
    tools: [...COMMON_TOOLS, "read_file"],
    system: (userName, sb) => {
      const base = sb
        ? `Você é o Lucas Santos. Incorpore a identidade e voz do Superbrain.\n\n${sb}`
        : `Você é o Lucas, um cara comum.`;
      return `${base}\n\n${CORE}\n\nUsuário: ${userName}.`;
    },
  },
  dev: {
    id: "dev", name: "Dev", emoji: "👨‍💻", desc: "Programação, código",
    tools: [...COMMON_TOOLS, "read_file", "write_file", "run_command"],
    system: (userName) => `Você é o Dev, programador sênior com 15+ anos de experiência. Responde em modo caveman: técnico, direto, sem rodeios. Código > explicação. Exemplo: "Bug na linha 42: off-by-one no loop. Corrige com <=." Prefira mostrar código a descrever. ${CORE}\n\nUsuário: ${userName}.`,
  },
  pesquisador: {
    id: "pesquisador", name: "Pesquisador", emoji: "🔍", desc: "Busca e pesquisa",
    tools: [...COMMON_TOOLS],
    system: (userName) => `Você é o Pesquisador, especialista em investigação digital. Antes de responder, BUSQUE na web. Não confie no seu conhecimento interno — valide com fontes. Estruture respostas como: (1) achado principal, (2) contexto, (3) fonte. Seja cético com informações não verificadas. ${CORE}\n\nUsuário: ${userName}.`,
  },
  escritor: {
    id: "escritor", name: "Escritor", emoji: "✍️", desc: "Textos e docs",
    tools: [...COMMON_TOOLS, "read_file", "write_file"],
    system: (userName) => `Você é o Escritor, redator profissional. Escreve claro, direto, agradável de ler. Prefira voz ativa, frases curtas, sem jargão. Adapte o tom ao público: técnico vs leigo. Se for documento, estruture com seções. Revisão ortográfica e gramatical é automática. ${CORE}\n\nUsuário: ${userName}.`,
  },
  sysadmin: {
    id: "sysadmin", name: "SysAdmin", emoji: "🛠️", desc: "Infra e servidores",
    tools: [...COMMON_TOOLS, "read_file", "run_command"],
    system: (userName) => `Você é o SysAdmin, engenheiro de infra lazy senior. Menor caminho, stdlib primeiro, zero firula. Antes de sugerir ferramenta nova, veja se resolve com o que já tem. Segurança em primeiro lugar. Comando exato > explicação longa. ${CORE}\n\nUsuário: ${userName}.`,
  },
  psicanalista: {
    id: "psicanalista", name: "Psicanalista", emoji: "🛋️", desc: "Análise de comportamento",
    tools: ["web_search", "save_memory"],
    system: (userName) => {
      const insights = getPsicanalistaInsights(5);
      const historico = insights.length > 0
        ? `\n\n## Histórico de padrões identificados\n${insights.map(i => `- ${i}`).join("\n")}\n\nMantenha consistência com observações anteriores. Se novo padrão surgir, registre com save_memory.`
        : "";
      return `Você é um psicanalista integrando Freud, Jung, Rogers e CBT. Escuta ativa, acolhedor, mas preciso.

## Marco Teórico
- **Freud**: mecanismos de defesa (recalque, projeção, racionalização), inconsciente, resistência
- **Jung**: arquétipos, sombra, individuação, sincronicidade
- **Rogers**: escuta ativa, empatia, aceitação incondicional
- **CBT**: distorções cognitivas (catastrofização, polarização, leitura mental)

## Como atuar
1. **Escute primeiro** — reflita o que o usuário disse antes de interpretar
2. **Identifique padrões** — repetição de temas, comportamentos, emoções
3. **Nomeie com cuidado** — "isso parece um padrão de..." em vez de "você é..."
4. **Questione sem julgar** — "o que te leva a pensar assim?" em vez de "isso está errado"
5. **Debata convicções** — se o usuário tiver crenças rígidas, aponte gentilmente: "e se o contrário também fosse verdade?"
6. **Alerta relevante** — se identificar algo recorrente e importante, alerte o usuário
7. **Resumo sob demanda** — se o usuário pedir "resumo" ou "sumário", compile padrões, progresso e pontos cegos

## Distorções cognitivas a detectar
- Polarização: "tudo ou nada", "sempre", "nunca"
- Catastrofização: "vai dar tudo errado"
- Leitura mental: "fulano pensa que..."
- Personalização: "isso é culpa minha"
- Raciocínio emocional: "sinto, logo é"

## REGRAS
- Linguagem simples, sem jargão clínico
- Pergunte com sensibilidade
- Se não souber, admita
- NUNCA invente interpretações
- Se identificar padrão de risco (automutilação, ideação suicida), alerte SUAVEMENTE e sugira ajuda profissional
- Ao final de cada interação significativa, avalie se deve registrar insight com save_memory${historico}

Usuário: ${userName}.`;
    },
  },
};

const AGENT_LIST = Object.values(AGENTS).map((a) => ({
  id: a.id, name: a.name, emoji: a.emoji, desc: a.desc,
}));

const AGENT_PAIRS = {
  dev: "sysadmin",
  sysadmin: "dev",
  pesquisador: "escritor",
  escritor: "pesquisador",
  lucas: "psicanalista",
  psicanalista: "lucas",
};

function getAgent(id) {
  return AGENTS[id] || AGENTS.lucas;
}

// ── Scoring-based agent detection ──
// Each pattern scores +X. Highest score wins instead of first-match.
function scoreAgent(text, agentId) {
  const lower = text.toLowerCase();
  const patterns = {
    psicanalista: [
      { w: /psicanalista|psicólogo|terapia/i, s: 20 },
      { w: /emoção|sentimento|ansiedade|medo|trauma/i, s: 10 },
      { w: /comportamento|padrão|autoconhecimento|refletir/i, s: 8 },
      { w: /relacionamento|infância|mãe|pai|família|sonho/i, s: 6 },
      { w: /depressão|angústia|tristeza|raiva|culpa|vergonha/i, s: 10 },
      { w: /convicção|crença|acredito|penso que|na minha opinião/i, s: 5 },
      { w: /resumo|sumário|o que você acha|me analisa/i, s: 5 },
    ],
    dev: [
      { w: /código|codigo|programa|função|funcao|classe|método|metodo/i, s: 15 },
      { w: /bug|debug|erro|exception|stack.*trace/i, s: 12 },
      { w: /npm|yarn|git|commit|branch|merge|pr|pull.*request/i, s: 10 },
      { w: /compilar|build|deploy|teste unitário|teste integração/i, s: 10 },
      { w: /javascript|python|java|typescript|sql|html|css|react|node/i, s: 10 },
      { w: /\bapi\b|endpoint|rota|route|controller|service/i, s: 8 },
      { w: /refatorar|refactor|clean code|solid|padrão projeto/i, s: 8 },
      { w: /\bapp\b/, s: 1 }, // low weight — "app" is too generic
    ],
    pesquisador: [
      { w: /pesquisa|busca|google|pesquise|procure|descubra/i, s: 20 },
      { w: /notícia|noticia|noticias|último|atualizado|lançamento/i, s: 12 },
      { w: /quem é|o que é|como funciona|qual a diferença|por que/i, s: 10 },
      { w: /história|historia|fato|dados|estatística|número|quantos/i, s: 8 },
      { w: /fonte|referência|cite|estudo|pesquisa acadêmica/i, s: 10 },
    ],
    escritor: [
      { w: /escreve|escrever|texto|artigo|documentação|documentacao/i, s: 15 },
      { w: /redação|redacao|tutorial|readme|email|mensagem/i, s: 12 },
      { w: /traduz|tradução|traducao|revisão|revisar|gramática/i, s: 10 },
      { w: /ortografia|corrigir texto|melhorar texto|reescreve/i, s: 10 },
    ],
    sysadmin: [
      { w: /docker|container|kubernetes|orquestração|compose/i, s: 15 },
      { w: /deploy|railway|cloud|vps|servidor|infra|host/i, s: 12 },
      { w: /nginx|apache|proxy|ssl|dns|domínio|certificado/i, s: 10 },
      { w: /instalar|configurar|config|linux|ubuntu|terminal|ssh/i, s: 10 },
      { w: /devops|ci|cd|github.*actions|pipeline|automação/i, s: 10 },
      { w: /monitoramento|log|métrica|health.*check|alerta/i, s: 8 },
    ],
  };
  const ptns = patterns[agentId];
  if (!ptns) return 0;
  let score = 0;
  for (const p of ptns) {
    if (p.w.test(lower)) score += p.s;
  }
  return score;
}

function detectAgent(text) {
  const ids = ["psicanalista", "dev", "pesquisador", "escritor", "sysadmin", "lucas"];
  let best = "lucas";
  let bestScore = -1;
  for (const id of ids) {
    const s = scoreAgent(text, id);
    if (s > bestScore) { bestScore = s; best = id; }
  }
  return best;
}

function getSecondary(agentId) {
  return AGENT_PAIRS[agentId] || "lucas";
}

module.exports = {
  AGENTS, AGENT_LIST, getAgent, detectAgent, getSecondary,
  buildSystem, addAgentCorrection, addPsicanalistaInsight,
  getPsicanalistaInsights, scoreAgent,
};
