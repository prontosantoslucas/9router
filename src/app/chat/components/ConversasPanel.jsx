"use client";

// Painel lateral recolhível com as conversas dos canais.
//
// ────────────────────────────────────────────────────────────────
// DUAS DECISÕES QUE MUDAM O COMPORTAMENTO
//
// 1. SÓ CONVERSAS DIRETAS. O endpoint filtra grupos, status/broadcast e
//    newsletter. Grupo no meio da lista é ruído, e o risco de responder no
//    grupo errado é real — especialmente com mensagem de prospecção.
//
// 2. "ENVIADO" SÓ QUANDO O CANAL CONFIRMA. O envio antigo do inbox apenas
//    preenchia um prompt no chat e dependia do agente decidir mandar. Aqui o
//    POST vai direto ao WhatsApp/Telegram, e se o canal não confirmar a
//    entrega, a mensagem aparece como ERRO com o motivo — nunca como enviada.
// ────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";

const INTERVALO_MS = 15000;

function horaCurta(iso) {
  if (!iso) return "";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const ICONE_CANAL = { whatsapp: "chat", telegram: "send" };

export function ConversasPanel({ aberto, onFechar, onPedirAoAgente }) {
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

  // Lista: recarrega em intervalo enquanto o painel está aberto. Fechado não
  // consulta — polling invisível só gasta bateria no celular.
  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    const carregar = () => {
      buscarConversas()
        .then((c) => { if (vivo) { setConversas(c); setErroLista(null); } })
        .catch((e) => { if (vivo) setErroLista(e.message); });
    };
    carregar();
    const t = setInterval(carregar, INTERVALO_MS);
    return () => { vivo = false; clearInterval(t); };
  }, [aberto, buscarConversas]);

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
      // Abrir marcou como lida no servidor; reflete na lista sem esperar o tick.
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
      // Otimista só DEPOIS da confirmação do canal.
      setMensagens((prev) => [...prev, {
        id: `tmp${Date.now()}`, de: "Você", texto, direcao: "out", em: new Date().toISOString(),
      }]);
      setConversas((prev) => prev.map((x) => (
        x.chatId === selecionada.chatId ? { ...x, ultimaMensagem: texto, ultimaDirecao: "out" } : x
      )));
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  if (!aberto) return null;

  const totalNaoLidas = conversas.reduce((s, c) => s + (c.naoLidas || 0), 0);

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-l border-border bg-surface md:w-[340px] dark:bg-surface-2">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="material-symbols-outlined text-base text-brand-500">forum</span>
          <h3 className="truncate text-sm font-bold">
            {selecionada ? selecionada.nome : "Conversas"}
          </h3>
          {!selecionada && totalNaoLidas > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
              {totalNaoLidas}
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

      {/* ── Lista de conversas ── */}
      {!selecionada ? (
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
          <p className="border-b border-border/60 px-3 py-2 text-[10px] uppercase tracking-wide text-text-muted">
            Somente conversas diretas — grupos ficam de fora
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
                    className="flex w-full flex-col gap-1 px-3 py-2.5 text-left hover:bg-surface-2"
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
                        <span className="text-[10px] text-text-muted">{horaCurta(c.em)}</span>
                      </span>
                    </div>
                    <span className="line-clamp-1 text-[11px] text-text-muted">
                      {c.ultimaDirecao === "out" ? "Você: " : ""}{c.ultimaMensagem}
                    </span>
                    {!c.podeResponder && (
                      // Diz por que o envio estará bloqueado, em vez de deixar
                      // o usuário descobrir digitando.
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
          <div className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {mensagens.length === 0 ? (
              <p className="py-4 text-center text-xs text-text-muted">Sem mensagens nesta conversa.</p>
            ) : (
              mensagens.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs ${
                    m.direcao === "out"
                      ? "ml-auto bg-brand-500/15 text-text-main"
                      : "mr-auto bg-surface-2 text-text-main"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                  <span className="mt-0.5 block text-right text-[9px] text-text-muted">{horaCurta(m.em)}</span>
                </div>
              ))
            )}
            <div ref={fimRef} />
          </div>

          {/* ── Envio direto ── */}
          <div className="shrink-0 space-y-2 border-t border-border p-3">
            {erro && (
              <p className="rounded border border-danger/40 bg-danger/5 p-2 text-[11px] text-danger">
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
                className="min-h-[38px] flex-1 resize-none rounded-md border border-border bg-surface px-2 py-1.5 text-xs disabled:opacity-50"
              />
              <button
                type="button"
                onClick={enviar}
                disabled={!rascunho.trim() || !selecionada.podeResponder || enviando}
                className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40"
                title="Enviar direto no canal"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {enviando ? "sync" : "send"}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => onPedirAoAgente?.(
                `Escreva uma resposta para ${selecionada.nome} no ${selecionada.channel}. Última mensagem recebida: "${
                  mensagens.filter((m) => m.direcao === "in").at(-1)?.texto || "(sem mensagem recebida)"
                }". Devolva só o texto da mensagem, que eu reviso antes de enviar.`
              )}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-[11px] font-semibold text-text-muted hover:border-brand-500 hover:text-text-main"
              title="O agente escreve o texto no chat; você revisa e envia daqui"
            >
              <span className="material-symbols-outlined text-sm text-brand-500">auto_fix_high</span>
              Pedir ao agente para escrever
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
