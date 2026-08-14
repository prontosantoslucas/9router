// Motor Autônomo 24/7 de Busca e Prospecção de Vagas, Clientes & Recrutadores
// Executa buscas contínuas, analisa com IA, gera abordagens e despacha via WhatsApp e Instagram DM.

const crypto = require("node:crypto");
const db = require("./db");
const proxy = require("./proxy");
const { runJobHunt } = require("./tools/linkedinJobHunt");
const webSearch = require("./tools/webSearch");
const extensionBridge = require("./extensionBridge");

// Schema SQLite para Leads, Configurações e Disparos
db.exec(`
  CREATE TABLE IF NOT EXISTS prospector_settings (
    id TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1,
    interval_min INTEGER NOT NULL DEFAULT 15,
    auto_send_wa INTEGER NOT NULL DEFAULT 1,
    auto_send_ig INTEGER NOT NULL DEFAULT 1,
    target_keywords TEXT NOT NULL DEFAULT 'Desenvolvedor, Tech Lead, IA, Full Stack',
    target_location TEXT NOT NULL DEFAULT 'São Paulo, Brasil, Remoto',
    custom_pitch TEXT DEFAULT '',
    last_run INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS prospector_leads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT,
    contact_name TEXT,
    phone TEXT,
    instagram_handle TEXT,
    linkedin_url TEXT,
    source TEXT NOT NULL DEFAULT 'linkedin',
    salary TEXT,
    match_score INTEGER DEFAULT 85,
    status TEXT NOT NULL DEFAULT 'discovered', -- discovered | drafted | sent | replied | rejected
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

  CREATE INDEX IF NOT EXISTS idx_prospector_leads_status ON prospector_leads(status, created_at);
  CREATE INDEX IF NOT EXISTS idx_prospector_outreach_lead ON prospector_outreach(lead_id, channel);
`);

// Garante configuração padrão inicial
const defaultSettings = db.prepare("SELECT * FROM prospector_settings WHERE id = 'default'").get();
if (!defaultSettings) {
  db.prepare(`
    INSERT INTO prospector_settings (id, enabled, interval_min, auto_send_wa, auto_send_ig, target_keywords, target_location)
    VALUES ('default', 1, 15, 1, 1, 'Desenvolvedor, Tech Lead, IA, Automação, Full Stack', 'Brasil, São Paulo, Remoto')
  `).run();
}

function getSettings() {
  const row = db.prepare("SELECT * FROM prospector_settings WHERE id = 'default'").get();
  return row || {
    enabled: 1,
    interval_min: 15,
    auto_send_wa: 1,
    auto_send_ig: 1,
    target_keywords: 'Desenvolvedor, Tech Lead, IA, Automação, Full Stack',
    target_location: 'Brasil, São Paulo, Remoto',
    last_run: 0
  };
}

function updateSettings(settings) {
  const current = getSettings();
  const next = { ...current, ...settings };
  db.prepare(`
    UPDATE prospector_settings
    SET enabled = ?, interval_min = ?, auto_send_wa = ?, auto_send_ig = ?,
        target_keywords = ?, target_location = ?, custom_pitch = ?
    WHERE id = 'default'
  `).run(
    next.enabled ? 1 : 0,
    Math.max(1, parseInt(next.interval_min) || 15),
    next.auto_send_wa ? 1 : 0,
    next.auto_send_ig ? 1 : 0,
    next.target_keywords || '',
    next.target_location || '',
    next.custom_pitch || ''
  );
  return getSettings();
}

/**
 * Gera mensagem de abordagem altamente persuasiva usando IA (LLM).
 */
