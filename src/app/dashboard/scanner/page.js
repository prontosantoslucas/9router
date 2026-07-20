"use client";

import { useState, useEffect, useCallback } from "react";

const ALL_PROVIDERS = {
  openai: "OpenAI",
  anthropic: "Anthropic (Claude)",
  deepseek: "DeepSeek",
  perplexity: "Perplexity",
  groq: "Groq",
  google: "Google Gemini",
  huggingface: "HuggingFace",
  mistral: "Mistral",
  cohere: "Cohere",
  replicate: "Replicate",
  openrouter: "OpenRouter",
  together: "Together AI",
  elevenlabs: "ElevenLabs",
};

const ALL_SOURCES = [
  { id: "github", label: "GitHub Repos" },
  { id: "gitlab", label: "GitLab" },
  { id: "pastebin", label: "Pastebin / Gists" },
];

const STATUS_COLORS = {
  valid: "bg-green-100 text-green-800",
  insufficient_quota: "bg-yellow-100 text-yellow-800",
  invalid: "bg-red-100 text-red-800",
  rate_limited: "bg-gray-100 text-gray-600",
  error: "bg-gray-100 text-gray-600",
};

export default function ScannerPage() {
  const [keys, setKeys] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterProvider, setFilterProvider] = useState("");
  const [selectedProviders, setSelectedProviders] = useState(Object.keys(ALL_PROVIDERS));
  const [selectedSources, setSelectedSources] = useState(["github"]);

  const fetchKeys = useCallback(async () => {
    const p = new URLSearchParams();
    if (filterStatus) p.set("status", filterStatus);
    if (filterProvider) p.set("provider", filterProvider);
    const res = await fetch(`/api/scanner/keys?${p}`);
    const data = await res.json();
    if (data.keys) setKeys(data.keys);
  }, [filterStatus, filterProvider]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const toggleProvider = (id) => {
    setSelectedProviders(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const toggleSource = (id) => {
    setSelectedSources(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const startScan = async () => {
    setScanning(true);
    setLastScan(null);
    try {
      const res = await fetch("/api/scanner/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providers: selectedProviders, sources: selectedSources }),
      });
      const data = await res.json();
      setLastScan(data);
      await fetchKeys();
    } catch (e) {
      setLastScan({ error: e.message });
    } finally {
      setScanning(false);
    }
  };

  const deleteKey = async (id) => {
    if (!confirm("Delete this key?")) return;
    await fetch(`/api/scanner/keys?id=${id}`, { method: "DELETE" });
    fetchKeys();
  };

  return (
    <div class="max-w-7xl mx-auto p-6">
      <div class="mb-6">
        <h1 class="text-2xl font-bold">API Key Scanner</h1>
        <p class="text-sm text-gray-500 mt-1">Search GitHub, GitLab, and Pastebin for leaked API keys and validate them</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div class="lg:col-span-3 bg-white rounded-lg border p-4">
          <h2 class="text-sm font-semibold mb-2">Providers</h2>
          <div class="flex flex-wrap gap-2">
            {Object.entries(ALL_PROVIDERS).map(([id, name]) => (
              <button
                key={id}
                onClick={() => toggleProvider(id)}
                class={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                  selectedProviders.includes(id)
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div class="bg-white rounded-lg border p-4">
          <h2 class="text-sm font-semibold mb-2">Sources</h2>
          <div class="space-y-1.5">
            {ALL_SOURCES.map(s => (
              <label key={s.id} class="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSources.includes(s.id)}
                  onChange={() => toggleSource(s.id)}
                  class="rounded border-gray-300"
                />
                {s.label}
              </label>
            ))}
          </div>
          <button
            onClick={startScan}
            disabled={scanning || selectedProviders.length === 0 || selectedSources.length === 0}
            class="mt-4 w-full bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanning ? "Scanning..." : "Run Scan"}
          </button>
        </div>
      </div>

      {lastScan && (
        <div class={`rounded-lg border p-4 mb-6 ${lastScan.error ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"}`}>
          {lastScan.error ? (
            <p class="text-red-700 text-sm">Error: {lastScan.error}</p>
          ) : (
            <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span>Scanned <strong>{lastScan.scanned || 0}</strong> files</span>
              <span>Found <strong>{lastScan.total || 0}</strong> unique keys</span>
              <span class="text-green-700">Valid: <strong>{lastScan.valid || 0}</strong></span>
              {lastScan.sources?.map(s => (
                <span key={s.source} class="text-gray-500">{s.source}: {s.found} keys</span>
              ))}
            </div>
          )}
        </div>
      )}

      <div class="bg-white rounded-lg border">
        <div class="p-3 border-b flex gap-2 items-center">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} class="border rounded px-2 py-1 text-xs">
            <option value="">All status</option>
            <option value="valid">Valid</option>
            <option value="insufficient_quota">Insufficient Quota</option>
            <option value="invalid">Invalid</option>
            <option value="rate_limited">Rate Limited</option>
            <option value="error">Error</option>
          </select>
          <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)} class="border rounded px-2 py-1 text-xs">
            <option value="">All providers</option>
            {Object.entries(ALL_PROVIDERS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b bg-gray-50">
                <th class="text-left px-4 py-3 font-medium">Key</th>
                <th class="text-left px-4 py-3 font-medium">Provider</th>
                <th class="text-left px-4 py-3 font-medium">Status</th>
                <th class="text-left px-4 py-3 font-medium">Source</th>
                <th class="text-left px-4 py-3 font-medium">Scanned</th>
                <th class="text-right px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 && (
                <tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">No keys scanned yet.</td></tr>
              )}
              {keys.map(k => (
                <tr key={k.id} class="border-b hover:bg-gray-50">
                  <td class="px-4 py-3 font-mono text-xs max-w-[200px] truncate">{k.key?.length > 30 ? k.key.slice(0, 28) + "..." : k.key}</td>
                  <td class="px-4 py-3 text-xs text-gray-500">{ALL_PROVIDERS[k.provider] || k.provider}</td>
                  <td class="px-4 py-3"><span class={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[k.status] || STATUS_COLORS.error}`}>{k.status}</span></td>
                  <td class="px-4 py-3">
                    {k.repoUrl ? <a href={k.repoUrl} target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline text-xs">{k.source}</a>
                    : <span class="text-xs text-gray-500">{k.source}</span>}
                  </td>
                  <td class="px-4 py-3 text-xs text-gray-500">{k.scanDate ? new Date(k.scanDate).toLocaleString() : "-"}</td>
                  <td class="px-4 py-3 text-right">
                    <button onClick={() => deleteKey(k.id)} class="text-red-500 hover:text-red-700 text-xs">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
