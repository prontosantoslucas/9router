// Sincroniza a listagem de leads do prospector para um banco do Notion.
//
// Por que um módulo separado do notion.js: o `createPage` de lá é orientado a
// nota (título + corpo + Fonte/Criado/Categoria/Tags). Lead precisa de campo
// TIPADO — telefone, cidade, status — senão a "listagem" não é filtrável nem
// ordenável no Notion, que é justamente o motivo de existir.
//
// Contrato: fail-open. Notion fora do ar, token errado ou schema divergente
// nunca podem derrubar o ciclo de prospecção. Qualquer falha volta em
// { ok:false } e o lead fica pendente pra próxima rodada.

const config = require("./config");
const db = require("./db");
const notion = require("./notion");

const NOTION_API = "https://api.notion.com/v1";

// Propriedades que o sync sabe preencher. `kind` é o tipo PREFERIDO; se o banco
// do usuário declarar outro tipo compatível, `setProp` adapta em vez de falhar
// — o banco é dele, pode ter sido criado à mão com tipos diferentes.
const LEAD_PROPS = [
  { name: "Telefone",  kind: "phone_number", from: (l) => l.phone },
  { name: "Instagram", kind: "url",          from: (l) => (l.instagram_handle ? `https://instagram.com/${String(l.instagram_handle).replace(/^@/, "")}` : null) },
  { name: "Site",      kind: "url",          from: (l) => l.website_url },
  { name: "Cidade",    kind: "select",       from: (l) => l.city },
  { name: "Nicho",     kind: "select",       from: (l) => l.category },
  { name: "Status",    kind: "select",       from: (l) => l.status || "discovered" },
  { name: "Origem",    kind: "select",       from: (l) => l.source || "web" },
  { name: "Data",      kind: "date",         from: () => new Date().toISOString() },
];

// Tipos esperados por propriedade, usados tanto para CRIAR o banco quanto para
// completar um banco existente que o usuário indicou.
const LEAD_SCHEMA = {
  Telefone:  { phone_number: {} },
  Instagram: { url: {} },
  Site:      { url: {} },
  Cidade:    { select: {} },
  Nicho:     { select: {} },
  Status:    { select: {} },
  Origem:    { select: {} },
  Data:      { date: {} },
};

