let config = require("./config");

const db = require("./db");

function loadPersisted() {
  try {
    const row = db.prepare("SELECT token, database_id, second_database_id FROM notion_config WHERE id = 1").get();
    if (row) {
      config.NOTION_TOKEN = row.token || config.NOTION_TOKEN;
      config.NOTION_DATABASE_ID = row.database_id || config.NOTION_DATABASE_ID;
      // Segundo database do segundo cérebro ("Cérebro Inteligente" —
      // Agenda/Tarefas/Metas/Alimentação/Financeiro/Anotações/Atalhos),
      // separado do database_id original (Conversas Profundas/Planos/etc.).
      // Semeado com o database real encontrado em 2026-07-31 (a linked view
      // da página homônima apontava pra este, não pro database-casca vazio).
      config.NOTION_SECOND_DATABASE_ID = row.second_database_id || config.NOTION_SECOND_DATABASE_ID || "92805e5e-aa0f-83d0-a94c-8189a151ba99";
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
  _schemaCache.delete(databaseId);
  try {
    db.prepare(
      "INSERT INTO notion_config (id, token, database_id) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET token = excluded.token, database_id = excluded.database_id"
    ).run(token, databaseId);
  } catch (err) {
    console.error("[notion] falha ao persistir config:", err.message);
  }
}

function setSecondDatabase(databaseId) {
  config.NOTION_SECOND_DATABASE_ID = databaseId;
  _schemaCache.delete(databaseId);
  try {
    db.prepare(
      "INSERT INTO notion_config (id, second_database_id) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET second_database_id = excluded.second_database_id"
    ).run(databaseId);
  } catch (err) {
    console.error("[notion] falha ao persistir second_database_id:", err.message);
  }
}

function isConfigured() {
  return !!(config.NOTION_TOKEN && config.NOTION_DATABASE_ID);
}

// Cache com expiração curta, por database — sem TTL, uma propriedade criada
// no Notion depois do boot do agente ficava invisível até reiniciar o
// processo manualmente. Por database porque agora existe mais de um
// (database original + "Cérebro Inteligente"), cada um com seu próprio schema.
const SCHEMA_TTL_MS = 5 * 60 * 1000;
const _schemaCache = new Map(); // databaseId -> { schema, fetchedAt }

async function getSchema(databaseId = config.NOTION_DATABASE_ID) {
  const cached = _schemaCache.get(databaseId);
  if (cached && Date.now() - cached.fetchedAt < SCHEMA_TTL_MS) return cached.schema;
  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) return cached?.schema || null; // mantém o cache antigo (melhor que nada) se a API falhar
    const schema = data.properties || {};
    _schemaCache.set(databaseId, { schema, fetchedAt: Date.now() });
    return schema;
  } catch {
    return cached?.schema || null;
  }
}

function titlePropertyName(schema) {
  if (!schema) return "title";
  const entry = Object.entries(schema).find(([, v]) => v.type === "title");
  return entry ? entry[0] : "title";
}

async function createPage(title, content, tags = [], source = "chat", categoria = "", databaseId = config.NOTION_DATABASE_ID) {
  if (!isConfigured()) return { ok: false, error: "Notion não configurado" };
  const schema = await getSchema(databaseId);
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
    parent: { database_id: databaseId },
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

// Busca ESCOPADA a um database especifico (query, nao search global). Duas
// categorias podem ter o mesmo titulo em databases diferentes — ex.: "Metas"
// existe tanto no segundo cerebro original quanto no Cerebro Inteligente — e
// a busca global do Notion (/v1/search) nao tem como distinguir qual das duas
// o chamador queria. Escopar ao database certo elimina a ambiguidade.
async function findPageByExactTitle(title, databaseId) {
  try {
    const schema = await getSchema(databaseId);
    const titleProp = titlePropertyName(schema);
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        filter: { property: titleProp, title: { equals: title } },
        page_size: 1,
      }),
    });
    const data = await res.json();
    if (!res.ok) return null;
    return data.results?.[0] || null;
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
const _categoryPages = new Map(); // `${databaseId}:${categoria}` -> { id, fetchedAt }

async function getCategoryPageId(categoria, databaseId = config.NOTION_DATABASE_ID) {
  if (!categoria || !databaseId) return null;
  const cacheKey = `${databaseId}:${categoria}`;
  const cached = _categoryPages.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CATEGORY_PAGE_TTL_MS) return cached.id;

  const found = await findPageByExactTitle(categoria, databaseId);
  if (found) {
    _categoryPages.set(cacheKey, { id: found.id, fetchedAt: Date.now() });
    return found.id;
  }

  const created = await createPage(
    categoria,
    `Página do segundo cérebro para a categoria "${categoria}". Criada automaticamente — as capturas dessa categoria são anexadas aqui.`,
    [],
    "system",
    "",
    databaseId
  );
  if (!created.ok) return null;
  _categoryPages.set(cacheKey, { id: created.id, fetchedAt: Date.now() });
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
async function saveToCategory(categoria, title, content, tags = [], source = "chat", databaseId = config.NOTION_DATABASE_ID) {
  const pageId = await getCategoryPageId(categoria, databaseId);
  if (pageId) {
    const meta = `${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · ${source}`;
    const appended = await appendEntry(pageId, title, content, meta);
    if (appended.ok) {
      return { ok: true, appended: true, categoria, url: `https://notion.so/${pageId.replace(/-/g, "")}` };
    }
  }
  return createPage(title, content, tags, source, categoria, databaseId);
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

module.exports = { createPage, saveToCategory, queryDatabase, searchPages, isConfigured, setConfig, setSecondDatabase };