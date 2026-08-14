// Módulo de Ensino & Manual de Instruções Interativo do Agente Lucas
// Permite que o agente consulte, ensine e explique todas as suas capacidades, comandos e passos a passo.

const fs = require("node:fs");
const path = require("node:path");

const MANUAL_PATH = path.join(__dirname, "../../../MANUAL_DO_AGENTE.md");

function loadFullManual() {
  try {
    if (fs.existsSync(MANUAL_PATH)) {
      return fs.readFileSync(MANUAL_PATH, "utf-8");
    }
  } catch (e) {
    console.warn("[Manual] Erro ao carregar MANUAL_DO_AGENTE.md:", e.message);
  }
  return null;
}

const TOPICS = {
  geral: `🤖 **Identidade & Visão Geral do Agente Lucas**
Sou seu Braço Direito Executivo, Estrategista de Vendas B2B e Arquiteto de Software.
• **Motor de IA:** Roteamento com failover ultra-rápido entre Gemini 3 Flash, Kimi k2.7, MiniMax M3, Nemotron 3 Ultra e Claude Opus.
• **Memória:** SQLite persistente para lembrar suas preferências, fatos da sua vida e histórico de campanhas.
• **Operação:** 24/7 em nuvem (Railway) e modo headless invisível.
• Use \`/manual\` para ver os outros tópicos ou me faça qualquer pergunta!`,

  prospeccao: `🎯 **Motor 24/7 de Prospecção B2B (Zenda & Multi-Produto)**
Busco clientes e empresas ativas para vender suas aplicações de forma contínua:
1. **Mineração:** Varre Web, Google Maps e Instagram procurando clínicas e empresas com WhatsApp e Instagram ativos.
2. **Desduplicação:** Hash SHA-256 para nunca repetir um contato.
3. **Copywriting com IA:** Redige a abordagem comercial perfeita sob medida para o nicho.
4. **Comandos:**
   • \`/prospector status\` — Ver métricas e status do robô
   • \`/prospector run\` — Rodar ciclo de busca agora
   • \`/prospector list\` — Listar últimos clientes e rascunhos
   • \`/prospector toggle\` — Pausar ou ligar o robô 24/7`,

  avatar: `🔬 **Pesquisa de Mercado & ICP/Avatar com IA**
Antes de vender, posso fazer uma varredura de mercado completa para o nicho desejado:
• **Comando:** \`/prospector avatar <nicho>\`
  _(Ex.: \`/prospector avatar Clínicas Odontológicas\` ou \`/prospector avatar Clínicas de Estética\`)_
• **O que eu entrego:**
  1. 👤 **ICP/Avatar:** Tomadores de decisão (Dono, Sócio-médico, Gestora).
  2. ⚡ **Top 3 Dores Latentes:** Gargalos de agendamento e perda de faturamento.
  3. 🛡️ **Top 3 Objeções & Quebras:** Como responder "já tenho secretária", etc.
  4. 🎯 **Ganchos de Abordagem:** Pitches magnéticos para WhatsApp e Instagram DM.
  5. 💡 **Modelo de Oferta:** Sugestão de Setup + Mensalidade SaaS.`,

  produtos: `📦 **Gerenciamento de Portfólio de Produtos**
Você pode cadastrar qualquer aplicação ou serviço para eu prospectar:
• \`/prospector produtos\` — Lista produtos cadastrados e qual está ativo.
• \`/prospector usar <id>\` — Ativa um produto para prospecção imediata.
• \`/prospector produto add <Nome>; <Descrição>; <Nichos>; <Cidades>\` — Cadastra um novo produto.
  _(Ex.: \`/prospector produto add Zenda AI; Agente de IA para WhatsApp 24/7; Clínicas; São Paulo\`_)`,

  invisivel: `🕵️‍♂️ **Canais de Envio & Operação Invisível (Sem Abrir Abas)**
• **WhatsApp:** Envio 100% headless no servidor via Evolution API / Baileys. Sem abas abertas.
• **Instagram DM:** Envio em segundo plano via Chrome Extension Service Worker com cookies da sessão já logada. Sem pop-ups nem abas na sua tela.
• **Telegram:** Alertas instantâneos no seu celular a cada novo cliente minerado.`,

  automacoes: `⚡ **Automações & Agendamentos (Linguagem Natural)**
Você pode criar qualquer automação conversando comigo:
• *"Toda segunda às 9h me mande o resumo das clínicas mineradas"*
• *"Todo dia às 8h me dê uma dica de estratégia de vendas do Zenda"*
• Comandos: \`list_automations\`, \`cancel_automation\`, \`run_automation_now\`.`,

  comandos: `📋 **Tabela de Principais Comandos & Aliases**
• \`/manual\` — Menu interativo de instruções
• \`/manual <tema>\` — Explicação passo a passo de um tema
• \`/prospector status\` — Painel de métricas do prospector
• \`/prospector run\` — Rodar ciclo de busca agora
• \`/prospector avatar <nicho>\` — Pesquisa de mercado e Avatar
• \`/prospector produtos\` — Portfólio de produtos à venda
• \`/prospector usar <id>\` — Mudar produto ativo
• \`/prospector add <nichos>; [locais]\` — Atualizar termos de busca
• \`/prospector list\` — Listar leads minerados e abordagens
• \`/modelos\` — Ranking de modelos de IA e latências
• \`/limpar\` — Limpar histórico do chat`,

  passoapasso: `🚀 **Passo a Passo: Como Iniciar uma Campanha de Vendas do Zenda**
1. **Pesquisa do Avatar:** \`/prospector avatar Clínicas Odontológicas\`
2. **Ativar o Zenda:** \`/prospector usar zenda-ai\`
3. **Definir Regiões:** \`/prospector add Clínicas Odontológicas; São Paulo, Moema, Campinas\`
4. **Executar Busca:** \`/prospector run\`
5. **Acompanhar:** \`/prospector list\` ou conferir os alertas no seu Telegram!`
};