// Aceita ID cru, com hífens, ou URL colada do Notion.
// A URL de um BANCO tem `?v=<viewId>`; a de uma página não. O id fica no
// último segmento do path, com 32 hex (com ou sem hífen).
function normalizeNotionId(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const withoutQuery = raw.split("?")[0];
  const lastSeg = withoutQuery.split("/").filter(Boolean).pop() || "";
  const hex = (lastSeg.match(/[0-9a-fA-F]{32}/) || raw.match(/[0-9a-fA-F]{32}/) || [])[0]
    || lastSeg.replace(/-/g, "").match(/^[0-9a-fA-F]{32}$/)?.[0];
  if (!hex) return null;
  const h = hex.toLowerCase();
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

function isDatabaseUrl(input) {
  return /[?&]v=/.test(String(input || ""));
}

// Completa um banco que já existe com as propriedades de lead que faltam.
// Existe porque o sync ignora propriedade ausente em silêncio — apontar para
// um banco sem "Telefone" produziria uma listagem só de nomes, que é
// exatamente o problema que este módulo deveria resolver.
async function ensureLeadProperties(databaseId) {
  const schema = await notion.getSchema(databaseId);
  if (!schema) return { ok: false, error: `não consegui ler o banco ${databaseId} — a integração do Notion tem acesso a ele? (página → ••• → Connections)` };

  const missing = Object.keys(LEAD_SCHEMA).filter((k) => !schema[k]);
  const hasTitle = Object.values(schema).some((v) => v.type === "title");
  if (missing.length === 0) return { ok: true, added: [], alreadyComplete: true, hasTitle };

  try {
    const res = await fetch(`${NOTION_API}/databases/${databaseId}`, {
      method: "PATCH",
      headers: notion.getHeaders(),
      body: JSON.stringify({ properties: Object.fromEntries(missing.map((k) => [k, LEAD_SCHEMA[k]])) }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data?.message || `HTTP ${res.status}`, missing };
    // invalida o cache pra o sync já ver as novas propriedades
    await notion.getSchema(databaseId).catch(() => {});
    return { ok: true, added: missing, hasTitle };
  } catch (err) {
    return { ok: false, error: err.message, missing };
  }
}

function leadsDatabaseId() {
  return config.NOTION_LEADS_DATABASE_ID || "";
}

function isConfigured() {
  return !!(config.NOTION_TOKEN && leadsDatabaseId());
}

// Grava o id do banco de leads (env var ou dashboard podem definir).
function setLeadsDatabase(databaseId) {
  config.NOTION_LEADS_DATABASE_ID = databaseId;
  try {
    db.prepare(
      "INSERT INTO notion_config (id, leads_database_id) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET leads_database_id = excluded.leads_database_id"
    ).run(databaseId);
  } catch (err) {
    console.warn("[notionLeads] não persistiu leads_database_id:", err.message);
  }
  return { ok: true, databaseId };
}

// Monta o valor de uma propriedade conforme o TIPO que o banco realmente
// declara. Sem isso, um banco onde "Telefone" foi criado como texto (comum,
// porque é o default ao digitar) receberia payload de phone_number e a página
// inteira falharia com validation_error.
function setProp(properties, schema, name, value) {
  if (value === null || value === undefined || value === "") return;
  const declared = schema?.[name];
  if (!declared) return; // propriedade não existe nesse banco — ignora em silêncio
  const v = String(value);

  switch (declared.type) {
    case "title":
      properties[name] = { title: [{ type: "text", text: { content: v.slice(0, 200) } }] };
      break;
    case "rich_text":
      properties[name] = { rich_text: [{ type: "text", text: { content: v.slice(0, 1900) } }] };
      break;
    case "phone_number":
      properties[name] = { phone_number: v.slice(0, 100) };
      break;
    case "email":
      properties[name] = { email: v.slice(0, 100) };
      break;
    case "url":
      properties[name] = { url: v.slice(0, 700) };
      break;
    case "select":
      properties[name] = { select: { name: v.slice(0, 100) } };
      break;
    case "multi_select":
      properties[name] = { multi_select: [{ name: v.slice(0, 100) }] };
      break;
    case "date":
      properties[name] = { date: { start: v } };
      break;
    case "number": {
      const n = Number(v.replace(/\D/g, ""));
      if (Number.isFinite(n)) properties[name] = { number: n };
      break;
    }
    case "checkbox":
      properties[name] = { checkbox: !!value };
      break;
    default:
      // Tipo que não sabemos preencher (formula, rollup, relation...) — ignora.
      break;
  }
}

// Cria o banco de leads já com os tipos certos, sob uma página que o usuário
// informa. Existe pra ele não precisar montar 9 propriedades à mão e acertar
// cada tipo — errar um tipo faz todo sync falhar com validation_error.
async function createLeadsDatabase(parentPageId, title = "Leads Zenda") {
  if (!config.NOTION_TOKEN) return { ok: false, error: "NOTION_TOKEN não configurado" };
  if (!parentPageId) return { ok: false, error: "parentPageId obrigatório (id da página do Notion que vai conter o banco)" };

  const body = {
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: title } }],
    properties: {
      Nome: { title: {} },
      Telefone: { phone_number: {} },
      Instagram: { url: {} },
      Site: { url: {} },
      Cidade: { select: {} },
      Nicho: { select: {} },
      Status: { select: {} },
      Origem: { select: {} },
      Data: { date: {} },
    },
  };

  try {
    const res = await fetch(`${NOTION_API}/databases`, {
      method: "POST",
      headers: notion.getHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data?.message || `HTTP ${res.status}` };
    setLeadsDatabase(data.id);
    return { ok: true, databaseId: data.id, url: data.url };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function createLeadPage(lead, schema, databaseId) {
  const titleProp = notion.titlePropertyName(schema);
  const properties = {};
  setProp(properties, schema, titleProp, lead.name || "Estabelecimento");
  for (const p of LEAD_PROPS) setProp(properties, schema, p.name, p.from(lead));

  // Corpo: contexto que não cabe em propriedade (descrição/snippet da busca).
  const children = lead.description
    ? [{
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: String(lead.description).slice(0, 1900) } }] },
      }]
    : [];

  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: notion.getHeaders(),
    body: JSON.stringify({ parent: { database_id: databaseId }, properties, children }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data.id;
}

