"use client";
import { useState, useEffect, useCallback } from "react";

/**
 * Segundo cérebro — página estilo Evernote.
 *
 * Layout: sidebar com lista de notas (à esquerda) + editor (à direita).
 * Puxa via /api/agent/brain/* que proxy pro agent loopback.
 *
 * Fontes: memoryStore local (SQLite do agent). Notas que também foram
 * espelhadas no Notion vêm com link direto.
 */
export default function BrainPage() {
  const [notes, setNotes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");
  const [diagnose, setDiagnose] = useState(null);

  const loadNotes = useCallback(async () => {
    try {
      const r = await fetch(`/api/agent/brain/list?limit=200`);
      const data = await r.json();
      setNotes(data.items || []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    loadNotes();
    fetch("/api/agent/brain/diagnose").then((r) => r.json()).then(setDiagnose).catch(() => {});
  }, [loadNotes]);

  async function openNote(id) {
    setEditing(null);
    try {
      const r = await fetch(`/api/agent/brain/get/${encodeURIComponent(id)}`);
      const data = await r.json();
      setSelected(data);
      setEditing({ text: data.text || "", tags: (data.tags || []).join(", ") });
    } catch (e) { console.error(e); }
  }

  async function saveEdits() {
    if (!editing) return;
    setSaving(true);
    try {
      const tags = editing.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const body = { text: editing.text, tags };
      if (selected?.id) body.id = selected.id;
      const r = await fetch(`/api/agent/brain/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (data.ok) { await loadNotes(); if (data.id !== selected?.id) openNote(data.id); }
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  async function deleteNote() {
    if (!selected?.id) return;
    if (!confirm("Apagar esta nota permanentemente?")) return;
    await fetch(`/api/agent/brain/${encodeURIComponent(selected.id)}`, { method: "DELETE" });
    setSelected(null); setEditing(null);
    await loadNotes();
  }

  function newNote() {
    setSelected(null);
    setEditing({ text: "", tags: "" });
  }

  const filtered = notes.filter((n) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      n.title?.toLowerCase().includes(q) ||
      n.preview?.toLowerCase().includes(q) ||
      n.tags?.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.title}>Segundo cérebro</h2>
          <button style={styles.newBtn} onClick={newNote}>+ nova</button>
        </div>
        <input
          type="text"
          placeholder="Filtrar..."
          style={styles.filter}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {diagnose && !diagnose.is_configured && (
          <div style={styles.warning}>
            ⚠ Notion não configurado — mostrando só notas locais.
            <a href="/dashboard/notion-config" style={{ color: "#93c5fd", marginLeft: 6 }}>configurar</a>
          </div>
        )}
        <div style={styles.notesList}>
          {filtered.length === 0 && <div style={styles.empty}>Nenhuma nota. Converse com o agent — as coisas importantes salvam automáticas.</div>}
          {filtered.map((n) => (
            <div
              key={n.id}
              style={{ ...styles.noteItem, ...(selected?.id === n.id ? styles.noteItemActive : {}) }}
              onClick={() => openNote(n.id)}
            >
              <div style={styles.noteTitle}>{n.title || "(sem título)"}</div>
              <div style={styles.notePreview}>{n.preview?.slice(0, 100)}</div>
              <div style={styles.noteMeta}>
                <span>{new Date(n.created_at).toLocaleDateString("pt-BR")}</span>
                {n.notion_url && <span title="também no Notion">📓</span>}
                {n.source === "brain-auto" && <span title="auto capturada">🧠</span>}
                {n.source === "auto-memory" && <span title="autoMemory">💾</span>}
              </div>
              {n.tags?.length > 0 && (
                <div style={styles.tags}>
                  {n.tags.slice(0, 4).map((t) => <span key={t} style={styles.tag}>{t}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div style={styles.editor}>
        {editing ? (
          <>
            <div style={styles.editorHeader}>
              <div style={styles.editorMeta}>
                {selected?.id ? `ID: ${selected.id}` : "Nova nota"}
                {selected?.notion_url && (
                  <a href={selected.notion_url} target="_blank" rel="noreferrer" style={styles.notionLink}>
                    Abrir no Notion ↗
                  </a>
                )}
              </div>
              <div style={styles.editorActions}>
                <button style={styles.saveBtn} onClick={saveEdits} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar"}
                </button>
                {selected?.id && (
                  <button style={styles.deleteBtn} onClick={deleteNote}>Apagar</button>
                )}
              </div>
            </div>
            <textarea
              style={styles.textarea}
              value={editing.text}
              onChange={(e) => setEditing({ ...editing, text: e.target.value })}
              placeholder="Escreve aqui..."
              autoFocus
            />
            <input
              type="text"
              style={styles.tagsInput}
              value={editing.tags}
              onChange={(e) => setEditing({ ...editing, tags: e.target.value })}
              placeholder="tags separadas por vírgula"
            />
          </>
        ) : (
          <div style={styles.emptyEditor}>Selecione uma nota à esquerda ou clique "+ nova"</div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { display: "flex", height: "calc(100vh - 60px)", background: "#0f172a", color: "#e2e8f0" },
  sidebar: { width: 340, borderRight: "1px solid #1e293b", display: "flex", flexDirection: "column", background: "#0b1220" },
  sidebarHeader: { padding: 16, borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" },
  title: { margin: 0, fontSize: 16, color: "#93c5fd" },
  newBtn: { background: "#3b82f6", color: "white", border: "none", borderRadius: 4, padding: "6px 12px", cursor: "pointer", fontSize: 12 },
  filter: { margin: 12, padding: "8px 10px", background: "#1e293b", border: "1px solid #334155", borderRadius: 4, color: "#e2e8f0", fontSize: 13 },
  warning: { margin: "0 12px 8px", padding: 8, background: "#3f2312", border: "1px solid #78350f", borderRadius: 4, fontSize: 11, color: "#fed7aa" },
  notesList: { flex: 1, overflowY: "auto" },
  noteItem: { padding: 12, borderBottom: "1px solid #1e293b", cursor: "pointer" },
  noteItemActive: { background: "#1e293b" },
  noteTitle: { fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#f1f5f9" },
  notePreview: { fontSize: 11, color: "#94a3b8", lineHeight: 1.3, marginBottom: 6, maxHeight: 30, overflow: "hidden" },
  noteMeta: { fontSize: 10, color: "#64748b", display: "flex", gap: 8, alignItems: "center" },
  tags: { display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" },
  tag: { background: "#1e293b", color: "#94a3b8", padding: "2px 6px", borderRadius: 3, fontSize: 10 },
  empty: { padding: 24, color: "#64748b", fontSize: 12, textAlign: "center" },
  editor: { flex: 1, display: "flex", flexDirection: "column" },
  editorHeader: { padding: 16, borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" },
  editorMeta: { fontSize: 11, color: "#64748b", display: "flex", gap: 12, alignItems: "center" },
  notionLink: { color: "#93c5fd", textDecoration: "none", fontSize: 12 },
  editorActions: { display: "flex", gap: 8 },
  saveBtn: { background: "#22c55e", color: "white", border: "none", borderRadius: 4, padding: "6px 16px", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  deleteBtn: { background: "#ef4444", color: "white", border: "none", borderRadius: 4, padding: "6px 12px", cursor: "pointer", fontSize: 12 },
  textarea: { flex: 1, padding: 20, background: "#0f172a", color: "#e2e8f0", border: "none", fontSize: 14, lineHeight: 1.6, fontFamily: "system-ui, -apple-system, sans-serif", outline: "none", resize: "none" },
  tagsInput: { padding: "10px 20px", background: "#1e293b", color: "#e2e8f0", border: "none", borderTop: "1px solid #334155", fontSize: 12, outline: "none" },
  emptyEditor: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 14 },
};