async function generateOutreachMessage(lead, channel = "whatsapp") {
  const settings = getSettings();
  const prompt = `Você é o redator comercial de elite de Lucas Santos (Especialista em IA, Automações e Desenvolvimento Full Stack).
Escreva uma mensagem de abordagem curta, natural, profissional e direta para a vaga/empresa abaixo:

Vaga/Cargo: ${lead.title}
Empresa: ${lead.company}
Localização: ${lead.location}
Fonte: ${lead.source}
Canal de Envio: ${channel.toUpperCase()} (WhatsApp ou Instagram DM)
${settings.custom_pitch ? `Diferencial Customizado: ${settings.custom_pitch}` : ''}

Instruções:
- Seja direto, educado e focado em gerar interesse para uma rápida conversa/entrevista.
- Mostre alinhamento imediato com as necessidades da vaga.
- Não seja prolixo. Máximo de 3 a 4 parágrafos curtos.
- No final, convide para um papo de 5 minutos ou envio do portfólio completo.
- Retorne APENAS o texto puro da mensagem, sem aspas nem explicações extras.`;

  try {
    const res = await proxy.complete([
      { role: "system", content: "Você é um copywriter executivo B2B focado em prospecção de vagas e clientes." },
      { role: "user", content: prompt }
    ], { timeoutMs: 10000, maxRetries: 1 });
    return res.content.trim();
  } catch (err) {
    console.warn("[Prospector] Falha ao gerar pitch com IA, usando fallback dinâmico:", err.message);
    if (channel === "whatsapp") {
      return `Olá! 👋 Vi a oportunidade para ${lead.title} na ${lead.company}. Tenho ampla experiência com desenvolvimento Full Stack, Inteligência Artificial e automações escaláveis. Gostaria de saber mais sobre os desafios do time e apresentar como posso agregar de imediato. Podemos agendar uma rápida conversa de 5 minutos nesta semana?`;
    }
    return `Olá! 👋 Acompanho o crescimento da ${lead.company} e vi a oportunidade para ${lead.title}. Atuo com desenvolvimento de software de alta performance e IA. Gostaria de apresentar meu portfólio para a posição. Como está o processo seletivo de vocês?`;
  }
}

/**
 * Dispara a mensagem de abordagem via WhatsApp.
 */
