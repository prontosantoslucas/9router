"use client";

import { useState } from "react";

// Tailwind precisa do nome completo da classe, literal, em algum arquivo
// escaneado para gera-la no bundle final — `md:grid-cols-${n}` interpolado
// so "funciona" se essa classe exata ja existir em outro lugar do codebase
// por coincidencia. Mapa estatico remove essa dependencia oculta.
const GRID_COLS_CLASS = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3" };

const AVAILABLE_MODELS = [
  { id: "opencode/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google" },
  { id: "opencode/claude-3-5-haiku", name: "Claude 3.5 Haiku", provider: "Anthropic" },
  { id: "opencode/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI" },
  { id: "opencode/deepseek-r1", name: "DeepSeek R1", provider: "DeepSeek" },
];

export default function PlaygroundPage() {
  const [prompt, setPrompt] = useState("");
  const [selectedModels, setSelectedModels] = useState([
    "opencode/gemini-2.5-flash",
    "opencode/claude-3-5-haiku",
    "opencode/gpt-4o-mini",
  ]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({});

  const handleRunComparison = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setResults({});

    const promises = selectedModels.map(async (modelId) => {
      const startTime = Date.now();
      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: prompt,
            model: modelId,
            chatId: `playground:${Date.now()}`,
          }),
        });
        const latencyMs = Date.now() - startTime;
        const data = await res.json();
        const content = data.reply || data.content || "Sem resposta";
        const promptTokens = Math.max(1, Math.round(prompt.length / 4));
        const completionTokens = Math.max(1, Math.round(content.length / 4));

        return {
          modelId,
          content,
          latencyMs,
          promptTokens,
          completionTokens,
          cost: ((promptTokens * 0.00000015) + (completionTokens * 0.0000006)).toFixed(6),
        };
      } catch (err) {
        return { modelId, error: err.message, latencyMs: Date.now() - startTime };
      }
    });

    const resArray = await Promise.all(promises);
    const resultMap = {};
    resArray.forEach((r) => {
      resultMap[r.modelId] = r;
    });
    setResults(resultMap);
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-500 text-2xl">compare</span>
          <h1 className="text-2xl font-bold font-display text-text-main">Playground A/B — Comparação Lado a Lado</h1>
        </div>
        <p className="text-sm text-text-muted">
          Envie o mesmo prompt simultaneamente para múltiplos modelos de IA e compare latência, custo e qualidade de resposta.
        </p>
      </div>

      {/* Input de Prompt */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface/80 dark:bg-surface-2/80 p-5 shadow-soft backdrop-blur-md">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Escreva a instrução ou pergunta para testar em paralelo..."
          className="w-full min-h-[100px] resize-y rounded-xl border border-border bg-bg p-3 text-sm text-text-main placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text-muted">Modelos Selecionados:</span>
            {AVAILABLE_MODELS.map((m) => {
              const isSelected = selectedModels.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    if (isSelected) {
                      if (selectedModels.length > 1) setSelectedModels(selectedModels.filter((id) => id !== m.id));
                    } else {
                      if (selectedModels.length < 3) setSelectedModels([...selectedModels, m.id]);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                    isSelected
                      ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/50"
                      : "bg-bg text-text-muted border-border hover:border-text-muted"
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleRunComparison}
            disabled={loading || !prompt.trim()}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 transition-all"
          >
            <span className={`material-symbols-outlined text-lg ${loading ? "animate-spin" : ""}`}>
              {loading ? "sync" : "bolt"}
            </span>
            <span>{loading ? "Processando..." : "Comparar Respostas"}</span>
          </button>
        </div>
      </div>

      {/* Grid de Respostas Comparativas */}
      <div className={`grid grid-cols-1 ${GRID_COLS_CLASS[selectedModels.length] || "md:grid-cols-1"} gap-4`}>
        {selectedModels.map((modelId) => {
          const modelInfo = AVAILABLE_MODELS.find((m) => m.id === modelId) || { name: modelId, provider: "IA" };
          const res = results[modelId];

          return (
            <div
              key={modelId}
              className="flex flex-col rounded-2xl border border-border bg-surface dark:bg-surface-2 p-4 shadow-soft min-h-[350px]"
            >
              {/* Header do Card */}
              <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-3">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-text-main">{modelInfo.name}</span>
                  <span className="text-[11px] text-text-muted">{modelInfo.provider}</span>
                </div>
                {res && !res.error && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                    ⏱️ {res.latencyMs}ms
                  </span>
                )}
              </div>

              {/* Corpo da Resposta */}
              <div className="flex-1 text-xs leading-relaxed text-text-main overflow-y-auto max-h-[400px] whitespace-pre-wrap">
                {loading && !res ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-2 text-text-muted">
                    <span className="material-symbols-outlined animate-spin text-2xl text-amber-500">sync</span>
                    <span>Aguardando modelo...</span>
                  </div>
                ) : res ? (
                  res.error ? (
                    <div className="text-danger p-2 bg-danger/10 rounded-lg">❌ {res.error}</div>
                  ) : (
                    res.content
                  )
                ) : (
                  <span className="text-text-muted italic">Clique em &quot;Comparar Respostas&quot; para iniciar.</span>
                )}
              </div>

              {/* Footer com Telemetria */}
              {res && !res.error && (
                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] font-mono text-text-muted">
                  <span>📥 {res.promptTokens}t | 📤 {res.completionTokens}t</span>
                  <span className="text-amber-500 font-semibold">${res.cost}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
