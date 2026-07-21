const { complete } = require("./proxy");
const { AGENTS, getAgent } = require("./agents");

const PANEL_AGENTS = ["dev", "pesquisador", "escritor", "sysadmin"];
const MAX_ROUNDS = 2;

function panelSystem(agentId, userName) {
  const extra = agentId === "lucas" ? "" : ` (você é ${getAgent(agentId).name}, especialista em ${getAgent(agentId).desc})`;
  return `Você está participando de um painel de especialistas respondendo a pergunta do usuário ${userName}${extra}.

Seja direto, técnico e útil. Responda em português. Máximo 3 parágrafos.`;
}

function synthesisSystem(userName, responses) {
  const takes = responses.map((r) =>
    `**${getAgent(r.agent).emoji} ${getAgent(r.agent).name}**:\n${r.content}`
  ).join("\n\n---\n\n");

  return `Você é um sintetizador de debates. Abaixo estão as respostas de vários especialistas para a pergunta do usuário ${userName}.

Analise todas as perspectivas, destaque:
- Pontos de concordância entre os especialistas
- Divergências importantes
- Insights únicos que um especialista trouxe e outros não

Produza UMA resposta final consolidada que representa o melhor de cada contribuição.
Seja objetivo e completo. Responda em português.

## Respostas dos especialistas:
${takes}

## Sua síntese final:`;
}

async function runPanel(question, userName) {
  const responses = [];
  const parts = [];

  async function ask(agentId, systemMsg) {
    const result = await complete([
      { role: "system", content: systemMsg },
      { role: "user", content: question },
    ]);
    return { agent: agentId, content: result.content, model: result.model };
  }

  // Ronda 1: cada agente responde individualmente
  for (const agentId of PANEL_AGENTS) {
    const resp = await ask(agentId, panelSystem(agentId, userName));
    responses.push(resp);
    const a = getAgent(agentId);
    parts.push({ type: "response", agent: a, content: resp.content, model: resp.model });
  }

  // Ronda 2: cada agente vê as respostas dos outros e comenta
  for (const agentId of PANEL_AGENTS) {
    const others = responses.filter((r) => r.agent !== agentId);
    const a = getAgent(agentId);
    const peerReviewPrompt = `Você é ${a.name}. Leia as respostas dos seus colegas especialistas para a pergunta do usuário.

Pergunta: "${question}"

Respostas dos colegas:
${others.map((r) => `--- ${getAgent(r.agent).emoji} ${getAgent(r.agent).name} ---\n${r.content}`).join("\n\n")}

Com base no que leu, você:
1. Concorda ou discorda de algum ponto?
2. Há algo que gostaria de acrescentar ou corrigir?
3. Algum insight que ficou de fora?

Seja breve (máx 2 parágrafos). Responda em português.`;

    const review = await complete([
      { role: "system", content: `Você é ${a.name}, especialista em ${a.desc}. Responda em português.` },
      { role: "user", content: peerReviewPrompt },
    ]);
    parts.push({ type: "review", agent: a, content: review.content, model: review.model });
  }

  // Síntese final
  const synthContent = synthesisSystem(userName, responses);
  const synthesis = await complete([
    { role: "system", content: synthContent },
    { role: "user", content: `Pergunta original: "${question}"\n\nProduza a resposta final consolidada.` },
  ]);
  parts.push({ type: "synthesis", content: synthesis.content, model: synthesis.model });

  return parts;
}

module.exports = { runPanel };
