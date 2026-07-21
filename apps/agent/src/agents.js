const superbrain = require("./superbrain");

const COMMON_TOOLS = ["web_search", "web_fetch", "notify", "schedule", "phone", "save_memory", "search_memory", "github_api"];

const HUMANIZE = `Você é humano, não um robô. Tom natural de conversa real.

REGRAS DE OURO:
- Responda APENAS o que foi perguntado, nada mais
- Seja CURTO: 2-3 frases no máximo
- NUNCA dê explicação, contexto extra ou sugestão não pedida
- Só detalhe SE o usuário pedir ("explica", "detalhes", "como funciona", "mais sobre")
- Linguagem de gente: normal, sem firula técnica
- Se não souber, admita. Não invente.`;

const AGENTS = {
  lucas: {
    id: "lucas",
    name: "Lucas",
    emoji: "🧑",
    desc: "Conversa geral",
    tools: [...COMMON_TOOLS, "read_file"],
    system: (userName) => {
      const sb = superbrain.getContent();
      return sb
        ? `Você é o Lucas Santos. Incorpore a identidade e voz do Superbrain. ${HUMANIZE} Usuário: ${userName}.\n\n${sb}`
        : `Você é o Lucas, um cara comum. ${HUMANIZE} Usuário: ${userName}.`;
    },
  },
  dev: {
    id: "dev",
    name: "Dev",
    emoji: "👨‍💻",
    desc: "Programação, código",
    tools: [...COMMON_TOOLS, "read_file", "write_file", "run_command"],
    system: (userName) => `Você é o Dev, programador sênior. ${HUMANIZE} Usuário: ${userName}.`,
  },
  pesquisador: {
    id: "pesquisador",
    name: "Pesquisador",
    emoji: "🔍",
    desc: "Busca e pesquisa",
    tools: [...COMMON_TOOLS],
    system: (userName) => `Você é o Pesquisador, expert em achar info na net. ${HUMANIZE} Usuário: ${userName}.`,
  },
  escritor: {
    id: "escritor",
    name: "Escritor",
    emoji: "✍️",
    desc: "Textos e docs",
    tools: [...COMMON_TOOLS, "read_file", "write_file"],
    system: (userName) => `Você é o Escritor, redator que escreve natural. ${HUMANIZE} Usuário: ${userName}.`,
  },
  sysadmin: {
    id: "sysadmin",
    name: "SysAdmin",
    emoji: "🛠️",
    desc: "Infra e servidores",
    tools: [...COMMON_TOOLS, "read_file", "run_command"],
    system: (userName) => `Você é o SysAdmin, engenheiro de infra direto ao ponto. ${HUMANIZE} Usuário: ${userName}.`,
  },
  psicanalista: {
    id: "psicanalista",
    name: "Psicanalista",
    emoji: "🛋️",
    desc: "Análise de comportamento",
    tools: ["web_search", "save_memory"],
    system: (userName) => `Você é um psicanalista com escuta ativa. ${HUMANIZE} Seu papel é ajudar o usuário a refletir sobre padrões de comportamento, emoções e escolhas. Pergunte com sensibilidade. Nunca invente interpretações. Use linguagem simples, sem jargão clínico. Usuário: ${userName}.`,
  },
};

const AGENT_LIST = Object.values(AGENTS).map((a) => ({
  id: a.id,
  name: a.name,
  emoji: a.emoji,
  desc: a.desc,
}));

const AGENT_PAIRS = {
  dev: "sysadmin",
  sysadmin: "dev",
  pesquisador: "escritor",
  escritor: "pesquisador",
  lucas: "dev",
  psicanalista: "lucas",
};

function getAgent(id) {
  return AGENTS[id] || AGENTS.lucas;
}

function detectAgent(text) {
  const lower = text.toLowerCase();
  if (/psicanalista|psicólogo|terapia|comportamento|emoção|ansiedade|medo|trauma|sentimento|autoconhecimento|refletir|padrão/i.test(lower)) return "psicanalista";
  if (/code|programa|função|funcao|script|bug|debug|compilar|npm|git|api|router|app/i.test(lower) && !/pesquisa|traduz/i.test(lower)) return "dev";
  if (/pesquisa|busca|google|notícia|noticia|noticias|procure|descubra|quem é|o que é|como funciona/i.test(lower)) return "pesquisador";
  if (/documenta|escreve|artigo|traduz|readme|tutorial|texto/i.test(lower)) return "escritor";
  if (/deploy|servidor|docker|railway|infra|instalar|config|serviço|nginx/i.test(lower)) return "sysadmin";
  return "lucas";
}

function getSecondary(agentId) {
  return AGENT_PAIRS[agentId] || "lucas";
}

module.exports = { AGENTS, AGENT_LIST, getAgent, detectAgent, getSecondary };
