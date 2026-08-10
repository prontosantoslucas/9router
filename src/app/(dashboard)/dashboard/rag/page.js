"use client";

import { useState, useEffect } from "react";

export default function RagPage() {
  const [documents, setDocuments] = useState([]);
  const [filename, setFilename] = useState("");
  const [content, setContent] = useState("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchDocs = async () => {
    try {
      const res = await fetch("/api/agent/rag/documents");
      const data = await res.json();
      if (data.ok) setDocuments(data.documents || []);
    } catch (e) {
      console.error("[RAG] Erro ao buscar documentos:", e);
    }
  };

  useEffect(() => {
    // fetchDocs so seta estado depois do await no fetch, nunca de forma
    // sincrona no corpo do efeito — carga inicial legitima ao montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDocs();
  }, []);

  const handleUpload = async () => {
    if (!filename.trim() || !content.trim() || uploading) return;
    setUploading(true);
    try {
      const res = await fetch("/api/agent/rag/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, content }),
      });
      const data = await res.json();
      if (data.ok) {
        setFilename("");
        setContent("");
        fetchDocs();
        alert(`Documento "${data.filename}" indexado com sucesso em ${data.chunksCount} blocos!`);
      } else {
        alert(`Erro: ${data.error}`);
      }
    } catch (e) {
      alert(`Falha no upload: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fname) => {
    if (!confirm(`Remover o documento "${fname}"?`)) return;
    try {
      await fetch("/api/agent/rag/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: fname }),
      });
      fetchDocs();
    } catch (e) {
      alert(`Erro ao deletar: ${e.message}`);
    }
  };

  const handleSearch = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/agent/rag/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (data.ok) setSearchResults(data.results || []);
    } catch (e) {
      console.error("[RAG] Erro na busca:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-brand-500 text-2xl">folder_data</span>
          <h1 className="text-2xl font-bold font-display text-text-main">RAG & Base de Conhecimento Local</h1>
        </div>
        <p className="text-sm text-text-muted">
          Indexe arquivos de texto e documentos na base vetorial SQLite para permitir que o Agente Lucas consulte respostas contextualizadas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Painel de Upload/Indexação */}
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface dark:bg-surface-2 p-5 shadow-soft">
          <h2 className="text-base font-bold text-text-main flex items-center gap-2">
            <span className="material-symbols-outlined text-brand-500 text-lg">upload_file</span>
            Indexar Novo Documento
          </h2>

          <div className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Nome do arquivo (ex: manual_projeto.txt)"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg p-3 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
            <textarea
              placeholder="Cole o conteúdo do documento ou texto explicativo..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full min-h-[160px] resize-y rounded-xl border border-border bg-bg p-3 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
            <button
              onClick={handleUpload}
              disabled={uploading || !filename.trim() || !content.trim()}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 py-2.5 px-4 text-sm font-semibold text-white shadow-md hover:from-brand-600 disabled:opacity-50 transition-all"
            >
              <span className={`material-symbols-outlined text-lg ${uploading ? "animate-spin" : ""}`}>
                {uploading ? "sync" : "cloud_upload"}
              </span>
              <span>{uploading ? "Indexando..." : "Indexar Documento"}</span>
            </button>
          </div>
        </div>

        {/* Lista de Documentos Indexados */}
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface dark:bg-surface-2 p-5 shadow-soft">
          <h2 className="text-base font-bold text-text-main flex items-center gap-2">
            <span className="material-symbols-outlined text-brand-500 text-lg">library_books</span>
            Documentos Indexados ({documents.length})
          </h2>

          <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-text-muted text-xs">
                <span>Nenhum documento indexado ainda.</span>
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.filename}
                  className="flex items-center justify-between p-3 rounded-xl border border-border/70 bg-bg hover:border-brand-500/40 transition-all"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-text-main">{doc.filename}</span>
                    <span className="text-[10px] text-text-muted">{doc.chunks} blocos indexados</span>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.filename)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
                    title="Remover"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Testador de Busca Semântica */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface dark:bg-surface-2 p-5 shadow-soft">
        <h2 className="text-base font-bold text-text-main flex items-center gap-2">
          <span className="material-symbols-outlined text-brand-500 text-lg">search</span>
          Testar Busca no Conhecimento Local
        </h2>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Digite o termo ou pergunta para buscar trechos relevantes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1 rounded-xl border border-border bg-bg p-3 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          />
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="px-5 py-2.5 rounded-xl bg-brand-500 text-white font-semibold text-sm hover:bg-brand-600 disabled:opacity-50"
          >
            Buscar
          </button>
        </div>

        {/* Resultados da Busca */}
        {searchResults.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            <span className="text-xs font-semibold text-text-muted">Resultados ({searchResults.length}):</span>
            {searchResults.map((res, idx) => (
              <div key={idx} className="p-3 rounded-xl border border-border/80 bg-bg/80 flex flex-col gap-1 text-xs">
                <div className="flex items-center justify-between text-[11px] font-semibold text-brand-600 dark:text-brand-400">
                  <span>📄 {res.filename} (Bloco #{res.chunk_index})</span>
                  <span>Relevância: {res.score}</span>
                </div>
                <p className="text-text-main leading-relaxed italic">{res.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
