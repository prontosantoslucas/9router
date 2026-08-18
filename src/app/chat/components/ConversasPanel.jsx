"use client";

// Painel lateral recolhível com as conversas dos canais (WhatsApp e Telegram).

import { useState, useEffect, useCallback, useRef } from "react";
import { RascunhosAba } from "./RascunhosAba";

const INTERVALO_MS = 15000;

function parseData(iso) {
  if (!iso) return null;
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatarDataLista(iso) {
  const d = parseData(iso);
  if (!d) return "";
  const agora = new Date();
  const diffDias = Math.floor((agora - d) / (1000 * 60 * 60 * 24));
  const hora = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (agora.toDateString() === d.toDateString()) {
    return hora;
  }
  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  if (ontem.toDateString() === d.toDateString()) {
    return "Ontem";
  }
  if (diffDias < 7) {
    const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return `${diasSemana[d.getDay()]} ${hora}`;
  }
  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
}

function formatarDataMensagem(iso) {
  const d = parseData(iso);
  if (!d) return "";
  const agora = new Date();
  const hora = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (agora.toDateString() === d.toDateString()) {
    return hora;
  }
  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  if (ontem.toDateString() === d.toDateString()) {
    return `Ontem, ${hora}`;
  }
  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return `${diasSemana[d.getDay()]}, ${d.toLocaleDateString([], { day: "2-digit", month: "2-digit" })} ${hora}`;
}

function obterTituloData(iso) {
  const d = parseData(iso);
  if (!d) return "";
  const agora = new Date();
  if (agora.toDateString() === d.toDateString()) {
    return "Hoje";
  }
  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  if (ontem.toDateString() === d.toDateString()) {
    return "Ontem";
  }
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

const ICONE_CANAL = { whatsapp: "chat", telegram: "send" };

export function ConversasPanel({ aberto, onFechar, onPedirAoAgente }) {
  const [aba, setAba] = useState("conversas");
  const [conversas, setConversas] = useState([]);
  const [selecionada, setSelecionada] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [rascunho, setRascunho] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [erroLista, setErroLista] = useState(null);
  const fimRef = useRef(null);

  const buscarConversas = useCallback(async () => {
    const res = await fetch("/api/agent/channels/conversations?limit=40");
    if (!res.ok) throw new Error(`o agente respondeu ${res.status}`);
    const d = await res.json();
    return d.conversas || [];
  }, []);

  // Lista: recarrega em intervalo enquanto o painel está aberto.
  useEffect(() => {
    if (!aberto || aba !== "conversas") return;
    let vivo = true;
    const carregar = () => {
      buscarConversas()
        .then((c) => { if (vivo) { setConversas(c); setErroLista(null); } })
        .catch((e) => { if (vivo) setErroLista(e.message); });
    };
    carregar();
    const t = setInterval(carregar, INTERVALO_MS);
    return () => { vivo = false; clearInterval(t); };
  }, [aberto, aba, buscarConversas]);

  const abrirConversa = useCallback(async (c) => {
    setSelecionada(c);
    setMensagens([]);
    setErro(null);
    try {
      const q = new URLSearchParams({ channel: c.channel, chatId: c.chatId, marcarLida: "1", limit: "60" });
      const res = await fetch(`/api/agent/channels/conversations/messages?${q}`);
      if (!res.ok) throw new Error(`não consegui abrir a conversa (${res.status})`);
      const d = await res.json();
      setMensagens(d.mensagens || []);
      setConversas((prev) => prev.map((x) => (x.chatId === c.chatId ? { ...x, naoLidas: 0 } : x)));
    } catch (e) {
      setErro(e.message);
    }
  }, []);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  const enviar = async () => {
    const texto = rascunho.trim();
    if (!texto || !selecionada || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch("/api/agent/channels/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: selecionada.channel, chatId: selecionada.chatId, texto }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) throw new Error(d.error || `falha ao enviar (${res.status})`);

      setRascunho("");
      // Recarrega o histórico da conversa para exibir a mensagem enviada
      const q = new URLSearchParams({ channel: selecionada.channel, chatId: selecionada.chatId, limit: "60" });
      const r = await fetch(`/api/agent/channels/conversations/messages?${q}`);
      if (r.ok) {
        const data = await r.json();
        setMensagens(data.mensagens || []);
      }
      buscarConversas().then(setConversas).catch(() => {});
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const pedirAcaoAoAgente = (prompt) => {
    if (!onPedirAoAgente) return;
    onPedirAoAgente(prompt);
  };

  if (!aberto) return null;

  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-border bg-surface shadow-2xl sm:w-[380px] dark:bg-surface"
      aria-label="Conversas dos canais"
    >
      {/* ── Header ── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="material-symbols-outlined text-brand-500">forum</span>
          <h2 className="truncate text-sm font-bold text-text-main">
            {selecionada ? selecionada.nome || selecionada.chatId : "Canais de Atendimento"}
          </h2>
          {selecionada && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-text-muted">
              <span className="material-symbols-outlined text-xs text-brand-500">
                {ICONE_CANAL[selecionada.channel] || "chat"}
              </span>
              <span className="capitalize">{selecionada.channel}</span>
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {selecionada && (
            <button
              type="button"
              onClick={() => { setSelecionada(null); setMensagens([]); setErro(null); }}
              className="flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text-main"
              title="Voltar para a lista"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
          )}
          <button
            type="button"
            onClick={onFechar}
            className="flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text-main"
            title="Recolher painel"
          >
            <span className="material-symbols-outlined text-[18px]">right_panel_close</span>
          </button>
        </div>
      </header>

      {/* Abas: conversas e rascunhos de abordagem. */}
      <div className="flex shrink-0 border-b border-border">
        {[
          ["conversas", "Conversas"],
          ["rascunhos", "Rascunhos"],
        ].map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => { setAba(v); setSelecionada(null); }}
            className={`flex-1 px-3 py-2 text-[11px] font-bold transition-colors ${
              aba === v
                ? "border-b-2 border-brand-500 text-text-main"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* ── Rascunhos de abordagem ── */}
      {aba === "rascunhos" ? (
        <RascunhosAba />
      ) : !selecionada ? (
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
          <p className="border-b border-border/60 px-3 py-2 text-[10px] uppercase tracking-wide text-text-muted">
            Somente conversas diretas registradas
          </p>

          {erroLista ? (
            <div className="p-3 text-xs text-danger">
              Não consegui carregar: {erroLista}
              <p className="mt-1 text-text-muted">
                A lista vem do agente (porta 3717). Sem ele no ar, esta aba fica vazia.
              </p>
            </div>
          ) : conversas.length === 0 ? (
            <p className="p-4 text-center text-xs text-text-muted">
              Nenhuma conversa direta registrada ainda. Elas aparecem aqui conforme as mensagens chegam.
            </p>
          ) : (
            <ul className="divide-y divide-border/50">
              {conversas.map((c) => (
                <li key={`${c.channel}:${c.chatId}`}>
                  <button
                    type="button"
                    onClick={() => abrirConversa(c)}
                    className="flex w-full flex-col gap-1 px-3 py-2.5 text-left hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="material-symbols-outlined text-xs text-brand-500">
                          {ICONE_CANAL[c.channel] || "chat"}
                        </span>
                        <span className="truncate text-xs font-bold text-text-main">{c.nome}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {c.naoLidas > 0 && (
                          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
                            {c.naoLidas}
                          </span>
                        )}
                        <span className="text-[10px] text-text-muted font-medium">{formatarDataLista(c.em)}</span>
                      </span>
                    </div>
                    <span className="line-clamp-1 text-[11px] text-text-muted">
                      {c.ultimaDirecao === "out" ? "Você: " : ""}{c.ultimaMensagem}
                    </span>
                    {!c.podeResponder && (
                      <span className="text-[10px] text-warning">sem alvo de resposta registrado</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          {/* ── Thread ── */}
          <div className="custom-scrollbar min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3 bg-bg-alt/30">
            {mensagens.length === 0 ? (
              <p className="py-4 text-center text-xs text-text-muted">Sem mensagens nesta conversa.</p>
            ) : (
              mensagens.map((m, idx) => {
                const dataAtual = parseData(m.em)?.toDateString();
                const dataAnterior = idx > 0 ? parseData(mensagens[idx - 1].em)?.toDateString() : null;
                const mostrarDivisor = dataAtual !== dataAnterior;

                return (
                  <div key={m.id} className="space-y-2">
                    {mostrarDivisor && (
                      <div className="flex items-center justify-center my-3">
                        <span className="px-2.5 py-0.5 rounded-full bg-surface border border-border text-[10px] font-semibold text-text-muted capitalize shadow-xs">
                          {obterTituloData(m.em)}
                        </span>
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-xs shadow-soft ${
                        m.direcao === "out"
                          ? "ml-auto bg-brand-500/15 text-text-main border border-brand-500/30"
                          : "mr-auto bg-surface text-text-main border border-border"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{m.texto}</p>
                      <span className="mt-1 block text-right text-[9px] text-text-muted font-medium">
                        {formatarDataMensagem(m.em)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={fimRef} />
          </div>

          {/* ── Envio direto ── */}
          <div className="shrink-0 space-y-2 border-t border-border p-3 bg-surface">
            {erro && (
              <p className="rounded-lg border border-danger/40 bg-danger/5 p-2 text-[11px] text-danger">
                {erro}
              </p>
            )}

            <div className="flex items-end gap-2">
              <textarea
                value={rascunho}
                onChange={(e) => setRascunho(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
                }}
                rows={2}
                disabled={!selecionada.podeResponder || enviando}
                placeholder={
                  selecionada.podeResponder
                    ? "Mensagem (Enter envia, Shift+Enter quebra linha)"
                    : "Esta conversa não tem alvo de resposta registrado"
                }
                className="custom-scrollbar min-h-[50px] flex-1 resize-none rounded-xl border border-border bg-surface-2 p-2.5 text-xs text-text-main placeholder-text-muted focus:border-brand-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={enviar}
                disabled={!rascunho.trim() || !selecionada.podeResponder || enviando}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-soft transition-opacity hover:opacity-90 disabled:opacity-40"
                title="Enviar mensagem direta"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {enviando ? "sync" : "send"}
                </span>
              </button>
            </div>

            {/* Ações rápidas com o Agente */}
            <div className="flex items-center justify-between pt-1 text-[11px] text-text-muted">
              <button
                type="button"
                onClick={() => pedirAcaoAoAgente(`Resuma as últimas mensagens da conversa com ${selecionada.nome || selecionada.chatId} no ${selecionada.channel} e me diga se há algo pendente de resposta.`)}
                className="hover:text-brand-500 hover:underline"
              >
                Pedir resumo ao Lucas
              </button>
              <button
                type="button"
                onClick={() => pedirAcaoAoAgente(`Sugira uma resposta para a conversa com ${selecionada.nome || selecionada.chatId} no ${selecionada.channel}.`)}
                className="hover:text-brand-500 hover:underline"
              >
                Sugerir resposta
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
