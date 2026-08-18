// Motor Autônomo 24/7 de Prospecção B2B de Clientes para o Zenda AI
// Busca clínicas, consultórios e empresas na Web/Google/Instagram, gera abordagens persuasivas com IA
// e gerencia envios via WhatsApp, Instagram DM e Fila de Rascunhos.

const crypto = require("node:crypto");
const db = require("./db");
const proxy = require("./proxy");
const config = require("./config");
const keyrotator = require("./keyrotator");
const webSearch = require("./tools/webSearch");
const extensionBridge = require("./extensionBridge");

// Schema SQLite para Leads de Clientes, Configurações de Venda do Zenda e Disparos
db.exec(`
  CREATE TABLE IF NOT EXISTS prospector_settings (
    id TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1,
    interval_min INTEGER NOT NULL DEFAULT 15,
    auto_send_wa INTEGER NOT NULL DEFAULT 0, -- 0 = rascunho seguro para aprovação, 1 = disparo automático
    auto_send_ig INTEGER NOT NULL DEFAULT 0,
    target_keywords TEXT NOT NULL DEFAULT 'Clínica Odontológica, Clínica de Estética, Consultório Médico, Hospital Veterinário, Dermatologia',
    target_location TEXT NOT NULL DEFAULT 'São Paulo, Rio de Janeiro, Curitiba, Belo Horizonte, Campinas',
    product_name TEXT NOT NULL DEFAULT 'Zenda AI',
    custom_pitch TEXT DEFAULT '',
    last_run INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS prospector_leads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    city TEXT NOT NULL,
    description TEXT,
    contact_person TEXT,
    phone TEXT,
    instagram_handle TEXT,
    email TEXT,
    cnpj TEXT,
    website_url TEXT,
    source TEXT NOT NULL DEFAULT 'web', -- web | maps | instagram | linkedin
    status TEXT NOT NULL DEFAULT 'discovered', -- discovered | drafted | queued | sent | replied | scheduled | closed | rejected
    -- 'queued' = enfileirado na extensão (Instagram); entrega NÃO confirmada.
    -- 'sent' só é usado quando o canal confirmou o envio.
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS prospector_outreach (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT NOT NULL,
    channel TEXT NOT NULL, -- whatsapp | instagram | linkedin
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', -- draft | queued | pending | sent | delivered | failed
    sent_at INTEGER,
    response_text TEXT,
    error TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (lead_id) REFERENCES prospector_leads(id)
  );

  CREATE TABLE IF NOT EXISTS prospector_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    target_niches TEXT NOT NULL,
    target_locations TEXT NOT NULL,
    value_props TEXT NOT NULL,
    default_pitch TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS prospector_market_research (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    niche TEXT NOT NULL,
    avatar_title TEXT NOT NULL,
    pain_points TEXT NOT NULL,
    objections TEXT NOT NULL,
    hooks TEXT NOT NULL,
    full_dossier TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_prospector_leads_status ON prospector_leads(status, created_at);
  CREATE INDEX IF NOT EXISTS idx_prospector_outreach_lead ON prospector_outreach(lead_id, channel);
  CREATE INDEX IF NOT EXISTS idx_prospector_products_active ON prospector_products(is_active);
`);

// Migrações seguras de colunas para bancos já criados
try { db.exec("ALTER TABLE prospector_settings ADD COLUMN product_name TEXT DEFAULT 'Zenda AI'"); } catch {}
try { db.exec("ALTER TABLE prospector_settings ADD COLUMN active_product_id TEXT DEFAULT 'zenda-ai'"); } catch {}
try { db.exec("ALTER TABLE prospector_leads ADD COLUMN name TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE prospector_leads ADD COLUMN category TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE prospector_leads ADD COLUMN city TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE prospector_leads ADD COLUMN contact_person TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE prospector_leads ADD COLUMN website_url TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE prospector_leads ADD COLUMN matched_product_id TEXT DEFAULT ''"); } catch {}
// Página correspondente no Notion. NULL = ainda não sincronizado; é assim que
// syncPendingLeads sabe o que falta enviar, e o que torna o envio idempotente
// com o ciclo reencontrando os mesmos estabelecimentos a cada 15 min.
try { db.exec("ALTER TABLE prospector_leads ADD COLUMN notion_page_id TEXT"); } catch {}
// Toque 2 da sequencia: revelado apenas depois da empresa responder ao toque 1.
// Guardado na mesma linha do rascunho para a listagem mostrar os dois passos
// juntos, na ordem em que serao enviados.
try { db.exec("ALTER TABLE prospector_outreach ADD COLUMN followup_message TEXT"); } catch {}
// Dados estruturados de contato/identificação. Lead sem nenhum canal não é mais
// gravado (ver a regra no runCycle), então estas colunas são o que torna a base
// utilizável em vez de uma lista de nomes.
try { db.exec("ALTER TABLE prospector_leads ADD COLUMN email TEXT"); } catch {}
try { db.exec("ALTER TABLE prospector_leads ADD COLUMN cnpj TEXT"); } catch {}