function getManualTopic(query) {
  if (!query || query.trim() === "" || query === "menu" || query === "ajuda" || query === "help") {
    return `📖 *Manual Interativo do Agente Lucas*\n\n` +
      `Selecione um tópico para aprender passo a passo:\n\n` +
      `• \`/manual prospecção\` — Como funciona o motor 24/7 de busca de clientes\n` +
      `• \`/manual avatar\` — Como fazer pesquisa de mercado e mapa de Avatar/ICP\n` +
      `• \`/manual produtos\` — Como cadastrar e trocar produtos do portfólio\n` +
      `• \`/manual invisível\` — Como funciona o envio sem abrir abas\n` +
      `• \`/manual automações\` — Como criar rotinas e agendamentos\n` +
      `• \`/manual comandos\` — Tabela completa de comandos e atalhos\n` +
      `• \`/manual passoapasso\` — Guia passo a passo de campanha do zero\n` +
      `• \`/manual tudo\` — Exibir o manual completo na íntegra\n\n` +
      `_Dica: Você também pode me perguntar em linguagem natural: "Lucas, como crio uma campanha de vendas?" ou "O que você sabe fazer?"_`;
  }

  const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  if (q === "tudo" || q === "completo" || q === "all") {
    const full = loadFullManual();
    if (full) return full;
    return Object.values(TOPICS).join("\n\n---\n\n");
  }

  if (q.includes("prospec") || q.includes("lead") || q.includes("cliente") || q.includes("venda") || q.includes("zenda")) {
    return TOPICS.prospeccao;
  }
  if (q.includes("avatar") || q.includes("icp") || q.includes("pesquisa") || q.includes("mercado")) {
    return TOPICS.avatar;
  }
  if (q.includes("produto") || q.includes("portfolio")) {
    return TOPICS.produtos;
  }
  if (q.includes("invisiv") || q.includes("aba") || q.includes("head") || q.includes("segundo plano") || q.includes("whats") || q.includes("insta")) {
    return TOPICS.invisivel;
  }
  if (q.includes("auto") || q.includes("cron") || q.includes("agend")) {
    return TOPICS.automacoes;
  }
  if (q.includes("coman") || q.includes("alias") || q.includes("atalho")) {
    return TOPICS.comandos;
  }
  if (q.includes("passo") || q.includes("guia") || q.includes("como usar") || q.includes("tutorial")) {
    return TOPICS.passoapasso;
  }
  if (q.includes("geral") || q.includes("lucas") || q.includes("quem")) {
    return TOPICS.geral;
  }

  return `❓ Tópico não encontrado. Tente:\n• \`/manual prospecção\`\n• \`/manual avatar\`\n• \`/manual produtos\`\n• \`/manual invisível\`\n• \`/manual automações\`\n• \`/manual comandos\`\n• \`/manual passoapasso\`\n• \`/manual tudo\``;
}

module.exports = {
  getManualTopic,
  loadFullManual,
  TOPICS
};
