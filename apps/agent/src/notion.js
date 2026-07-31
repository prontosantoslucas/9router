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

let _schema = null;
async function getSchema() {
  if (_schema) return _schema;
  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${config.NOTION_DATABASE_ID}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) return null;
    _schema = data.properties || {};
    return _schema;
  } catch {
    return null;
  }
}

function titlePropertyName(schema) {
  if (!schema) return "title";
  const entry = Object.entries(schema).find(([, v]) => v.type === "title");
  return entry ? entry[0] : "title";
}

async function createPage(title, content, tags = [], source = "chat") {
  if (!isConfigured()) return { ok: false, error: "Notion não configurado" };
  const schema = await getSchema();
  const titleProp = titlePropertyName(schema);
  const properties = {
    [titleProp]: { title: [{ type: "text", text: { content: title.slice(0, 200) } }] },
  };
  if (schema?.Fonte) properties.Fonte = { select: { name: String(source).slice(0, 100) } };
  if (schema?.Criado) properties.Criado = { date: { start: new Date().toISOString() } };
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

module.exports = { createPage, queryDatabase, searchPages, isConfigured, setConfig };