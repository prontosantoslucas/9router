// Google Drive + Docs (Chat inclusive) — real via googleapis.
// Escopo drive.file: só vê/mexe em arquivos criados pelo próprio app (mais restrito, mais seguro).
const { google } = require("googleapis");
const { getAuthorizedClient } = require("./oauth");

function drive() {
  return google.drive({ version: "v3", auth: getAuthorizedClient() });
}
function docs() {
  return google.docs({ version: "v1", auth: getAuthorizedClient() });
}
function chat() {
  return google.chat({ version: "v1", auth: getAuthorizedClient() });
}

// ── Drive ────────────────────────────────────────────────────

/**
 * Lista arquivos criados pelo app (escopo drive.file), paginado.
 */
async function listFiles({ query, pageSize = 20, pageToken } = {}) {
  const res = await drive().files.list({
    q: query,
    pageSize: Math.max(1, Math.min(100, Number(pageSize) || 20)),
    pageToken,
    fields: "nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink)",
  });
  return {
    files: (res.data.files || []).map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modifiedTime: f.modifiedTime,
      url: f.webViewLink,
    })),
    nextPageToken: res.data.nextPageToken || null,
  };
}

/**
 * Cria um arquivo com bytes crus + mimeType. Retorna id + url.
 */
async function uploadFile({ name, mimeType, body, folderId }) {
  if (!name) throw new Error("name obrigatório");
  if (!body) throw new Error("body obrigatório (Buffer, Stream ou string)");
  const res = await drive().files.create({
    requestBody: {
      name,
      mimeType: mimeType || "application/octet-stream",
      parents: folderId ? [folderId] : undefined,
    },
    media: {
      mimeType: mimeType || "application/octet-stream",
      body,
    },
    fields: "id, name, mimeType, webViewLink",
  });
  return { ok: true, id: res.data.id, name: res.data.name, mimeType: res.data.mimeType, url: res.data.webViewLink };
}

async function deleteFile(fileId) {
  await drive().files.delete({ fileId });
  return { ok: true, id: fileId };
}

// ── Docs ────────────────────────────────────────────────────

/**
 * Cria um Google Doc com texto inicial. `markdownContent` é inserido como texto plano
 * (formatação markdown → estilos precisa de API mais complexa — future work).
 */
async function createDocument(title, textContent) {
  if (!title) throw new Error("title obrigatório");
  // 1. Cria doc vazio via Docs API
  const created = await docs().documents.create({ requestBody: { title } });
  const documentId = created.data.documentId;

  // 2. Injeta texto se fornecido
  if (textContent) {
    await docs().documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: 1 }, // após o title
              text: textContent,
            },
          },
        ],
      },
    });
  }
  return {
    ok: true,
    documentId,
    url: `https://docs.google.com/document/d/${documentId}/edit`,
  };
}

/**
 * Lê o conteúdo textual de um doc (concatena todos os `textRun` de todos os parágrafos).
 */
async function readDocument(documentId) {
  const res = await docs().documents.get({ documentId });
  const body = res.data.body?.content || [];
  const text = extractText(body);
  return { ok: true, documentId, title: res.data.title, text };
}

function extractText(content) {
  let out = "";
  for (const el of content) {
    if (el.paragraph) {
      for (const e of el.paragraph.elements || []) {
        if (e.textRun?.content) out += e.textRun.content;
      }
    } else if (el.table) {
      for (const row of el.table.tableRows || []) {
        for (const cell of row.tableCells || []) {
          out += extractText(cell.content || []);
        }
      }
    }
  }
  return out;
}

/**
 * Anexa texto ao final de um doc existente.
 */
async function appendToDocument(documentId, text) {
  // Descobre o índice final atual
  const doc = await docs().documents.get({ documentId, fields: "body(content(endIndex))" });
  const content = doc.data.body?.content || [];
  const endIndex = content.length > 0 ? content[content.length - 1].endIndex - 1 : 1;
  await docs().documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [{ insertText: { location: { index: endIndex }, text } }],
    },
  });
  return { ok: true, documentId };
}

// ── Google Chat ────────────────────────────────────────────────────

/**
 * Envia mensagem para um space do Google Chat.
 * `spaceName` no formato "spaces/AAAA..." (obter via chat.spaces.list ou UI do Chat).
 */
async function sendChatMessage(spaceName, text) {
  if (!spaceName) throw new Error("spaceName obrigatório (ex.: 'spaces/AAAAA')");
  const res = await chat().spaces.messages.create({
    parent: spaceName,
    requestBody: { text },
  });
  return { ok: true, name: res.data.name, thread: res.data.thread?.name };
}

async function listChatSpaces({ pageSize = 25 } = {}) {
  const res = await chat().spaces.list({ pageSize });
  return (res.data.spaces || []).map((s) => ({
    name: s.name,
    displayName: s.displayName || null,
    type: s.spaceType || s.type,
  }));
}

module.exports = {
  // Drive
  listFiles,
  uploadFile,
  deleteFile,
  // Docs
  createDocument,
  readDocument,
  appendToDocument,
  // Chat
  sendChatMessage,
  listChatSpaces,
};
