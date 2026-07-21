const { NOTION_TOKEN, NOTION_DATABASE_ID } = require("./config");

const API = "https://api.notion.com/v1";
const HEADERS = {
  Authorization: `Bearer ${NOTION_TOKEN}`,
  "Content-Type": "application/json",
  "Notion-Version": "2022-06-28",
};

function isConfigured() {
  return !!(NOTION_TOKEN && NOTION_DATABASE_ID);
}

async function createPage(title, content, tags = [], source = "chat") {
  if (!isConfigured()) return { ok: false, error: "Notion não configurado" };
  const body = {
    parent: { database_id: NOTION_DATABASE_ID },
    properties: {
      title: { title: [{ type: "text", text: { content: title.slice(0, 200) } }] },
      Fonte: { select: { name: source } },
      Criado: { date: { start: new Date().toISOString() } },
    },
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
  if (tags.length > 0) {
    body.properties.Tags = { multi_select: tags.map((t) => ({ name: t })) };
  }
  try {
    const res = await fetch(`${API}/pages`, {
      method: "POST",
      headers: HEADERS,
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
    const res = await fetch(`${API}/databases/${NOTION_DATABASE_ID}/query`, {
      method: "POST",
      headers: HEADERS,
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
    const res = await fetch(`${API}/search`, {
      method: "POST",
      headers: HEADERS,
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

module.exports = { createPage, queryDatabase, searchPages, isConfigured };
