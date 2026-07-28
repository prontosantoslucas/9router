"use client";
import { useState, useEffect } from "react";

export default function NotionConfigPage() {
  const [token, setToken] = useState("");
  const [dbId, setDbId] = useState("");
  const [configured, setConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetch("/api/agent/notion-config")
      .then((r) => r.json())
      .then((d) => {
        setConfigured(d.configured);
      })
      .catch(() => {});
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch("/api/agent/notion-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, databaseId: dbId }),
      });
      const d = await r.json();
      if (d.ok) {
        setMsg({ type: "success", text: "Configuração salva e enviada ao agente." });
        setConfigured(true);
      } else {
        setMsg({ type: "error", text: d.error || "Erro ao salvar" });
      }
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    }
    setSaving(false);
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Notion</h1>
      <p className="text-sm opacity-70 mb-6">
        Configure o token da API do Notion e o ID do banco de dados para salvar notas automaticamente.
      </p>

      {configured && (
        <div className="bg-green-900/40 border border-green-700 rounded px-4 py-3 mb-4 text-sm">
          Notion configurado. As notas serão salvas automaticamente.
        </div>
      )}

      {msg && (
        <div
          className={`rounded px-4 py-3 mb-4 text-sm ${
            msg.type === "success"
              ? "bg-green-900/40 border border-green-700"
              : "bg-red-900/40 border border-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Notion API Token</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ntn_xxxxxxxxxxxx..."
            className="w-full bg-black/30 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Database ID</label>
          <input
            type="text"
            value={dbId}
            onChange={(e) => setDbId(e.target.value)}
            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className="w-full bg-black/30 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </div>
  );
}