async function sendWhatsAppOutreach(phone, message) {
  if (!phone) return { ok: false, error: "Telefone ausente" };
  try {
    const evo = require("./channels/evolution/evolutionApi");
    const result = await evo.sendTextMessage(phone, message);
    return { ok: true, result };
  } catch (err) {
    console.error("[Prospector] Erro ao enviar WhatsApp:", err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Dispara ou agenda o envio via Instagram DM.
 */
async function sendInstagramOutreach(instagramHandle, message) {
  if (!instagramHandle) return { ok: false, error: "Instagram handle ausente" };
  const cleanHandle = instagramHandle.replace(/^@/, "").trim();
  try {
    // 1. Enfileira para a extensão Chrome se disponível
    extensionBridge.enqueueNow({
      type: "instagram_send_dm",
      params: { handle: cleanHandle, message }
    });
    return {
      ok: true,
      enqueued: true,
      directLink: `https://ig.me/m/${cleanHandle}`,
      handle: cleanHandle
    };
  } catch (err) {
    return { ok: false, error: err.message, directLink: `https://ig.me/m/${cleanHandle}` };
  }
}

/**
 * Salva ou atualiza um Lead com desduplicação estrita.
 */
function upsertLead(leadData) {
  const hash = crypto.createHash("sha256")
    .update(`${leadData.title}_${leadData.company}_${leadData.location || ''}`.toLowerCase())
    .digest("hex").slice(0, 16);

  const existing = db.prepare("SELECT * FROM prospector_leads WHERE id = ?").get(hash);
  if (existing) return { lead: existing, isNew: false };

  db.prepare(`
    INSERT INTO prospector_leads (
      id, title, company, location, description, contact_name, phone, instagram_handle, linkedin_url, source, salary, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'discovered')
  `).run(
    hash,
    leadData.title || "Vaga / Oportunidade",
    leadData.company || "Empresa Confidencial",
    leadData.location || "Remoto",
    leadData.description || "",
    leadData.contact_name || null,
    leadData.phone || null,
    leadData.instagram_handle || null,
    leadData.linkedin_url || null,
    leadData.source || "web",
    leadData.salary || null
  );

  const lead = db.prepare("SELECT * FROM prospector_leads WHERE id = ?").get(hash);
  return { lead, isNew: true };
}

/**
 * Ciclo de Busca & Prospecção Automática 24/7
 */
async function runCycle(onNotify) {
  const settings = getSettings();
  if (!settings.enabled) {
    console.log("[Prospector 24/7] Motor pausado nas configurações.");
    return { ok: false, reason: "disabled" };
  }

  const now = Date.now();
  db.prepare("UPDATE prospector_settings SET last_run = ? WHERE id = 'default'").run(now);

  console.log(`[Prospector 24/7] Iniciando busca contínua para: "${settings.target_keywords}" em "${settings.target_location}"`);

  let discoveredCount = 0;
  let outreachedCount = 0;
  const discoveredLeads = [];

  // 1. Busca no LinkedIn e plataformas parceiras (RemoteOK, Arbeitnow)
  try {
    const rawJobs = await runJobHunt({
      keywords_override: settings.target_keywords,
      location_override: settings.target_location
    });

    if (rawJobs && rawJobs.items && rawJobs.items.length > 0) {
      for (const item of rawJobs.items) {
        const title = item.title || item.role || item.job_title;
        const company = item.company || "Empresa";
        if (!title) continue;

        const { lead, isNew } = upsertLead({
          title,
          company,
          location: item.location || settings.target_location,
          description: item.description || item.snippet || item.block || "",
          linkedin_url: item.url || item.link || null,
          source: "linkedin"
        });

        if (isNew) {
          discoveredCount++;
          discoveredLeads.push(lead);
        }
      }
    }
  } catch (err) {
    console.warn("[Prospector] Falha na busca LinkedIn:", err.message);
  }

  // 2. Busca na Web por empresas e oportunidades adicionais
  try {
    const webQuery = `vagas ${settings.target_keywords} contratação ${settings.target_location}`;
    const webResults = await webSearch.searchWeb(webQuery, 6);
    for (const res of webResults) {
      const { lead, isNew } = upsertLead({
        title: res.title,
        company: "Oportunidade Web",
        location: settings.target_location,
        description: res.snippet || "",
        linkedin_url: res.url,
        source: "web"
      });
      if (isNew) {
        discoveredCount++;
        discoveredLeads.push(lead);
      }
    }
  } catch (err) {
    console.warn("[Prospector] Falha na busca Web:", err.message);
  }

  // 3. Processamento de Abordagem com IA e Disparo
  for (const lead of discoveredLeads) {
    try {
      // Gera mensagem de abordagem personalizada
      const waDraft = await generateOutreachMessage(lead, "whatsapp");
      const igDraft = await generateOutreachMessage(lead, "instagram");

      // Salva rascunho de WhatsApp
      const waOutreachId = db.prepare(`
        INSERT INTO prospector_outreach (lead_id, channel, message, status)
        VALUES (?, 'whatsapp', ?, 'draft')
      `).run(lead.id, waDraft).lastInsertRowid;

      // Salva rascunho de Instagram
      const igOutreachId = db.prepare(`
        INSERT INTO prospector_outreach (lead_id, channel, message, status)
        VALUES (?, 'instagram', ?, 'draft')
      `).run(lead.id, igDraft).lastInsertRowid;

      // Disparo automático WhatsApp se configurado e telefone presente
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

      // Disparo automático Instagram se configurado e perfil presente
      if (settings.auto_send_ig && lead.instagram_handle) {
        const igRes = await sendInstagramOutreach(lead.instagram_handle, igDraft);
        if (igRes.ok) {
          outreachedCount++;
          db.prepare("UPDATE prospector_outreach SET status = 'sent', sent_at = unixepoch() WHERE id = ?").run(igOutreachId);
          db.prepare("UPDATE prospector_leads SET status = 'sent', updated_at = unixepoch() WHERE id = ?").run(lead.id);
        }
      }

      if (!lead.phone && !lead.instagram_handle) {
        db.prepare("UPDATE prospector_leads SET status = 'drafted', updated_at = unixepoch() WHERE id = ?").run(lead.id);
      }
    } catch (err) {
      console.warn(`[Prospector] Erro ao processar abordagem do lead ${lead.id}:`, err.message);
    }
  }

  // Notificação via Telegram / Callback
  if (discoveredCount > 0 && onNotify) {
    const notifyText = `🎯 *Prospector 24/7:* Encontrei *${discoveredCount} nova(s) oportunidade(s)*!\n` +
      discoveredLeads.slice(0, 3).map(l => `• *${l.title}* na _${l.company}_ (${l.location})`).join("\n") +
      `\n\n💬 *Abordagens geradas por IA prontas para envio via WhatsApp e Instagram DM.*`;
    try { await onNotify(notifyText); } catch {}
  }

  return {
    ok: true,
    discovered: discoveredCount,
    outreached: outreachedCount,
    leads: discoveredLeads.map(l => ({ id: l.id, title: l.title, company: l.company }))
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

  console.log(`[Prospector 24/7] Iniciado com intervalo de ${settings.interval_min} minutos.`);

  timer = setInterval(() => {
    if (cycleInFlight) {
      console.warn("[Prospector 24/7] Ciclo anterior ainda em execução, pulando tick.");
      return;
    }
    cycleInFlight = true;
    runCycle(globalNotifier)
      .catch(err => console.error("[Prospector 24/7] Erro no ciclo:", err.message))
      .finally(() => { cycleInFlight = false; });
  }, intervalMs);

  // Executa uma rodada 10 segundos após o boot
  setTimeout(() => {
    if (!cycleInFlight) {
      cycleInFlight = true;
      runCycle(globalNotifier)
        .catch(err => console.error("[Prospector 24/7] Erro no boot inicial:", err.message))
        .finally(() => { cycleInFlight = false; });
    }
  }, 10_000);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log("[Prospector 24/7] Motor pausado.");
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
  upsertLead
};