// Seed de produtos padrão no portfólio
try {
  const hasZenda = db.prepare("SELECT id FROM prospector_products WHERE id = 'zenda-ai'").get();
  if (!hasZenda) {
    db.prepare(`
      INSERT INTO prospector_products (id, name, description, target_niches, target_locations, value_props, default_pitch, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      'zenda-ai',
      'Zenda AI (Clínicas & Consultórios)',
      'Agente de IA e Atendimento 24/7 para WhatsApp integrado ao Google Calendar para agendamento automático de consultas.',
      'Clínica Odontológica, Clínica de Estética, Consultório Médico, Hospital Veterinário, Dermatologia, Fisioterapia, Nutrição',
      'São Paulo, Rio de Janeiro, Curitiba, Belo Horizonte, Campinas, Brasil',
      'Atendimento 24/7 no WhatsApp, Agendamento automático no Google Calendar, Redução de no-show, Zero perda de pacientes fora do horário comercial',
      'Atende pacientes instantaneamente, tira dúvidas de procedimentos e agenda consultas no Google Calendar sem sobrecarregar a recepção.'
    );
  }

  const hasMaxrouter = db.prepare("SELECT id FROM prospector_products WHERE id = '9router-gateway'").get();
  if (!hasMaxrouter) {
    db.prepare(`
      INSERT INTO prospector_products (id, name, description, target_niches, target_locations, value_props, default_pitch, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      '9router-gateway',
      'MaxRouter LLM Gateway (B2B Tech)',
      'Gateway unificado de IA com roteamento inteligente, fallback automático de modelos e redução de até 80% nos custos de token.',
      'Startups de Tecnologia, Software Houses, Desenvolvedores, Agências Digitais, Empresas de SaaS',
      'Brasil, São Paulo, Remoto, Internacional',
      '140+ modelos de IA em 1 endpoint, Zero downtime com failover instantâneo, Cache semântico de alta velocidade',
      'Roteador inteligente de LLMs com alta resiliência e fallback automático para suas aplicações de IA.'
    );
  }
} catch (err) {
  console.warn("[Prospector Seed] Erro ao registrar produtos padrão:", err.message);
}

// Garante configuração padrão inicial para o Zenda
const defaultSettings = db.prepare("SELECT * FROM prospector_settings WHERE id = 'default'").get();
if (!defaultSettings) {
  db.prepare(`
    INSERT INTO prospector_settings (id, enabled, interval_min, auto_send_wa, auto_send_ig, target_keywords, target_location, product_name)
    VALUES ('default', 1, 15, 0, 0, 'Clínica Odontológica, Clínica de Estética, Consultório Médico, Hospital Veterinário, Dermatologia', 'São Paulo, Rio de Janeiro, Curitiba, Belo Horizonte, Campinas', 'Zenda AI')
  `).run();
}

function getSettings() {
  const row = db.prepare("SELECT * FROM prospector_settings WHERE id = 'default'").get();
  return row || {
    enabled: 1,
    interval_min: 15,
    auto_send_wa: 0,
    auto_send_ig: 0,
    target_keywords: 'Clínica Odontológica, Clínica de Estética, Consultório Médico, Hospital Veterinário, Dermatologia',
    target_location: 'São Paulo, Rio de Janeiro, Curitiba, Belo Horizonte, Campinas',
    product_name: 'Zenda AI',
    last_run: 0
  };
}

function updateSettings(settings) {
  const current = getSettings();
  const next = { ...current, ...settings };
  db.prepare(`
    UPDATE prospector_settings
    SET enabled = ?, interval_min = ?, auto_send_wa = ?, auto_send_ig = ?,
        target_keywords = ?, target_location = ?, product_name = ?, custom_pitch = ?, active_product_id = ?
    WHERE id = 'default'
  `).run(
    next.enabled ? 1 : 0,
    Math.max(1, parseInt(next.interval_min) || 15),
    next.auto_send_wa ? 1 : 0,
    next.auto_send_ig ? 1 : 0,
    next.target_keywords || '',
    next.target_location || '',
    next.product_name || 'Zenda AI',
    next.custom_pitch || '',
    next.active_product_id || 'zenda-ai'
  );
  return getSettings();
}

function addProduct({ id, name, description, target_niches, target_locations, value_props, default_pitch }) {
  if (!name) throw new Error("Nome do produto obrigatório");
  const prodId = id || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  db.prepare(`
    INSERT INTO prospector_products (id, name, description, target_niches, target_locations, value_props, default_pitch, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      target_niches = excluded.target_niches,
      target_locations = excluded.target_locations,
      value_props = excluded.value_props,
      default_pitch = excluded.default_pitch
  `).run(
    prodId,
    name,
    description || "",
    target_niches || "Clínicas, Consultórios, Empresas",
    target_locations || "São Paulo, Rio de Janeiro, Brasil",
    value_props || "",
    default_pitch || ""
  );
  return getProduct(prodId);
}

function getProduct(id) {
  return db.prepare("SELECT * FROM prospector_products WHERE id = ?").get(id);
}

function listProducts() {
  return db.prepare("SELECT * FROM prospector_products ORDER BY is_active DESC, created_at DESC").all();
}

function setActiveProduct(id) {
  const prod = getProduct(id);
  if (!prod) throw new Error(`Produto "${id}" não encontrado`);
  db.prepare("UPDATE prospector_products SET is_active = 0").run();
  db.prepare("UPDATE prospector_products SET is_active = 1 WHERE id = ?").run(id);
  updateSettings({
    product_name: prod.name,
    target_keywords: prod.target_niches,
    target_location: prod.target_locations,
    custom_pitch: prod.default_pitch,
    active_product_id: prod.id,
  });
  return prod;
}

/**
 * Realiza Pesquisa de Mercado com IA e WebSearch para mapear ICP / Avatar, Dores e Ganchos.
 */
// Orçamento de tempo da pesquisa de mercado. O comando /prospector avatar é
// síncrono e responde dentro do timeout de 120s do proxy do dashboard, então
// o pior caso aqui precisa caber com folga:
//   busca web (2 queries em paralelo, 30s cada) + síntese (teto abaixo) < 120s.
const LLM_ATTEMPT_TIMEOUT_MS = 45_000;   // por tentativa de modelo
const RESEARCH_DEADLINE_MS = 75_000;     // teto total da síntese, todos os modelos somados

async function researchMarketAvatar(niche, productName) {
  const settings = getSettings();
  const prodName = productName || settings.product_name || "Zenda AI";
  const targetNiche = niche || settings.target_keywords.split(",")[0].trim() || "Clínicas Odontológicas";

  console.log(`[MarketResearch] Realizando pesquisa de mercado e avatar para "${targetNiche}" focado em "${prodName}"...`);

  // 1. Busca fatos de mercado na Web
  let marketSnippets = "";
  try {
    const webQueries = [
      `problemas gestão atendimento agendamento ${targetNiche}`,
      `software automação whatsapp no-show ${targetNiche}`,
    ];
    const results = await Promise.all(webQueries.map((q) => webSearch.searchWeb(q, 3)));
    marketSnippets = results.flat().map((r) => `- ${r.title}: ${r.snippet || ""}`).join("\n");
  } catch (e) {
    console.warn("[MarketResearch] WebSearch aviso:", e.message);
  }

  // 2. Análise Profunda com IA (LLM Market Strategist)
  const prompt = `Você é um estrategista sênior de Go-To-Market e Vendas B2B para o produto "${prodName}".
Analise o nicho "${targetNiche}" com base nas informações de mercado e monte o Dossiê Completo de Avatar / ICP.

Fatos coletados da Web:
${marketSnippets || "(Conhecimento geral do setor de saúde/serviços no Brasil)"}

Estruture o dossiê com os seguintes tópicos obrigatórios:
1. 👤 PERFIL DO CLIENTE IDEAL (ICP & AVATAR):
   - Quem é o tomador de decisão (Dono da clínica, Sócio-médico, Gestor(a) de atendimento).
   - Porte ideal da empresa (faturamento, nº de atendimentos/mês, tamanho da recepção).
2. ⚡ TOP 3 DORES LATENTES:
   - Os 3 maiores problemas que fazem o cliente perder dinheiro hoje (ex.: pacientes sem resposta fora do horário, secretária sobrecarregada, no-show/faltas).
3. 🛡️ TOP 3 OBJEÇÕES DE COMPRA & COMO QUEBRAR:
   - "Já tenho secretária", "IA é fria/robótica", "Não tenho tempo para configurar".
4. 🎯 GANCHOS DE ABORDAGEM (PITCH ANGLES):
   - 2 ganchos diretos para WhatsApp e Instagram DM focados em ROI e agendamento automático.
5. 💡 OFERTA & PRICING SUGERIDO:
   - Modelo de precificação ideal (Mensalidade recorrente SaaS + Setup).

Retorne em Markdown bem formatado, profissional e pronto para orientar o robô de prospecção.`;

  // 15s por tentativa era pouco para um dossiê de 5 seções e fazia o fallback
  // enlatado disparar quase sempre. Mas proxy.complete() percorre TODA a fila
  // de modelos (proxy.js), então o pior caso é `nº de modelos × timeoutMs` —
  // só aumentar o valor por tentativa estouraria o teto do chat síncrono.
  // Por isso são dois limites: um por tentativa e um teto de tempo total.
  let dossier = "";
  let deadlineTimer = null;
  try {
    const completion = await Promise.race([
      proxy.complete([
        { role: "system", content: "Você é um diretor de Go-To-Market e inteligência de mercado B2B." },
        { role: "user", content: prompt },
      ], { timeoutMs: LLM_ATTEMPT_TIMEOUT_MS, maxRetries: 1 }),
      new Promise((_, reject) => {
        deadlineTimer = setTimeout(
          () => reject(new Error(`a síntese excedeu ${Math.round(RESEARCH_DEADLINE_MS / 1000)}s`)),
          RESEARCH_DEADLINE_MS
        );
      }),
    ]);
    dossier = (completion?.content || "").trim();
  } catch (err) {
    // NUNCA devolver texto genérico como se fosse pesquisa. A versão anterior
    // retornava um dossiê hardcoded aqui — idêntico para qualquer nicho e
    // indistinguível de um resultado real, que ainda seria arquivado no Notion
    // como se fosse inteligência de mercado. Falha tem que parecer falha.
    console.error(`[MarketResearch] Falha na síntese para "${targetNiche}": ${err.message}`);
    return { ok: false, niche: targetNiche, product: prodName, dossier: null, error: err.message };
  } finally {
    if (deadlineTimer) clearTimeout(deadlineTimer);
  }

  if (!dossier) {
    console.error(`[MarketResearch] Modelo retornou dossiê vazio para "${targetNiche}".`);
    return { ok: false, niche: targetNiche, product: prodName, dossier: null, error: "o modelo retornou um dossiê vazio" };
  }

  // Só grava quando há pesquisa real. As colunas estruturadas ficam vazias
  // de propósito: o esquema é NOT NULL, e a versão anterior preenchia as três
  // com frases fixas no código — iguais para qualquer nicho, independentes do
  // que o LLM produziu. `full_dossier` é a única fonte de verdade aqui.
  db.prepare(`
    INSERT INTO prospector_market_research (product_id, niche, avatar_title, pain_points, objections, hooks, full_dossier)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    settings.active_product_id || 'zenda-ai',
    targetNiche,
    `Avatar ${targetNiche}`,
    '',
    '',
    '',
    dossier
  );

  return {
    ok: true,
    niche: targetNiche,
    product: prodName,
    dossier,
  };
}

/**
 * Gera mensagem comercial B2B altamente persuasiva para vender o Zenda AI.
 */
// Abordagem de primeiro contato (cold outreach).
//
// A versão anterior injetava 4 bullets de funcionalidade no prompt e mandava
// "convide para uma demonstração de 5 minutos" — ou seja, ordenava exatamente
// o que a prática de SDR diz para NÃO fazer: falar de produto antes de dor, e
// fechar com pergunta de sim/não. O resultado eram mensagens genéricas, que
// são ignoradas.
//
// Princípios aplicados (metodologia de pré-vendas B2B, ver LIVRO_DE_ESTUDOS
// cap. 73): pesquisa antes do contato, dor antes de produto, UMA pergunta
// aberta, sem pedir reunião no primeiro toque. O objetivo do toque 1 é
// RESPOSTA, não agenda.
const CHANNEL_LIMITS = {
  whatsapp: { maxChars: 400, linhas: "3 a 4 linhas curtas" },
  instagram: { maxChars: 280, linhas: "2 a 3 linhas" },
};

// Dor por nicho, na linguagem de quem vive o problema — não na nossa.
const DOR_POR_NICHO = [
  { re: /odonto|dent/i, dor: "paciente que manda mensagem à noite perguntando preço de clareamento ou implante e só recebe resposta no dia seguinte, quando já marcou em outro lugar" },
  { re: /est[eé]tic|dermato|harmoniza/i, dor: "quem vê o story, chama na hora perguntando valor do procedimento e desiste se não responde rápido" },
  { re: /veterin|animal|pet/i, dor: "tutor com bicho passando mal fora do horário, que liga pra quem atender primeiro" },
  { re: /m[eé]dic|consult[oó]rio|cl[íi]nic/i, dor: "paciente que precisa remarcar e fica sem resposta, virando falta na agenda" },
  { re: /fisio|nutri|psic/i, dor: "primeira consulta que não fecha porque a dúvida sobre valor e convênio ficou sem resposta" },
];

function dorDoNicho(category) {
  const hit = DOR_POR_NICHO.find((d) => d.re.test(String(category || "")));
  return hit ? hit.dor : "mensagem de paciente fora do horário comercial que fica sem resposta e vira agendamento perdido";
}

// A abordagem é uma SEQUÊNCIA de dois toques, não uma mensagem só.
//
// Toque 1 (abertura): fala com a EMPRESA, não com uma pessoa imaginária.
// Menciona que existe um problema recorrente nas clínicas da região SEM dizer
// qual, e pergunta se aquela clínica também enfrenta. Cria lacuna de curiosidade
// e pede um micro-compromisso barato: responder "sim, acontece aqui".
//
// Toque 2 (dor): só depois da resposta. Aí nomeia a dor e faz a pergunta aberta.
// Entregar a dor no toque 1 desperdiça o gancho — a pessoa lê tudo e não precisa
// responder nada.
//
// Exceção deliberada à regra de "nunca pergunta de sim/não": no toque 1 ela é o
// objetivo. Pergunta fácil gera resposta; a pergunta ABERTA fica no toque 2,
// quando já existe conversa.
//
// A saudação fica como token e é resolvida na HORA DE LISTAR, não aqui: rascunho
// gerado de manhã e enviado à tarde diria "Bom dia" às 15h — é o tipo de detalhe
// que denuncia automação.
// Pluraliza o segmento para caber em "nas ___ de São Paulo".
//
// Um "+s" ingênuo produz "hospitals veterinários" e "clínicas de estéticas".
// Regras aplicadas: pluraliza o núcleo e os adjetivos até encontrar preposição
// (de/da/do/em), porque o que vem depois dela é complemento e fica no singular.
// Terminações irregulares tratadas: -al/-el/-ol/-ul viram -ais/-eis/-ois/-uis,
// -m vira -ns, -r/-z ganham -es, -ão vira -ões.
const PREPOSICOES = new Set(["de", "da", "do", "das", "dos", "em", "na", "no", "para", "e", "com"]);

function pluralizarPalavra(w) {
  const lower = w.toLowerCase();
  if (lower.endsWith("s")) return lower;
  if (/[aeiou]l$/.test(lower)) return lower.slice(0, -1) + "is";        // hospital -> hospitais
  if (lower.endsWith("m")) return lower.slice(0, -1) + "ns";            // comum -> comuns
  if (/[rz]$/.test(lower)) return lower + "es";                          // doutor -> doutores
  if (lower.endsWith("ão")) return lower.slice(0, -2) + "ões";          // reabilitação -> reabilitações
  return lower + "s";
}

function pluralizarSegmento(categoria) {
  const palavras = String(categoria || "").trim().split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return "clínicas";
  const out = [];
  let paramos = false;
  for (const w of palavras) {
    const lower = w.toLowerCase();
    if (PREPOSICOES.has(lower)) paramos = true;
    out.push(paramos ? lower : pluralizarPalavra(w));
  }
  return out.join(" ");
}

const SAUDACAO_TOKEN = "{{SAUDACAO}}";

function saudacaoAgora(date = new Date()) {
  // Horário de São Paulo, independente do fuso do servidor.
  const h = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(date)
  );
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

function aplicarSaudacao(texto, date = new Date()) {
  const saudacao = saudacaoAgora(date);
  let out = String(texto || "").split(SAUDACAO_TOKEN).join(saudacao);
  // O modelo costuma escrever o token colado na frase seguinte, produzindo
  // "Bom dia Identifiquei um problema" — sem pontuacao a frase fica emendada
  // e denuncia template. Insere a pontuacao quando falta.
  const emendado = new RegExp("(" + saudacao + ")\\s+(?=[A-Za-zÀ-ÿ])");
  out = out.replace(emendado, "$1! ");
  return out;
}

// ---------- TOQUE 1: abertura ----------
async function generateOpener(lead, channel = "whatsapp") {
  const lim = CHANNEL_LIMITS[channel] || CHANNEL_LIMITS.whatsapp;
  const regiao = String(lead.city || "").split(",")[0].trim();
  const segmento = pluralizarSegmento(lead.category);
  // 0.85 e nao 0.7: com pouco espaco o modelo comprime e sai telegrama
  // (\"Identificado problema recorrente em clinicas odontologicas Sao Paulo\"),
  // sem preposicao nem virgula — exatamente o oposto de humanizado.
  const maxAbertura = Math.max(240, Math.round(lim.maxChars * 0.85));

  const prompt = [
    `Escreva a PRIMEIRA mensagem de uma abordagem comercial fria. Canal: ${channel.toUpperCase()}.`,
    "",
    "DADOS REAIS:",
    `- Empresa: ${lead.name}`,
    `- Segmento: ${segmento}`,
    `- Região: ${regiao || "não informada"}`,
    "",
    "OBJETIVO DESTA MENSAGEM: conseguir uma RESPOSTA curta. Nada mais.",
    "",
    `ESTRUTURA OBRIGATÓRIA (no máximo ${maxAbertura} caracteres):`,
    `1. Comece exatamente com ${SAUDACAO_TOKEN} — o sistema troca pela saudação correta na hora do envio.`,
    `2. Diga que está entrando em contato porque identificou um problema recorrente nas ${segmento} de ${regiao || "sua região"}.`,
    `3. Pergunte se a ${lead.name} também enfrenta esse problema.`,
    "",
    "REGRAS:",
    "- Fale com a EMPRESA, não com uma pessoa. Refira-se a ela pelo nome. Nada de tratar como indivíduo, nada de 'equipe', nada de 'amigo'.",
    "- NÃO revele qual é o problema. A curiosidade é o que faz responder.",
    "- NÃO cite produto, tecnologia, IA, funcionalidade nem nome de solução.",
    "- NÃO peça reunião, call, demonstração nem horário.",
    "- NÃO elogie a empresa.",
    "- Sem assinatura, sem despedida formal, sem emoji.",
    "- Tom de gente escrevendo, não de mala direta. Direto e educado.",
    "- Frases COMPLETAS, com preposições e pontuação natural. Nunca abrevie como telegrama: escreva \"nas clínicas de São Paulo\", não \"clínicas São Paulo\".",
    "- Comece a segunda frase em primeira pessoa (identifiquei/notei), não em voz passiva.",
    "",
    "Responda APENAS com o texto da mensagem.",
  ].join("\n");

  try {
    const res = await proxy.complete([
      {
        role: "system",
        content:
          "Você é SDR de pré-vendas B2B. No primeiro toque você só quer uma resposta: apresenta que existe um problema recorrente no segmento e pergunta se a empresa também sofre com ele, sem revelar qual é o problema e sem falar de produto.",
      },
      { role: "user", content: prompt },
    ], { timeoutMs: 10000, maxRetries: 1, caveman: false });

    let txt = res.content.trim().replace(/^["'`]+|["'`]+$/g, "");
    txt = txt.replace(/\n+(atenciosamente|abra[cç]os|att\.?|equipe .*)$/i, "").trim();
    // Garante o token: sem ele a saudação nunca é aplicada na listagem.
    if (!txt.includes(SAUDACAO_TOKEN)) txt = `${SAUDACAO_TOKEN}! ${txt}`;
    return txt;
  } catch (err) {
    console.warn("[Prospector Zenda] Fallback de abertura:", err.message);
    return fallbackOpener(lead, channel);
  }
}

// ---------- TOQUE 2: a dor, após a resposta ----------
async function generateFollowup(lead, channel = "whatsapp") {
  const lim = CHANNEL_LIMITS[channel] || CHANNEL_LIMITS.whatsapp;
  const dor = dorDoNicho(lead.category);

  const prompt = [
    "Escreva a SEGUNDA mensagem da abordagem. A empresa JÁ RESPONDEU à primeira, na qual você disse ter identificado um problema recorrente no segmento sem revelar qual.",
    "",
    `Empresa: ${lead.name} (${lead.category}, ${lead.city})`,
    `Canal: ${channel.toUpperCase()}`,
    "",
    "O PROBLEMA a revelar agora:",
    dor,
    "",
    `ESTRUTURA (${lim.linhas}, máximo ${lim.maxChars} caracteres):`,
    "1. Revele o problema em uma frase, como algo que você vê no segmento — não como acusação à empresa.",
    "2. Termine com UMA pergunta ABERTA sobre como eles lidam com isso hoje. Exige uma frase de resposta, nunca sim ou não.",
    "",
    "REGRAS:",
    "- NÃO cite produto, tecnologia, IA, funcionalidade nem solução. Ainda não é hora.",
    "- NÃO peça reunião nem demonstração.",
    "- NÃO repita saudação: a conversa já começou.",
    "- Sem assinatura e sem emoji.",
    "",
    "Responda APENAS com o texto.",
  ].join("\n");

  try {
    const res = await proxy.complete([
      {
        role: "system",
        content:
          "Você é SDR de pré-vendas B2B. A empresa respondeu ao seu primeiro contato. Agora você revela o problema e pergunta como eles lidam com isso, sem falar de produto e sem pedir reunião.",
      },
      { role: "user", content: prompt },
    ], { timeoutMs: 10000, maxRetries: 1, caveman: false });

    const txt = res.content.trim().replace(/^["'`]+|["'`]+$/g, "");
    return txt.replace(/\n+(atenciosamente|abra[cç]os|att\.?|equipe .*)$/i, "").trim();
  } catch (err) {
    console.warn("[Prospector Zenda] Fallback de follow-up:", err.message);
    return fallbackFollowup(lead, channel, dor);
  }
}

// Compat: quem chamava generateOutreachMessage recebe a ABERTURA (toque 1).
async function generateOutreachMessage(lead, channel = "whatsapp") {
  return generateOpener(lead, channel);
}

// ---------- Fallbacks (usados quando o LLM falha) ----------
function fallbackOpener(lead, channel = "whatsapp") {
  const regiao = String(lead.city || "").split(",")[0].trim();
  const segmento = pluralizarSegmento(lead.category);
  const nome = String(lead.name || "").split(/[-–|,]/)[0].trim();
  const onde = regiao ? `de ${regiao}` : "da região";
  return [
    `${SAUDACAO_TOKEN}! Estou entrando em contato porque identifiquei um problema que se repete nas ${segmento} ${onde}.`,
    `Antes de explicar: a ${nome} também passa por isso?`,
  ].join("\n\n");
}

function fallbackFollowup(lead, channel = "whatsapp", dor = null) {
  const d = dor || dorDoNicho(lead.category);
  const lim = CHANNEL_LIMITS[channel] || CHANNEL_LIMITS.whatsapp;
  const pergunta = "Como vocês lidam com isso hoje?";
  let msg = `É o seguinte: ${d}.` + "\n\n" + pergunta;
  if (msg.length > lim.maxChars) {
    const espaco = lim.maxChars - (pergunta.length + 20);
    const curta = d.length > espaco
      ? d.slice(0, Math.max(40, espaco)).replace(/[\s,;]+\S*$/, "") + "…"
      : d;
    msg = `É o seguinte: ${curta}.` + "\n\n" + pergunta;
  }
  return msg;
}


async function sendWhatsAppOutreach(phone, message) {
  if (!phone) return { ok: false, error: "Telefone ausente" };
  try {
    const evo = require("./channels/evolution/evolutionApi");
    const result = await evo.sendTextMessage(phone, message);

    // Não basta "não lançou". O cliente nativo (usado quando não há
    // EVOLUTION_API_URL) devolve { ok:false, error } quando o WhatsApp não
    // está pareado — e o código antigo embrulhava isso em { ok:true },
    // marcando o lead como enviado sem nada ter saído.
    if (result && result.ok === false) {
      return { ok: false, error: result.error || "canal recusou o envio" };
    }
    return { ok: true, result };
  } catch (err) {
    console.error("[Prospector Zenda] Erro ao enviar WhatsApp:", err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Envia ou prepara o disparo no Instagram DM.
 */
async function sendInstagramOutreach(instagramHandle, message) {
  if (!instagramHandle) return { ok: false, error: "Instagram handle ausente" };
  const cleanHandle = instagramHandle.replace(/^@/, "").trim();
  const directLink = `https://ig.me/m/${cleanHandle}`;
  try {
    extensionBridge.enqueueNow({
      type: "instagram_send_dm",
      params: { handle: cleanHandle, message }
    });
    return {
      ok: true,
      enqueued: true,
      directLink,
      handle: cleanHandle
    };
  } catch (err) {
    return { ok: false, error: err.message, directLink };
  }
}

/**
 * Salva ou atualiza um Lead com desduplicação rigorosa (SHA-256).
 */
// Colunas que a tabela REALMENTE tem, lidas do banco.
//
// Existem duas gerações de schema em circulação e o INSERT precisa servir as
// duas:
//   - Banco NOVO (o de produção): tem `name`/`category`/`city`. NÃO tem
//     `title`/`company`/`location` — o CREATE TABLE atual não as cria e a
//     migração não as adiciona.
//   - Banco LEGADO (do garimpo de vagas, anterior ao pivot): tem
//     `title`/`company`/`location` como NOT NULL sem default, e recebeu
//     `name`/`category`/`city` via ALTER.
//
// Um INSERT fixo quebra em um dos dois: citando as legadas explode no banco
// novo ("no such column: title" — causa do prospector ficar em 0 leads por
// dias); omitindo-as explode no legado (NOT NULL constraint failed).
let leadColumnsCache = null;
function leadColumns() {
  if (!leadColumnsCache) {
    leadColumnsCache = new Set(
      db.prepare("PRAGMA table_info('prospector_leads')").all().map((c) => c.name)
    );
  }
  return leadColumnsCache;
}

function upsertLead(leadData) {
  const cleanName = (leadData.name || '').trim();
  const cleanCity = (leadData.city || '').trim();
  const hash = crypto.createHash("sha256")
    .update(`${cleanName}_${cleanCity}_${leadData.category || ''}`.toLowerCase())
    .digest("hex").slice(0, 16);

  const existing = db.prepare("SELECT * FROM prospector_leads WHERE id = ?").get(hash);
  if (existing) return { lead: existing, isNew: false };

  const nameVal = cleanName || "Estabelecimento";
  const catVal = leadData.category || "Saúde / Estética";
  const cityVal = cleanCity || "São Paulo";

  // Canônicas + legadas espelhando o mesmo valor (title/company = name,
  // location = city), incluídas só se a coluna existir neste banco.
  const candidates = [
    ["id", hash],
    ["name", nameVal],
    ["category", catVal],
    ["city", cityVal],
    ["description", leadData.description || ""],
    ["contact_person", leadData.contact_person || null],
    ["phone", leadData.phone || null],
    ["instagram_handle", leadData.instagram_handle || null],
    ["email", leadData.email || null],
    ["cnpj", leadData.cnpj || null],
    ["website_url", leadData.website_url || null],
    ["source", leadData.source || "web"],
    ["status", "discovered"],
    ["title", nameVal],
    ["company", nameVal],
    ["location", cityVal],
  ];

  const cols = leadColumns();
  const present = candidates.filter(([col]) => cols.has(col));
  const names = present.map(([col]) => col);
  const values = present.map(([, val]) => val);

  db.prepare(
    `INSERT INTO prospector_leads (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})`
  ).run(...values);

  const lead = db.prepare("SELECT * FROM prospector_leads WHERE id = ?").get(hash);
  return { lead, isNew: true };
}

// Helper para extrair telefones e handles de Instagram de textos/snippets/websites
// ─────────────────────────────────────────────────────────────
// DDDs efetivamente atribuídos no Plano Nacional de Numeração.
const VALID_DDDS = new Set([
  "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "21", "22", "24", "27", "28",
  "31", "32", "33", "34", "35", "37", "38",
  "41", "42", "43", "44", "45", "46", "47", "48", "49",
  "51", "53", "54", "55",
  "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "71", "73", "74", "75", "77", "79",
  "81", "82", "83", "84", "85", "86", "87", "88", "89",
  "91", "92", "93", "94", "95", "96", "97", "98", "99",
]);

const DOMAIN_TLDS = /\.(com|br|io|net|org|co|app|dev|me|info|biz|gov|edu|tv|cc|ly|xyz|online|site|store|shop|blog)$/;

const IG_BLACKLIST = new Set([
  "p", "reel", "reels", "explore", "stories", "direct", "accounts", "login",
  "share", "terms", "privacy", "about", "cookies", "settings", "home",
  "username", "seu_instagram", "perfil", "exemplo", "yourusername",
  "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com"
]);

// E-mails que aparecem em rodapé de template/plataforma e não são da clínica.
const EMAIL_BLACKLIST_RE = /@(example|exemplo|dominio|seudominio|email|test|sentry|wixpress|godaddy|wordpress|squarespace|shopify)\.|noreply|no-reply|sac@|@sentry\./i;

// Valida os dígitos verificadores do CNPJ. Sem isso, qualquer sequência de 14
// dígitos (telefone concatenado, id de sessão, código de rastreio) entraria
// como CNPJ e sujaria a base com dado que parece estruturado e não é.
function isValidCnpj(d) {
  if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len) => {
    let sum = 0;
    let pos = len - 7;
    for (let i = 0; i < len; i++) {
      sum += Number(d[i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

// Páginas de agregador/diretório/SEO: aparecem em massa na busca e NÃO são
// estabelecimentos. Foram elas que produziram leads como "Agende suas
// consultas online", "Melhores Clínicas de Estética em São Paulo" e
// "Clinica Odontologica Rio De Janeiro" — títulos de página, não empresas.
const AGGREGATOR_DOMAINS = [
  "doctoralia", "boaconsulta", "docplanner", "guiadeconsultorios", "clinicas.com",
  "telemedicina", "consultaremedios", "minhavida", "tuasaude", "yelp", "tripadvisor",
  "reclameaqui", "solutudo", "apontador", "telelistas", "guiamais", "encontreseudentista",
  "quandoagendar", "agendarconsulta", "zenklub", "vittude", "gympass", "wellhub",
  "hospitaisbrasil", "catalogo", "guiaodonto", "achecomercio", "hagah",
];
const AGGREGATOR_TITLE_RE = /^(os |as )?\d*\s*(melhores|principais|top)\b|\b(lista|guia|ranking|diret[oó]rio|cat[aá]logo|compare|encontre|agende suas|agendamento online|marque sua|onde encontrar|classificados|comparar|ache|busque)\b|\b(pre[cç]os?|quanto custa|vale a pena|passo a passo)\b/i;

// Um título é página de categoria quando, tirando as palavras da própria
// consulta (categoria + cidade) e o preenchimento genérico, NÃO SOBRA nada que
// funcione como nome próprio.
//
// Trocado de heurística por contagem de palavras: "Prórir Clínica
// Odontológica" e "Clínica Estética&Luxo" tinham poucas palavras e eram
// rejeitados como se fossem categoria, mesmo tendo nome real. O que distingue
// não é o tamanho, é a sobra.
const FILLER_WORDS = new Set([
  "em", "de", "do", "da", "dos", "das", "no", "na", "e", "o", "a", "os", "as",
  "para", "por", "com", "sp", "rj", "mg", "pr", "sc", "rs", "brasil", "br",
  "melhor", "melhores", "online", "atendimento", "especializada", "especializado",
  "centro", "consultorio", "consultorios", "clinica", "clinicas", "dr", "dra",
]);

function deaccent(str) {
  return String(str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// singulariza de forma tosca só pra comparação (clinicas -> clinica)
function stem(w) {
  return w.endsWith("s") && w.length > 4 ? w.slice(0, -1) : w;
}

function tokens(str) {
  return deaccent(str)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(stem);
}

function looksLikeAggregator({ title, url, category, city }) {
  const t = String(title || "").trim();
  const u = String(url || "").toLowerCase();

  if (AGGREGATOR_DOMAINS.some((d) => u.includes(d))) return "domínio de agregador";
  if (AGGREGATOR_TITLE_RE.test(deaccent(t))) return "título de diretório/SEO";

  // Remove do título tudo que veio da consulta e o preenchimento genérico.
  const consulta = new Set([...tokens(category), ...tokens(city)]);
  const sobra = tokens(t).filter((w) => !consulta.has(w) && !FILLER_WORDS.has(w) && w.length >= 3);

  if (sobra.length === 0) {
    return "título é a própria categoria, sem nome do estabelecimento";
  }
  return null;
}

function extractContactsFromText(text) {
  const source = String(text || "");
  let phone = null;
  let instagram = null;

  // 1. Links diretos de WhatsApp (wa.me/55... ou api.whatsapp.com/send?phone=...)
  const waLinkMatch = source.match(/(?:wa\.me\/(?:55)?|api\.whatsapp\.com\/send\?(?:[^&]*&)?phone=(?:55)?|whatsapp\.com\/send\?(?:[^&]*&)?phone=(?:55)?)(\d{10,11})/i);
  if (waLinkMatch) {
    const rawNum = waLinkMatch[1];
    const ddd = rawNum.slice(0, 2);
    if (VALID_DDDS.has(ddd)) {
      const rest = rawNum.slice(2);
      if (rest.length === 9 && rest.startsWith("9")) {
        phone = `55${ddd}${rest}`;
      } else if (rest.length === 8) {
        phone = `55${ddd}9${rest}`;
      }
    }
  }

  // 2. Celular brasileiro com DDD no texto: (11) 98765-4321, 11 98765-4321, etc.
  if (!phone) {
    const phoneRegex = /(?:(?:\+|00)?55\s*)?(?:\(?([1-9][0-9])\)?\s*)(?:(9\s?[0-9]{4})[\s.-]?([0-9]{4}))/g;
    for (const m of source.matchAll(phoneRegex)) {
      const ddd = m[1];
      if (!VALID_DDDS.has(ddd)) continue;
      const part1 = m[2].replace(/\D/g, "");
      const part2 = m[3].replace(/\D/g, "");
      if (part1.length === 5 && part2.length === 4 && part1.startsWith("9")) {
        phone = `55${ddd}${part1}${part2}`;
        break;
      }
    }
  }

  // 3. Instagram: @handle ou instagram.com/handle
  // Varre um texto SEM os e-mails: o @ de um e-mail casava como handle e
  // trazia o dominio (noreply@sentry.io virava handle 'sentry.io'). Foi
  // assim que '@popular' entrou na base como se fosse perfil de clinica.
  const semEmails = source.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, " ");
  const igRegex = /(?:instagram\.com\/|@)([a-zA-Z0-9._]{3,30})/gi;
  for (const m of semEmails.matchAll(igRegex)) {
    // Pontuacao de fim de frase entrava no handle e quebrava o link ig.me
    // ('sorrisovivo.' em vez de 'sorrisovivo').
    const handle = m[1].toLowerCase().replace(/^[@._]+|[._\/]+$/g, "");
    if (handle.length < 3) continue;
    // Rejeita dominio por TLD conhecido, nao por sufixo generico: handle de
    // clinica brasileira usa sigla de estado no fim (clinicasorriso.sp), e um
    // filtro de 2+ letras descartava esses junto com .io/.com.
    if (DOMAIN_TLDS.test(handle)) continue;
    if (IG_BLACKLIST.has(handle)) continue;
    instagram = handle;
    break;
  }

  // 4. E-mail. Descarta os genéricos de plataforma/exemplo, que aparecem em
  // rodapé de template e não são contato da clínica.
  let email = null;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  for (const m of source.matchAll(emailRegex)) {
    const cand = m[0].toLowerCase();
    if (EMAIL_BLACKLIST_RE.test(cand)) continue;
    if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/.test(cand)) continue;
    email = cand;
    break;
  }

  // 5. CNPJ: 00.000.000/0000-00 ou 14 dígitos seguidos. Valida os dígitos
  // verificadores — número de 14 dígitos aparece em telefone concatenado,
  // código de rastreio e id de sessão, e aceitar sem validar sujaria a base.
  let cnpj = null;
  const cnpjRegex = /(\d{2}[.\s]?\d{3}[.\s]?\d{3}[\/\s]?\d{4}[-\s]?\d{2})/g;
  for (const m of source.matchAll(cnpjRegex)) {
    const digits = m[1].replace(/\D/g, "");
    if (digits.length === 14 && isValidCnpj(digits)) {
      cnpj = `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12)}`;
      break;
    }
  }

  return { phone, instagram, email, cnpj };
}

// Raspagem do site do estabelecimento caso não tenha contato direto no snippet do buscador
async function scrapeLeadWebsite(url) {
  if (!url || !/^https?:\/\//i.test(url)) return {};
  if (url.includes("instagram.com") || url.includes("facebook.com") || url.includes("linkedin.com") || url.includes("youtube.com")) {
    return {};
  }
  try {
    const base = (config.ROUTER_BASE_URL || "").replace(/\/v1$/, "").replace(/\/+$/, "");
    let text = "";
    try {
      const res = await fetch(`${base}/v1/web/fetch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${keyrotator.getKey()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "jina-reader", url, format: "markdown", max_characters: 15000 }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const data = await res.json();
        text = data.content?.text || "";
      }
    } catch {}

    if (!text) {
      const directRes = await fetch(`https://r.jina.ai/${url}`, { signal: AbortSignal.timeout(12000) });
      if (directRes.ok) text = await directRes.text();
    }

    if (text) {
      return extractContactsFromText(text.slice(0, 15000));
    }
  } catch (err) {
    console.warn(`[Prospector] Raspagem de website (${url}) falhou:`, err.message);
  }
  return {};
}

/**
 * Ciclo de Busca & Prospecção B2B de Clientes 24/7
 */
async function runCycle(onNotify) {
  const settings = getSettings();
  if (!settings.enabled) {
    console.log("[Prospector Zenda 24/7] Motor pausado nas configurações.");
    return { ok: false, reason: "disabled" };
  }

  const now = Date.now();
  db.prepare("UPDATE prospector_settings SET last_run = ? WHERE id = 'default'").run(now);

  console.log(`[Prospector Zenda 24/7] Minerando clientes para o Zenda: "${settings.target_keywords}" em "${settings.target_location}"`);

  let discoveredCount = 0;
  let outreachedCount = 0;
  let queuedCount = 0;   // enfileirados na extensão — entrega NÃO confirmada
  const discoveredLeads = [];
  const cycleErrors = [];
  const rejected = { aggregator: 0, noContact: 0 };
  const rejectedSamples = [];

  const categories = settings.target_keywords.split(",").map(s => s.trim()).filter(Boolean);
  const cities = settings.target_location.split(",").map(s => s.trim()).filter(Boolean);

  // 1. Busca ativa na Web e Google por estabelecimentos com WhatsApp / Instagram
  for (const cat of categories.slice(0, 3)) {
    for (const city of cities.slice(0, 2)) {
      try {
        const query = `${cat} ${city} whatsapp instagram agendamento`;
        const results = await webSearch.searchWeb(query, 5);

        for (const r of results) {
          // Descarta agregador/diretório ANTES de gastar raspagem e LLM neles.
          const aggReason = looksLikeAggregator({ title: r.title, url: r.url, category: cat, city });
          if (aggReason) {
            rejected.aggregator++;
            rejectedSamples.push(`${String(r.title).slice(0, 45)} (${aggReason})`);
            continue;
          }

          const combined = `${r.title} ${r.snippet || ''} ${r.url || ''}`;
          let contacts = extractContactsFromText(combined);

          // Raspa o site sempre que faltar QUALQUER dado de contato — antes só
          // raspava quando faltava telefone, então lead com telefone no snippet
          // nunca ganhava e-mail nem CNPJ, e o cadastro ficava pobre.
          const faltaDado = !contacts.phone || !contacts.email || !contacts.cnpj || !contacts.instagram;
          if (faltaDado && r.url && !r.url.includes("instagram.com")) {
            const siteContacts = await scrapeLeadWebsite(r.url);
            for (const k of ["phone", "instagram", "email", "cnpj"]) {
              if (!contacts[k] && siteContacts[k]) contacts[k] = siteContacts[k];
            }
          }

          // REGRA DE OURO: lead sem canal de contato não serve. Telefone,
          // Instagram ou e-mail — pelo menos um. Antes gravava qualquer
          // resultado, e 59 de 63 leads ficavam impossíveis de abordar.
          if (!contacts.phone && !contacts.instagram && !contacts.email) {
            rejected.noContact++;
            rejectedSamples.push(`${String(r.title).slice(0, 45)} (sem telefone, Instagram ou e-mail)`);
            continue;
          }

          // Limpa o nome da empresa removendo títulos e caracteres extras
          const cleanName = r.title
            .replace(/\s*[-–|].*$/, "")
            .replace(/\(@[a-zA-Z0-9._]+\)/g, "")
            .replace(/@\w+/g, "")
            .trim();

          const { lead, isNew } = upsertLead({
            name: cleanName || "Estabelecimento",
            category: cat,
            city: city,
            description: r.snippet || "",
            phone: contacts.phone,
            instagram_handle: contacts.instagram,
            email: contacts.email,
            cnpj: contacts.cnpj,
            website_url: r.url,
            source: "web"
          });

          if (isNew) {
            discoveredCount++;
            discoveredLeads.push(lead);
          }
        }
      } catch (err) {
        // Este catch já engoliu um bug de schema por dias: o INSERT falhava em
        // TODAS as combinações, o ciclo terminava com discovered=0, e o LLM que
        // lê esse retorno inventava "filtros exaustos / nicho restritivo" —
        // mandando trocar de nicho quando nada disso tinha relação. O erro
        // agora sobe no retorno, não só no log.
        console.error(`[Prospector Zenda] Erro ao buscar ${cat} em ${city}:`, err.message);
        cycleErrors.push(`${cat} em ${city}: ${err.message}`);
      }
    }
  }

  // 2. Geração de Abordagens de Venda com IA para os Novos Clientes
  for (const lead of discoveredLeads) {
    try {
      // Gera a sequência inteira: abertura (toque 1) e a dor (toque 2), que só
      // é enviada depois de a empresa responder. Guardar os dois juntos evita
      // depender de uma segunda chamada de LLM no momento em que o lead responde
      // — que é justamente quando não se pode travar esperando.
      const waDraft = await generateOpener(lead, "whatsapp");
      const igDraft = await generateOpener(lead, "instagram");
      const waFollow = await generateFollowup(lead, "whatsapp");
      const igFollow = await generateFollowup(lead, "instagram");

      const waOutreachId = db.prepare(`
        INSERT INTO prospector_outreach (lead_id, channel, message, followup_message, status)
        VALUES (?, 'whatsapp', ?, ?, 'draft')
      `).run(lead.id, waDraft, waFollow).lastInsertRowid;

      const igOutreachId = db.prepare(`
        INSERT INTO prospector_outreach (lead_id, channel, message, followup_message, status)
        VALUES (?, 'instagram', ?, ?, 'draft')
      `).run(lead.id, igDraft, igFollow).lastInsertRowid;

      // Disparo automático WhatsApp se habilitado
      if (settings.auto_send_wa && lead.phone) {
        const sendRes = await sendWhatsAppOutreach(lead.phone, waDraft);
        if (sendRes.ok) {
          outreachedCount++;
          db.prepare("UPDATE prospector_outreach SET status = 'sent', sent_at = unixepoch() WHERE id = ?").run(waOutreachId);
          db.prepare("UPDATE prospector_leads SET status = 'sent', updated_at = unixepoch() WHERE id = ?").run(lead.id);
        } else {
          db.prepare("UPDATE prospector_outreach SET status = 'failed', error = ? WHERE id = ?").run(sendRes.error, waOutreachId);
        }
      }

      // Disparo automático Instagram se habilitado
      if (settings.auto_send_ig && lead.instagram_handle) {
        const igRes = await sendInstagramOutreach(lead.instagram_handle, igDraft);
        // Instagram passa pela extensão do Chrome via enqueueNow, que só
        // ENFILEIRA — retorna na hora, sem esperar ninguém pegar o job. Se a
        // extensão não estiver rodando, o job expira no cleanup e nada é
        // entregue. Por isso o status aqui é 'queued', não 'sent': marcar
        // 'sent' produzia relatório de abordagens entregues sem nenhuma
        // mensagem ter saído, e sem como saber quais falharam.
        if (igRes.ok) {
          db.prepare("UPDATE prospector_outreach SET status = 'queued' WHERE id = ?").run(igOutreachId);
          db.prepare("UPDATE prospector_leads SET status = 'queued', updated_at = unixepoch() WHERE id = ?").run(lead.id);
          queuedCount++;
        } else {
          db.prepare("UPDATE prospector_outreach SET status = 'failed', error = ? WHERE id = ?").run(igRes.error || "falha ao enfileirar", igOutreachId);
        }
      }

      if (!settings.auto_send_wa && !settings.auto_send_ig) {
        db.prepare("UPDATE prospector_leads SET status = 'drafted', updated_at = unixepoch() WHERE id = ?").run(lead.id);
      }
    } catch (err) {
      console.warn(`[Prospector Zenda] Erro na abordagem do lead ${lead.name}:`, err.message);
    }
  }

  // Notificação via Telegram
  if (discoveredCount > 0 && onNotify) {
    const notifyText = `🏥 *Prospector Zenda:* Encontrei *${discoveredCount} novo(s) cliente(s) em potencial*!\n\n` +
      discoveredLeads.slice(0, 4).map(l => `• *${l.name}* (${l.category} - ${l.city})\n  Canal: ${l.phone ? `📱 ${l.phone}` : ''} ${l.instagram_handle ? `📸 @${l.instagram_handle}` : ''}`).join("\n") +
      `\n\n💬 *Abordagens comerciais de venda do Zenda geradas e prontas para envio.*`;
    try { await onNotify(notifyText); } catch {}
  }

  // Se nada foi descoberto E a camada de busca não conseguiu buscar, isso NÃO
  // é "0 leads / filtros exaustos" — é falha de infraestrutura. A distinção
  // importa porque quem lê esse retorno é um LLM: recebendo só `discovered: 0`
  // ele inventa explicação plausível ("nicho restritivo", "filtros exaustos")
  // e manda o usuário trocar de nicho por dias, enquanto a causa real era o
  // gateway de busca fora do ar.
  const fetchFailure = discoveredCount === 0 ? webSearch.getLastFetchFailure?.() : null;
  if (fetchFailure) {
    console.error(`[Prospector Zenda 24/7] ABORTADO por falha de infraestrutura: ${fetchFailure}`);
    return {
      ok: false,
      reason: "search_infrastructure_down",
      error: `A busca na web não funcionou — nenhum resultado foi obtido dos buscadores. NÃO é problema de nicho, cidade ou filtro: trocar esses parâmetros não vai resolver. Detalhe técnico: ${fetchFailure}`,
      discovered: 0,
      outreached: 0,
      leads: [],
    };
  }

  // Erro em TODAS as combinações com zero leads = falha técnica, não mercado.
  const combinations = Math.min(categories.length, 3) * Math.min(cities.length, 2);
  if (discoveredCount === 0 && cycleErrors.length >= combinations && combinations > 0) {
    return {
      ok: false,
      reason: "cycle_errors",
      error:
        `A busca encontrou resultados mas TODAS as ${cycleErrors.length} combinações falharam ao gravar. ` +
        `Isso é erro técnico (provavelmente schema do banco), NÃO é nicho, cidade nem filtro — ` +
        `trocar esses parâmetros não resolve. Erros: ${cycleErrors.slice(0, 3).join(" | ")}`,
      discovered: 0,
      outreached: 0,
      errors: cycleErrors,
      leads: [],
    };
  }

  // Espelha a listagem no Notion. Fail-open e require tardio: se o módulo ou o
  // Notion falharem, o ciclo já fez o trabalho dele e os leads continuam no
  // banco local com notion_page_id NULL — sobem na próxima rodada.
  let notionSync = null;
  try {
    const notionLeads = require("./notionLeads");
    if (notionLeads.isConfigured()) {
      notionSync = await notionLeads.syncPendingLeads({ limit: 25 });
    }
  } catch (err) {
    console.warn("[Prospector Zenda] sync com Notion falhou (não fatal):", err.message);
  }

  return {
    ok: true,
    discovered: discoveredCount,
    outreached: outreachedCount,
    queued: queuedCount,
    rejected,
    rejectedSamples: rejectedSamples.slice(0, 5),
    notion: notionSync,
    leads: discoveredLeads.map(l => ({ id: l.id, name: l.name, category: l.category, city: l.city, phone: l.phone, instagram: l.instagram_handle }))
  };
}

let timer = null;
let cycleInFlight = false;
let globalNotifier = null;

function start(notifyCallback) {
  if (notifyCallback) globalNotifier = notifyCallback;
  if (timer) return;

  const settings = getSettings();
  const intervalMs = (settings.interval_min || 15) * 60 * 1000;

  console.log(`[Prospector Zenda 24/7] Iniciado com intervalo de ${settings.interval_min} minutos.`);

  timer = setInterval(() => {
    if (cycleInFlight) {
      console.warn("[Prospector Zenda 24/7] Ciclo anterior em andamento, pulando.");
      return;
    }
    cycleInFlight = true;
    runCycle(globalNotifier)
      .catch(err => console.error("[Prospector Zenda 24/7] Erro no ciclo:", err.message))
      .finally(() => { cycleInFlight = false; });
  }, intervalMs);

  // Executa uma rodada 10s após o boot
  setTimeout(() => {
    if (!cycleInFlight) {
      cycleInFlight = true;
      runCycle(globalNotifier)
        .catch(err => console.error("[Prospector Zenda 24/7] Erro no boot inicial:", err.message))
        .finally(() => { cycleInFlight = false; });
    }
  }, 10_000);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log("[Prospector Zenda 24/7] Motor pausado.");
  }
}

/**
 * Dispara um ciclo imediato reaproveitando o notificador registrado no start().
 * O chamador do chat não tem acesso ao `globalNotifier`, e chamar runCycle()
 * sem argumento — como o comando /prospector run fazia — silenciava a
 * notificação de leads encontrados.
 */
function runCycleNow() {
  return runCycle(globalNotifier);
}

/**
 * Zera a base de prospecção para recomeçar as buscas do zero.
 * DESTRUTIVO: remove leads e abordagens (inclusive as já enviadas, cujo
 * histórico se perde). Confirmação é responsabilidade de quem chama.
 */
function resetProspection({ includeResearch = false } = {}) {
  const leads = db.prepare("SELECT COUNT(*) as n FROM prospector_leads").get().n;
  const outreach = db.prepare("SELECT COUNT(*) as n FROM prospector_outreach").get().n;
  let research = 0;

  db.prepare("DELETE FROM prospector_outreach").run();
  db.prepare("DELETE FROM prospector_leads").run();
  if (includeResearch) {
    research = db.prepare("SELECT COUNT(*) as n FROM prospector_market_research").get().n;
    db.prepare("DELETE FROM prospector_market_research").run();
  }

  console.log(`[Prospector] Base zerada: ${leads} lead(s), ${outreach} abordagem(ns), ${research} pesquisa(s).`);
  return { leads, outreach, research };
}

// Remove leads sem NENHUM canal de contato (telefone, Instagram ou e-mail).
//
// A regra de qualificacao impede que entrem daqui pra frente, mas nao removeu
// os que ja estavam: a base tinha ~59 de 63 impossiveis de abordar, inflando
// contagem e sujando a tabela do Notion.
//
// Por seguranca: NUNCA remove lead que tenha qualquer contato, e NUNCA remove
// lead cuja abordagem ja foi enviada (status sent/queued) — mesmo sem contato
// registrado, ali houve interacao real que nao se joga fora.
function purgeLeadsWithoutContact({ dryRun = false } = {}) {
  const cond = `(phone IS NULL OR phone = '')
      AND (instagram_handle IS NULL OR instagram_handle = '')
      AND (email IS NULL OR email = '')
      AND id NOT IN (SELECT DISTINCT lead_id FROM prospector_outreach WHERE status IN ('sent','queued'))`;

  const antes = db.prepare('SELECT COUNT(*) n FROM prospector_leads').get().n;
  const alvo = db.prepare(`SELECT id, name FROM prospector_leads WHERE ${cond}`).all();
  const comContato = antes - alvo.length;

  if (dryRun) {
    return { dryRun: true, total: antes, removeriam: alvo.length, ficam: comContato, exemplos: alvo.slice(0, 5).map((l) => l.name) };
  }

  let abordagens = 0;
  const tx = db.transaction(() => {
    for (const l of alvo) {
      abordagens += db.prepare('DELETE FROM prospector_outreach WHERE lead_id = ?').run(l.id).changes;
      db.prepare('DELETE FROM prospector_leads WHERE id = ?').run(l.id);
    }
  });
  tx();

  const depois = db.prepare('SELECT COUNT(*) n FROM prospector_leads').get().n;
  console.log(`[Prospector] Limpeza: ${alvo.length} lead(s) sem contato removidos (${abordagens} rascunho[s]). Base: ${antes} -> ${depois}.`);
  return { removidos: alvo.length, abordagens, antes, depois, exemplos: alvo.slice(0, 5).map((l) => l.name) };
}

// Regera as abordagens ainda em rascunho com o prompt atual.
//
// Os rascunhos antigos sairam do prompt que despejava funcionalidade e pedia
// demonstracao de 5 minutos. Reaproveita-los seria enviar justamente o texto
// que motivou a reescrita.
//
// So toca status 'draft': o que ja foi enviado fica como registro historico.
async function regenerateDrafts({ limit = 30 } = {}) {
  const alvo = db.prepare(`
    SELECT o.id AS outreach_id, o.channel, l.*
    FROM prospector_outreach o JOIN prospector_leads l ON l.id = o.lead_id
    WHERE o.status = 'draft'
    ORDER BY l.created_at DESC LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 30, 1), 200));

  let regerados = 0;
  const falhas = [];
  for (const row of alvo) {
    try {
      // Regera a SEQUENCIA inteira: abertura e o toque 2. Regerar so a abertura
      // deixaria um follow-up antigo (com texto de produto) esperando para ser
      // enviado logo depois do texto novo.
      const msg = await generateOpener(row, row.channel);
      if (!msg || msg.length < 20) { falhas.push(`${row.name}: texto vazio`); continue; }
      const follow = await generateFollowup(row, row.channel);
      db.prepare('UPDATE prospector_outreach SET message = ?, followup_message = ? WHERE id = ?').run(msg, follow, row.outreach_id);
      regerados++;
    } catch (err) {
      falhas.push(`${row.name}: ${err.message}`);
    }
  }

  console.log(`[Prospector] ${regerados} rascunho(s) regerados, ${falhas.length} falha(s).`);
  return { regerados, falhas: falhas.length, detalhes: falhas.slice(0, 3), candidatos: alvo.length };
}

function getStats() {
  const totalLeads = db.prepare("SELECT COUNT(*) as n FROM prospector_leads").get().n;
  const sentOutreach = db.prepare("SELECT COUNT(*) as n FROM prospector_outreach WHERE status = 'sent'").get().n;
  const draftedOutreach = db.prepare("SELECT COUNT(*) as n FROM prospector_outreach WHERE status = 'draft'").get().n;
  const settings = getSettings();

  return {
    running: !!timer,
    settings,
    totalLeads,
    sentOutreach,
    draftedOutreach
  };
}

function listLeads(limit = 50) {
  const rows = db.prepare(`
    SELECT l.*, 
           (SELECT message FROM prospector_outreach WHERE lead_id = l.id AND channel = 'whatsapp' ORDER BY id DESC LIMIT 1) as wa_message,
           (SELECT message FROM prospector_outreach WHERE lead_id = l.id AND channel = 'instagram' ORDER BY id DESC LIMIT 1) as ig_message
    FROM prospector_leads l
    ORDER BY l.created_at DESC
    LIMIT ?
  `).all(limit);
  return rows;
}

module.exports = {
  start,
  stop,
  runCycle,
  runCycleNow,
  resetProspection,
  purgeLeadsWithoutContact,
  regenerateDrafts,
  getSettings,
  updateSettings,
  getStats,
  listLeads,
  generateOutreachMessage,
  generateOpener,
  generateFollowup,
  aplicarSaudacao,
  saudacaoAgora,
  sendWhatsAppOutreach,
  sendInstagramOutreach,
  upsertLead,
  extractContactsFromText,
  addProduct,
  getProduct,
  listProducts,
  setActiveProduct,
  researchMarketAvatar,
};
