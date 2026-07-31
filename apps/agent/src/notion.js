let config = require("./config");

const db = require("./db");

function loadPersisted() {
  try {
    const row = db.prepare("SELECT token, database_id FROM notion_config WHERE id = 1").get();
    if (row) {
      config.NOTION_TOKEN = row.token || config.NOTION_TOKEN;
      config.NOTION_DATABASE_ID = row.database_id || config.NOTION_DATABASE_ID;
    }
  } catch {}
}

loadPersisted();

function getHeaders() {
  return {
    Authorization: `Bearer ${config.NOTION_TOKEN}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
  };
}

function setConfig(token, databaseId) {
  config.NOTION_TOKEN = token;
  config.NOTION_DATABASE_ID = databaseId;
  _schema = null;
  _schemaFetchedAt = 0;
  try {
    db.prepare(
      "INSERT INTO notion_config (id, token, database_id) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET token = excluded.token, database_id = excluded.database_id"
    ).run(token, databaseId);
  } catch (err) {
    console.error("[notion] falha ao persistir config:", err.message);
  }
}

function isConfigured() {
  return !!(config.NOTION_TOKEN && config.NOTION_DATABASE_ID);
}

// Cache com expiração curta: sem TTL, uma coluna criada no Notion depois do
// boot do agente ficava invisível até reiniciar o processo manualmente.
const SCHEMA_TTL_MS = 5 * 60 * 1000;
let _schema = null;
let _schemaFetchedAt = 0;
async function getSchema() {
  if (_schema && Date.now() - _schemaFetchedAt < SCHEMA_TTL_MS) return _schema;
  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${config.NOTION_DATABASE_ID}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) return _schema; // mantém o cache antigo (melhor que nada) se a API falhar
    _schema = data.properties || {};
    _schemaFetchedAt = Date.now();
    return _schema;
  } catch {
    return _schema;
  }
}

function titlePropertyName(schema) {
  if (!schema) return "title";
  const entry = Object.entries(schema).find(([, v]) => v.type === "title");
  return entry ? entry[0] : "title";
}

async function createPage(title, content, tags = [], source = "chat", categoria = "") {
  if (!isConfigured()) return { ok: false, error: "Notion não configurado" };
  const schema = await getSchema();
  const titleProp = titlePropertyName(schema);
  const properties = {
    [titleProp]: { title: [{ type: "text", text: { content: title.slice(0, 200) } }] },
  };
  if (schema?.Fonte) properties.Fonte = { select: { name: String(source).slice(0, 100) } };
  if (schema?.Criado) properties.Criado = { date: { start: new Date().toISOString() } };
  if (schema?.Categoria && categoria) {
    properties.Categoria = { select: { name: String(categoria).slice(0, 100) } };
  }
  if (tags.length > 0 && schema?.Tags) {
    properties.Tags = { multi_select: tags.slice(0, 10).map((t) => ({ name: String(t).slice(0, 100) })) };
  }
  const body = {
    parent: { database_id: config.NOTION_DATABASE_ID },
    properties,
    children: [
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: content.slice(0, 2000) } }],
        },
      },
    ],
  };
  try {
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.message || `HTTP ${res.status}` };
    return { ok: true, id: data.id, url: data.url };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function pageTitle(page) {
  if (page?.object === "database" && Array.isArray(page.title)) {
    return page.title.map((t) => t.plain_text).join("");
  }
  const props = page?.properties || {};
  for (const v of Object.values(props)) {
    if (v?.type === "title" && Array.isArray(v.title)) {
      return v.title.map((t) => t.plain_text).join("");
    }
  }
  return "";
}

async function findPageByExactTitle(title) {
  try {
    const res = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        query: title,
        filter: { property: "object", value: "page" },
        page_size: 10,
      }),
    });
    const data = await res.json();
    if (!res.ok) return null;
    const wanted = title.trim().toLowerCase();
    return (data.results || []).find((p) => pageTitle(p).trim().toLowerCase() === wanted) || null;
  } catch {
    return null;
  }
}

// Resolve (e cacheia) o id da página do Notion que representa uma categoria do
// segundo cérebro ("Planos", "Metas", ...), procurando pelo título exato. Se
// não existir ainda, cria como linha do database configurado — assim o
// sistema se auto-provisiona sem depender de nenhuma propriedade de schema
// (Select "Categoria" e afins exigem confirmação manual na UI do Notion, que
// já se mostrou um passo frágil de esquecer/errar).
const CATEGORY_PAGE_TTL_MS = 5 * 60 * 1000;
const _categoryPages = new Map(); // categoria -> { id, fetchedAt }

async function getCategoryPageId(categoria) {
  if (!categoria) return null;
  const cached = _categoryPages.get(categoria);
  if (cached && Date.now() - cached.fetchedAt < CATEGORY_PAGE_TTL_MS) return cached.id;

  const found = await findPageByExactTitle(categoria);
  if (found) {
    _categoryPages.set(categoria, { id: found.id, fetchedAt: Date.now() });
    return found.id;
  }

  const created = await createPage(
    categoria,
    `Página do segundo cérebro para a categoria "${categoria}". Criada automaticamente — as capturas dessa categoria são anexadas aqui.`,
    [],
    "system"
  );
  if (!created.ok) return null;
  _categoryPages.set(categoria, { id: created.id, fetchedAt: Date.now() });
  return created.id;
}

// Anexa uma entrada datada (título + meta + conteúdo) ao final de uma página
// existente, em vez de criar uma linha nova no database a cada captura. É
// assim que as páginas de categoria crescem como um documento único ao longo
// do tempo — o "se autopreencher" pedido para o segundo cérebro.
async function appendEntry(pageId, title, content, meta = "") {
  if (!config.NOTION_TOKEN) return { ok: false, error: "Notion não configurado" };
  const children = [
    {
      object: "block",
      type: "heading_3",
      heading_3: { rich_text: [{ type: "text", text: { content: title.slice(0, 200) } }] },
    },
    ...(meta
      ? [
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content: meta.slice(0, 200) }, annotations: { italic: true, color: "gray" } }],
            },
          },
        ]
      : []),
    {
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [{ type: "text", text: { content: content.slice(0, 2000) } }] },
    },
    { object: "block", type: "divider", divider: {} },
  ];
  try {
    const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ children }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.message || `HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Ponto de entrada do segundo cérebro: salva sob a página da categoria. Se a
// categoria não puder ser resolvida (Notion indisponível, sem categoria
// informada), cai de volta para uma linha nova no database — para nunca
// perder a captura silenciosamente.
async function saveToCategory(categoria, title, content, tags = [], source = "chat") {
  const pageId = await getCategoryPageId(categoria);
  if (pageId) {
    const meta = `${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · ${source}`;
    const appended = await appendEntry(pageId, title, content, meta);
    if (appended.ok) {
      return { ok: true, appended: true, categoria, url: `https://notion.so/${pageId.replace(/-/g, "")}` };
    }
  }
  return createPage(title, content, tags, source, categoria);
}

async function queryDatabase(filter = {}, sorts = []) {
  if (!isConfigured()) return { ok: false, error: "Notion não configurado" };
  const body = {};
  if (Object.keys(filter).length > 0) body.filter = filter;
  if (sorts.length > 0) body.sorts = sorts;
  body.page_size = 20;
  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${config.NOTION_DATABASE_ID}/query`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.message || `HTTP ${res.status}` };
    const pages = (data.results || []).map((p) => ({
      id: p.id,
      url: p.url,
      title: p.properties?.title?.title?.[0]?.text?.content || "(sem título)",
      created: p.created_time,
      tags: (p.properties?.Tags?.multi_select || []).map((t) => t.name),
    }));
    return { ok: true, pages };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function searchPages(query) {
  try {
    const res = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ query, page_size: 10 }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.message || `HTTP ${res.status}` };
    const results = (data.results || [])
      .filter((r) => r.object === "page" || r.object === "database")
      .map((r) => ({
        id: r.id,
        url: r.url,
        title: r.properties?.title?.title?.[0]?.text?.content
          || r.properties?.Name?.title?.[0]?.text?.content
          || "(sem título)",
        object: r.object,
      }));
    return { ok: true, results };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { createPage, saveToCategory, queryDatabase, searchPages, isConfigured, setConfig };