// Motor Autônomo 24/7 de Prospecção B2B de Clientes para o Zenda AI
// Busca clínicas, consultórios e empresas na Web/Google/Instagram, gera abordagens persuasivas com IA
// e gerencia envios via WhatsApp, Instagram DM e Fila de Rascunhos.

const crypto = require("node:crypto");
const db = require("./db");
const proxy = require("./proxy");
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
    website_url TEXT,
    source TEXT NOT NULL DEFAULT 'web', -- web | maps | instagram | linkedin
    status TEXT NOT NULL DEFAULT 'discovered', -- discovered | drafted | sent | replied | scheduled | closed | rejected
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS prospector_outreach (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT NOT NULL,
    channel TEXT NOT NULL, -- whatsapp | instagram | linkedin
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', -- draft | pending | sent | delivered | failed
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

  let dossier = "";
  try {
    const res = await proxy.complete([
      { role: "system", content: "Você é um diretor de Go-To-Market e inteligência de mercado B2B." },
      { role: "user", content: prompt },
    ], { timeoutMs: 15000, maxRetries: 1 });
    dossier = res.content.trim();
  } catch (err) {
    dossier = `### Dossiê de Avatar para ${targetNiche} (${prodName})\n\n**ICP:** Donos e gestores de ${targetNiche}.\n**Dores:** Perda de agendamentos no WhatsApp, sobrecarga da recepção, falta de atendimento 24/7.\n**Proposta de Valor:** Agente IA 24/7 integrado ao Google Calendar para agendamento automático.`;
  }

  // Salva no banco de dados
  db.prepare(`
    INSERT INTO prospector_market_research (product_id, niche, avatar_title, pain_points, objections, hooks, full_dossier)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    settings.active_product_id || 'zenda-ai',
    targetNiche,
    `Avatar ${targetNiche}`,
    'Perda de pacientes fora do horário, sobrecarga da recepção, no-show',
    'Já tenho recepcionista, medo de IA parecer robô',
    'Aumento imediato de consultas e atendimento 24h sem custo fixo de pessoal',
    dossier
  );

  return {
    niche: targetNiche,
    product: prodName,
    dossier,
  };
}

/**
 * Gera mensagem comercial B2B altamente persuasiva para vender o Zenda AI.
 */
async function generateOutreachMessage(lead, channel = "whatsapp") {
  const settings = getSettings();
  const prompt = `Você é o especialista comercial de vendas do ${settings.product_name} (Plataforma de IA e Agente de Atendimento 24/7 via WhatsApp e Google Calendar para clínicas e consultórios).
Escreva uma mensagem comercial de abordagem fria (outreach B2B) curta, natural, educada e de alta conversão para o potencial cliente abaixo:

Nome do Estabelecimento: ${lead.name}
Nicho/Especialidade: ${lead.category}
Cidade/Região: ${lead.city}
Responsável/Doutor(a): ${lead.contact_person || 'Doutor(a) / Gestor(a)'}
Canal de Envio: ${channel.toUpperCase()} (WhatsApp ou Instagram DM)
${settings.custom_pitch ? `Diferencial Customizado: ${settings.custom_pitch}` : ''}

Proposta de Valor do Zenda AI:
- Atendimento 24h por dia, 7 dias por semana no WhatsApp da clínica sem deixar paciente esperando.
- Tira dúvidas de preços, procedimentos, convênios e horários.
- Realiza agendamentos automáticos sincronizados diretamente com a agenda do Google Calendar da clínica.
- Aumenta a captação e reduz o no-show sem sobrecarregar a secretária/recepção.

Instruções:
- Tom profissional, simpático e respeitoso.
- Máximo de 3 a 4 parágrafos curtos.
- Convide para uma demonstração rápida de 5 minutos nesta semana.
- Retorne APENAS o texto pronto para envio, sem introduções ou aspas.`;

  try {
    const res = await proxy.complete([
      { role: "system", content: "Você é um especialista em vendas B2B de SaaS de IA para clínicas de saúde e estética." },
      { role: "user", content: prompt }
    ], { timeoutMs: 10000, maxRetries: 1 });
    return res.content.trim();
  } catch (err) {
    console.warn("[Prospector Zenda] Fallback de pitch comercial:", err.message);
    if (channel === "whatsapp") {
      return `Olá, equipe da ${lead.name}! 👋\n\nAcompanho o trabalho de excelência que vocês realizam em ${lead.category} em ${lead.city}.\n\nEstou entrando em contato para apresentar o ${settings.product_name} — nosso Agente de Atendimento 24/7 com Inteligência Artificial para WhatsApp, integrado diretamente à agenda do consultório.\n\nO Zenda responde pacientes na hora, esclarece dúvidas sobre procedimentos e agenda consultas no Google Calendar automaticamente, aumentando o faturamento sem sobrecarregar sua recepção.\n\nPodemos agendar uma breve demonstração de 5 minutos nesta semana para eu te mostrar como funciona na prática?\n\nAtenciosamente,\nEquipe ${settings.product_name}`;
    }
    return `Olá, ${lead.name}! 👋 Parabéns pelo trabalho e conteúdo em ${lead.category}!\n\nDesenvolvemos o ${settings.product_name}, um Agente de IA para WhatsApp que atende seus pacientes 24/7 e agenda consultas de forma 100% automática.\n\nPodemos te apresentar uma demonstração rápida de 5 min?`;
  }
}

/**
 * Dispara a mensagem via WhatsApp (Evolution API / Baileys).
 */
async function sendWhatsAppOutreach(phone, message) {
  if (!phone) return { ok: false, error: "Telefone ausente" };
  try {
    const evo = require("./channels/evolution/evolutionApi");
    const result = await evo.sendTextMessage(phone, message);
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

  db.prepare(`
    INSERT INTO prospector_leads (
      id, title, company, name, category, city, location, description, contact_person, phone, instagram_handle, website_url, source, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'discovered')
  `).run(
    hash,
    nameVal,
    nameVal,
    nameVal,
    catVal,
    cityVal,
    cityVal,
    leadData.description || "",
    leadData.contact_person || null,
    leadData.phone || null,
    leadData.instagram_handle || null,
    leadData.website_url || null,
    leadData.source || "web"
  );

  const lead = db.prepare("SELECT * FROM prospector_leads WHERE id = ?").get(hash);
  return { lead, isNew: true };
}

// Helper para extrair telefones e handles de Instagram de textos/snippets
function extractContactsFromText(text) {
  let phone = null;
  let instagram = null;

  // Regex para WhatsApp brasileiro: (11) 98888-7777, 11988887777, +55 11 9...
  const phoneMatch = text.match(/(?:\+?55\s?)?(?:\(?([1-9]{2})\)?\s?)?(?:9\s?)?([0-9]{4})[\s.-]?([0-9]{4})/);
  if (phoneMatch) {
    const ddd = phoneMatch[1] || '11';
    const digits = `${phoneMatch[2]}${phoneMatch[3]}`;
    phone = `55${ddd}9${digits}`;
  }

  // Regex para Instagram: @handle ou instagram.com/handle
  const igMatch = text.match(/(?:@|instagram\.com\/)([a-zA-Z0-9._]{3,30})/i);
  if (igMatch && !['p', 'reel', 'explore', 'stories'].includes(igMatch[1].toLowerCase())) {
    instagram = igMatch[1].toLowerCase();
  }

  return { phone, instagram };
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
  const discoveredLeads = [];

  const categories = settings.target_keywords.split(",").map(s => s.trim()).filter(Boolean);
  const cities = settings.target_location.split(",").map(s => s.trim()).filter(Boolean);

  // 1. Busca ativa na Web e Google por estabelecimentos com WhatsApp / Instagram
  for (const cat of categories.slice(0, 3)) {
    for (const city of cities.slice(0, 2)) {
      try {
        const query = `${cat} "${city}" whatsapp agendamento instagram`;
        const results = await webSearch.searchWeb(query, 5);

        for (const r of results) {
          const combined = `${r.title} ${r.snippet || ''}`;
          const contacts = extractContactsFromText(combined);

          // Limpa o nome da empresa
          const cleanName = r.title.replace(/\s*[-–|].*$/, "").trim();

          const { lead, isNew } = upsertLead({
            name: cleanName,
            category: cat,
            city: city,
            description: r.snippet || "",
            phone: contacts.phone,
            instagram_handle: contacts.instagram,
            website_url: r.url,
            source: "web"
          });

          if (isNew) {
            discoveredCount++;
            discoveredLeads.push(lead);
          }
        }
      } catch (err) {
        console.warn(`[Prospector Zenda] Erro ao buscar ${cat} em ${city}:`, err.message);
      }
    }
  }

  // 2. Geração de Abordagens de Venda com IA para os Novos Clientes
  for (const lead of discoveredLeads) {
    try {
      const waDraft = await generateOutreachMessage(lead, "whatsapp");
      const igDraft = await generateOutreachMessage(lead, "instagram");

      const waOutreachId = db.prepare(`
        INSERT INTO prospector_outreach (lead_id, channel, message, status)
        VALUES (?, 'whatsapp', ?, 'draft')
      `).run(lead.id, waDraft).lastInsertRowid;

      const igOutreachId = db.prepare(`
        INSERT INTO prospector_outreach (lead_id, channel, message, status)
        VALUES (?, 'instagram', ?, 'draft')
      `).run(lead.id, igDraft).lastInsertRowid;

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
        if (igRes.ok) {
          outreachedCount++;
          db.prepare("UPDATE prospector_outreach SET status = 'sent', sent_at = unixepoch() WHERE id = ?").run(igOutreachId);
          db.prepare("UPDATE prospector_leads SET status = 'sent', updated_at = unixepoch() WHERE id = ?").run(lead.id);
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

  return {
    ok: true,
    discovered: discoveredCount,
    outreached: outreachedCount,
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
  getSettings,
  updateSettings,
  getStats,
  listLeads,
  generateOutreachMessage,
  sendWhatsAppOutreach,
  sendInstagramOutreach,
  upsertLead,
  addProduct,
  getProduct,
  listProducts,
  setActiveProduct,
  researchMarketAvatar,
};
