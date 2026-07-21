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
  { id: "github", label: "GitHub Repos", icon: "code" },
  { id: "pastebin", label: "Pastebin / Gists", icon: "content_paste" },
];

const STATUS_STYLES = {
  valid: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20",
  insufficient_quota: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
  invalid: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20",
  rate_limited: "bg-surface-3 text-text-muted border-border",
  error: "bg-surface-3 text-text-muted border-border",
};

function StatusBadge({ status }) {
  const label = status === "insufficient_quota" ? "zero balance" : status;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_STYLES[status] || STATUS_STYLES.error}`}>
      {label}
    </span>
  );
}

function StatCard({ icon, label, value, tone = "default" }) {
  const tones = {
    default: "text-text-main",
    green: "text-green-600 dark:text-green-400",
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-red-600 dark:text-red-400",
  };
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-text-muted mb-1.5">
        <span className="material-symbols-outlined text-[16px]">{icon}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-display font-bold ${tones[tone]}`}>{value}</p>
    </div>
  );
}

export default function ScannerPage() {
  const [keys, setKeys] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterProvider, setFilterProvider] = useState("");
  const [selectedProviders, setSelectedProviders] = useState(Object.keys(ALL_PROVIDERS));
  const [selectedSources, setSelectedSources] = useState(["github"]);

  const [testKey, setTestKey] = useState("");
  const [testProvider, setTestProvider] = useState("openai");
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const fetchKeys = useCallback(async () => {
    const p = new URLSearchParams();
    if (filterStatus) p.set("status", filterStatus);
    if (filterProvider) p.set("provider", filterProvider);
    const res = await fetch(`/api/scanner/keys?${p}`);
    const data = await res.json();
    if (data.keys) setKeys(data.keys);
  }, [filterStatus, filterProvider]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const toggleProvider = (id) => setSelectedProviders(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  const toggleSource = (id) => setSelectedSources(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

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

  const testManualKey = async () => {
    if (!testKey.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/scanner/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: testKey.trim(), provider: testProvider }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e) {
      setTestResult({ status: "error", key: testKey.slice(0, 20) + "..." });
    } finally {
      setTesting(false);
    }
  };

  const deleteKey = async (id) => {
    if (!confirm("Delete this key?")) return;
    await fetch(`/api/scanner/keys?id=${id}`, { method: "DELETE" });
    fetchKeys();
  };

  const selectAll = () => setSelectedProviders(Object.keys(ALL_PROVIDERS));
  const selectNone = () => setSelectedProviders([]);

  return (
    <div className="max-w-7xl mx-auto p-6 animate-fade-up">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center size-9 rounded-md bg-amber-500/10 border border-amber-500/20">
              <span className="material-symbols-outlined text-amber-500 text-[20px]">radar</span>
            </div>
            <h1 className="text-2xl font-display font-bold tracking-tight text-text-main">API Key Scanner</h1>
          </div>
          <p className="text-sm text-text-muted mt-2">Search GitHub and Pastebin for leaked API keys and validate them in real-time.</p>
        </div>
      </div>

      {/* Manual Key Test */}
      <div className="rounded-lg border border-border bg-surface p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-text-muted text-[18px]">key</span>
          <h2 className="text-sm font-semibold text-text-main">Test a Key Manually</h2>
        </div>
        <div className="flex gap-2 flex-col sm:flex-row">
          <input
            type="text"
            className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm font-mono text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all"
            placeholder="Paste an API key to test…"
            value={testKey}
            onChange={e => setTestKey(e.target.value)}
          />
          <select value={testProvider} onChange={e => setTestProvider(e.target.value)} className="rounded-md border border-border bg-bg px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-amber-500/30">
            {Object.entries(ALL_PROVIDERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={testManualKey} disabled={testing || !testKey.trim()} className="inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-md text-sm font-semibold transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed">
            {testing ? <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> : <span className="material-symbols-outlined text-[16px]">bolt</span>}
            {testing ? "Testing…" : "Test Key"}
          </button>
        </div>
        {testResult && (
          <div className={`mt-3 p-3 rounded-md text-sm border flex items-center gap-2 ${testResult.status === "valid" ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20" : testResult.status === "insufficient_quota" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" : "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"}`}>
            <span className="material-symbols-outlined text-[18px]">{testResult.status === "valid" ? "check_circle" : testResult.status === "insufficient_quota" ? "warning" : "cancel"}</span>
            <span className="font-mono text-xs">{testResult.key}</span>
            <span className="opacity-60">→</span>
            <strong>{testResult.status}</strong>
            {testResult.status === "valid" && <span className="ml-auto text-xs font-semibold">Valid key!</span>}
            {testResult.status === "insufficient_quota" && <span className="ml-auto text-xs">Valid but zero balance</span>}
          </div>
        )}
      </div>

      {/* Scan Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 rounded-lg border border-border bg-surface p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-main">Providers to Scan</h2>
            <div className="flex gap-2 text-xs">
              <button onClick={selectAll} className="text-amber-600 dark:text-amber-400 hover:underline font-medium">All</button>
              <span className="text-border">·</span>
              <button onClick={selectNone} className="text-text-muted hover:underline font-medium">None</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ALL_PROVIDERS).map(([id, name]) => (
              <button
                key={id}
                onClick={() => toggleProvider(id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  selectedProviders.includes(id)
                    ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                    : "bg-transparent text-text-muted border-border hover:border-amber-500/40 hover:text-text-main"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5 flex flex-col">
          <h2 className="text-sm font-semibold text-text-main mb-3">Sources</h2>
          <div className="space-y-2 flex-1">
            {ALL_SOURCES.map(s => (
              <label key={s.id} className={`flex items-center gap-2.5 text-sm cursor-pointer rounded-md border px-3 py-2 transition-all ${selectedSources.includes(s.id) ? "border-amber-500/40 bg-amber-500/5" : "border-border hover:bg-surface-2"}`}>
                <input type="checkbox" checked={selectedSources.includes(s.id)} onChange={() => toggleSource(s.id)} className="rounded border-border accent-amber-500" />
                <span className="material-symbols-outlined text-[16px] text-text-muted">{s.icon}</span>
                <span className="text-text-main">{s.label}</span>
              </label>
            ))}
          </div>
          <button
            onClick={startScan}
            disabled={scanning || selectedProviders.length === 0 || selectedSources.length === 0}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-md text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanning ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : <span className="material-symbols-outlined text-[18px]">travel_explore</span>}
            {scanning ? "Scanning…" : "Run Scan"}
          </button>
        </div>
      </div>

      {/* Scan Result Summary */}
      {lastScan && !lastScan.error && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-scale-in">
          <StatCard icon="description" label="Files Scanned" value={lastScan.scanned || 0} />
          <StatCard icon="vpn_key" label="Keys Found" value={lastScan.total || 0} />
          <StatCard icon="verified" label="Valid" value={lastScan.valid || 0} tone="green" />
          <StatCard icon="account_balance_wallet" label="Zero Balance" value={lastScan.insufficient_quota || 0} tone="amber" />
        </div>
      )}
      {lastScan?.error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 mb-6 flex items-center gap-2 text-red-700 dark:text-red-400 text-sm">
          <span className="material-symbols-outlined text-[18px]">error</span>
          Error: {lastScan.error}
        </div>
      )}

      {/* Results Table */}
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <div className="p-3 border-b border-border flex gap-2 items-center flex-wrap">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-amber-500/30">
            <option value="">All status</option>
            <option value="valid">Valid</option>
            <option value="insufficient_quota">Zero Balance</option>
            <option value="invalid">Invalid</option>
            <option value="rate_limited">Rate Limited</option>
            <option value="error">Error</option>
          </select>
          <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)} className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-amber-500/30">
            <option value="">All providers</option>
            {Object.entries(ALL_PROVIDERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={fetchKeys} className="ml-auto inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium">
            <span className="material-symbols-outlined text-[14px]">refresh</span>
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="text-left px-4 py-3 font-semibold text-xs text-text-muted uppercase tracking-wider">Key</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-text-muted uppercase tracking-wider">Provider</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-text-muted uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-text-muted uppercase tracking-wider">Source</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-text-muted uppercase tracking-wider">Scanned</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 && (
                <tr><td colSpan="6" className="px-4 py-12 text-center text-text-muted">
                  <span className="material-symbols-outlined text-[32px] opacity-40 block mb-2">search_off</span>
                  No keys scanned yet. Click &quot;Run Scan&quot; or paste a key above.
                </td></tr>
              )}
              {keys.map(k => (
                <tr key={k.id} className="border-b border-border-subtle hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs max-w-[200px] truncate text-text-main">{k.key?.length > 30 ? k.key.slice(0, 28) + "…" : k.key}</td>
                  <td className="px-4 py-3 text-xs text-text-muted">{ALL_PROVIDERS[k.provider] || k.provider}</td>
                  <td className="px-4 py-3"><StatusBadge status={k.status} /></td>
                  <td className="px-4 py-3">
                    {k.repoUrl ? <a href={k.repoUrl} target="_blank" rel="noopener noreferrer" className="text-amber-600 dark:text-amber-400 hover:underline text-xs inline-flex items-center gap-0.5">{k.source}<span className="material-symbols-outlined text-[12px]">open_in_new</span></a>
                    : <span className="text-xs text-text-muted">{k.source}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">{k.scanDate ? new Date(k.scanDate).toLocaleString() : "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteKey(k.id)} className="text-text-muted hover:text-red-500 transition-colors" title="Delete">
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
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