// Empurra os leads que ainda não foram para o Notion.
//
// Baseia-se em `notion_page_id IS NULL` em vez de sincronizar no momento da
// descoberta: se o Notion estiver fora no instante em que o lead foi achado,
// ele continua pendente e sobe na próxima rodada, em vez de ficar perdido pra
// sempre. Também torna a operação idempotente com o prospector rodando de 15
// em 15 minutos e reencontrando os mesmos estabelecimentos.
async function syncPendingLeads({ limit = 25 } = {}) {
  if (!isConfigured()) {
    return { ok: false, error: "Notion de leads não configurado (falta NOTION_TOKEN ou NOTION_LEADS_DATABASE_ID)", synced: 0 };
  }

  const databaseId = leadsDatabaseId();
  let pending;
  try {
    pending = db.prepare(
      `SELECT * FROM prospector_leads WHERE notion_page_id IS NULL OR notion_page_id = ''
       ORDER BY created_at DESC LIMIT ?`
    ).all(limit);
  } catch (err) {
    // Coluna ausente = migração não rodou. Não é fatal pro ciclo.
    return { ok: false, error: `leitura de pendentes falhou: ${err.message}`, synced: 0 };
  }

  if (pending.length === 0) return { ok: true, synced: 0, pending: 0 };

  const schema = await notion.getSchema(databaseId);
  if (!schema) {
    return { ok: false, error: `não leu o schema do banco ${databaseId} — token sem acesso a esse banco?`, synced: 0 };
  }

  let synced = 0;
  const errors = [];
  for (const lead of pending) {
    try {
      const pageId = await createLeadPage(lead, schema, databaseId);
      db.prepare("UPDATE prospector_leads SET notion_page_id = ? WHERE id = ?").run(pageId, lead.id);
      synced++;
    } catch (err) {
      errors.push(`${lead.name}: ${err.message}`);
      // Erro de schema/validação afeta todos igualmente — não insiste no resto.
      if (/validation_error|object_not_found|unauthorized/i.test(err.message)) break;
    }
  }

  if (errors.length) console.warn(`[notionLeads] ${synced} sincronizados, ${errors.length} falharam:`, errors.slice(0, 2).join(" | "));
  else if (synced) console.log(`[notionLeads] ${synced} lead(s) enviados para o Notion`);

  return { ok: errors.length === 0, synced, failed: errors.length, errors: errors.slice(0, 5) };
}

function stats() {
  try {
    const total = db.prepare("SELECT COUNT(*) c FROM prospector_leads").get().c;
    const sent = db.prepare("SELECT COUNT(*) c FROM prospector_leads WHERE notion_page_id IS NOT NULL AND notion_page_id != ''").get().c;
    return { configured: isConfigured(), databaseId: leadsDatabaseId() || null, total, sent, pending: total - sent };
  } catch (err) {
    return { configured: isConfigured(), error: err.message };
  }
}

module.exports = { isConfigured, setLeadsDatabase, createLeadsDatabase, syncPendingLeads, stats, LEAD_PROPS, normalizeNotionId, isDatabaseUrl, ensureLeadProperties };
