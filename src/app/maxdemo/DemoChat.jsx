"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SCENARIOS, DEFAULT_SCENARIO } from "./scenarios";

function nowLabel() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 rounded-2xl bg-white/95 px-4 py-3 shadow-sm">
      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0.3s]" />
    </div>
  );
}

export default function DemoChat() {
  const [scenarioId, setScenarioId] = useState(DEFAULT_SCENARIO);
  const scenario = SCENARIOS[scenarioId];
  const [messages, setMessages] = useState(scenario.initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  const switchScenario = (id) => {
    setScenarioId(id);
    setMessages(SCENARIOS[id].initialMessages);
    setError(null);
    setInput("");
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = useCallback(
    async (raw) => {
      const text = String(raw || "").trim();
      if (!text || loading) return;

      const nextMessages = [...messages, { role: "user", content: text }];
      setMessages(nextMessages);
      setInput("");
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/maxdemo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenario: scenarioId,
            messages: nextMessages,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

        // Delay artificial de "pensando" (200-500ms) pra ficar orgânico —
        // grande parte do valor visual é o typing indicator aparecendo.
        await new Promise((r) => setTimeout(r, 250));

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, scenarioId]
  );

  const suggested = SCENARIOS[scenarioId].suggestedReplies || [];

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Seletor de cenário */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {Object.values(SCENARIOS).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => switchScenario(s.id)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
              scenarioId === s.id
                ? "border-brand-500 bg-brand-500 text-white shadow-soft"
                : "border-border bg-surface text-text-muted hover:border-brand-400 hover:text-text-main"
            }`}
          >
            <span className="mr-1.5">{s.emoji}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Frame do celular */}
      <div className="relative w-full max-w-[380px] rounded-[36px] border-[10px] border-gray-900 bg-gray-900 shadow-elev">
        {/* Notch */}
        <div className="absolute left-1/2 top-0 z-20 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-gray-900" />

        <div className="relative overflow-hidden rounded-[26px]">
          {/* Header WhatsApp */}
          <div className="flex items-center gap-3 bg-[#075E54] px-4 pt-8 pb-3 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-lg font-bold">
              {scenario.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-[15px] font-semibold">
                {scenario.clinicName}
              </p>
              <p className="text-[11px] text-white/80">
                {loading ? "digitando…" : "online agora"}
              </p>
            </div>
            <div className="flex items-center gap-3 text-white/90">
              <span className="material-symbols-outlined text-[18px]">
                videocam
              </span>
              <span className="material-symbols-outlined text-[18px]">
                call
              </span>
            </div>
          </div>

          {/* Fundo com padrão WhatsApp */}
          <div
            ref={scrollRef}
            className="h-[440px] overflow-y-auto bg-[#ECE5DD] px-3 py-4"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d9d0c1' fill-opacity='0.3'%3E%3Ccircle cx='30' cy='30' r='1.5'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
            }}
          >
            <div className="flex flex-col gap-2">
              {/* Marcador de data */}
              <div className="my-2 flex justify-center">
                <span className="rounded-md bg-white/80 px-3 py-1 text-[10px] font-medium text-gray-600 shadow-sm">
                  HOJE
                </span>
              </div>

              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13.5px] leading-snug shadow-sm ${
                      m.role === "user"
                        ? "rounded-tr-md bg-[#DCF8C6] text-gray-900"
                        : "rounded-tl-md bg-white text-gray-900"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {m.content}
                    </p>
                    <p className="mt-1 text-right text-[10px] text-gray-500">
                      {nowLabel()}
                      {m.role === "user" && (
                        <span className="ml-1 text-[#53BDEB]">✓✓</span>
                      )}
                    </p>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <TypingIndicator />
                </div>
              )}

              {error && (
                <div className="flex justify-center">
                  <span className="rounded-md bg-red-100 px-3 py-1 text-[11px] text-red-700">
                    {error}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Sugestões rápidas + input */}
          <div className="border-t border-gray-200 bg-[#F0F0F0]">
            {suggested.length > 0 && messages.length <= 3 && !loading && (
              <div className="flex gap-2 overflow-x-auto px-3 pt-2 pb-1">
                {suggested.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => send(s)}
                    className="shrink-0 rounded-full border border-gray-300 bg-white px-3 py-1 text-[11px] text-gray-700 hover:border-brand-500 hover:text-brand-600"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2 px-3 py-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Digite uma mensagem..."
                disabled={loading}
                className="flex-1 rounded-full bg-white px-4 py-2 text-[13px] text-gray-900 shadow-sm outline-none placeholder:text-gray-400 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-white shadow-soft transition-all hover:bg-brand-600 disabled:opacity-40"
                aria-label="Enviar"
              >
                <span className="material-symbols-outlined text-[18px]">
                  send
                </span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Reset */}
      <button
        type="button"
        onClick={() => setMessages(SCENARIOS[scenarioId].initialMessages)}
        className="text-xs text-text-muted underline-offset-4 hover:text-brand-500 hover:underline"
      >
        Reiniciar conversa
      </button>
    </div>
  );
}
