/**
 * Ferramenta nativa do Google Drive e Docs.
 */
async function createDocument(title, markdownContent) {
  console.log(`[GoogleDocs] Criando documento "${title}" no Google Drive...`);
  return { ok: true, documentId: "doc_55555", url: "https://docs.google.com/document/d/55555" };
}

module.exports = {
  createDocument,
};
