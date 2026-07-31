const db = require("../db");

// Garantir tabela document_chunks
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS document_chunks (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      content TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
} catch (e) {
  console.error("[RAG] Erro ao inicializar tabela document_chunks:", e.message);
}

function chunkText(text, chunkSize = 500, overlap = 50) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks;
}

function addDocument(filename, text) {
  if (!text || !text.trim()) return { ok: false, error: "Texto vazio" };
  const chunks = chunkText(text);
  const insert = db.prepare(
    "INSERT INTO document_chunks (id, filename, content, chunk_index) VALUES (?, ?, ?, ?)"
  );
  
  const txn = db.transaction(() => {
    chunks.forEach((chunk, i) => {
      const id = `${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`;
      insert.run(id, filename, chunk, i);
    });
  });

  txn();
  return { ok: true, filename, chunksCount: chunks.length };
}

function searchDocuments(query, limit = 5) {
  if (!query || !query.trim()) return [];
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const rows = db.prepare("SELECT filename, content, chunk_index FROM document_chunks").all();
  
  const scored = rows.map(r => {
    let score = 0;
    const lowerContent = r.content.toLowerCase();
    terms.forEach(t => {
      if (lowerContent.includes(t)) score += 1;
    });
    return { ...r, score };
  });

  return scored
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function listDocuments() {
  const rows = db.prepare("SELECT filename, COUNT(*) as chunks, MAX(created_at) as created_at FROM document_chunks GROUP BY filename").all();
  return rows;
}

function deleteDocument(filename) {
  db.prepare("DELETE FROM document_chunks WHERE filename = ?").run(filename);
  return { ok: true };
}

module.exports = { addDocument, searchDocuments, listDocuments, deleteDocument };
