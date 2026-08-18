"use client";

// Aba de rascunhos de abordagem: aprovar, enviar na mão, ou deixar o
// despachante enviar em ritmo controlado.
//
// ────────────────────────────────────────────────────────────────
// O QUE ESTA TELA DEIXA CLARO, DE PROPÓSITO
//
// Auto-envio não é "manda tudo": é uma fila que sai UMA mensagem por vez,
// respeitando intervalo mínimo, teto diário e janela de horário. Para WhatsApp
// em número pessoal (não oficial), rajada é o padrão que a plataforma usa para
// marcar spam — e o custo do erro é o número banido, não a mensagem perdida.
//
// Por isso o cabeçalho mostra sempre quanto já saiu hoje contra o teto, e
// quando está bloqueado mostra O MOTIVO. "Não enviou" sem causa visível foi o
// que já custou tempo demais neste sistema.
// ────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";

const INTERVALO_MS = 20000;

export function RascunhosAba() {
  const [rascunhos, setRascunhos] = useState([]);
  const [status, setStatus] = useState(null);
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [filtro, setFiltro] = useState("draft");
  const [config, setConfig] = useState(false);

  const carregar = useCallback((status_) => {
    return fetch(`/api/agent/prospector/drafts?status=${status_}&limit=60`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`o agente respondeu ${r.status}`))))
      .then((d) => { setRascunhos(d.rascunhos || []); setStatus(d.status || null); setErro(null); })
      .catch((e) => setErro(e.message));
  }, []);

  useEffect(() => {
    let vivo = true;
    const tick = () => { if (vivo) carregar(filtro); };
    tick();
    const t = setInterval(tick, INTERVALO_MS);
    return () => { vivo = false; clearInterval(t); };
  }, [carregar, filtro]);

  const acao = async (id, rota, rotulo) => {
    setOcupado(id);
    setAviso(null);
    try {
      const res = await fetch(`/api/agent/prospector/drafts/${id}/${rota}`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.ok === false) throw new Error(d.error || `falha em ${rotulo} (${res.status})`);
      setAviso({ tipo: "ok", texto: rota === "send" ? `Enviado para ${d.para || "o lead"}.` : `${rotulo} feito.` });
      await carregar(filtro);
    } catch (e) {
      // O motivo do bloqueio é a informação útil (teto, intervalo, janela).
      setAviso({ tipo: "erro", texto: e.message });
    } finally {
      setOcupado(null);
    }
  };

  const salvarConfig = async (patch) => {
    try {
      const res = await fetch("/api/agent/prospector/dispatcher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "falha ao salvar");
      await carregar(filtro);
      setAviso({ tipo: "ok", texto: "Limites atualizados." });
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message });
    }
  };

  const wa = status?.canais?.whatsapp;
  const c = status?.config;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Ritmo e teto: sempre visível, com motivo quando bloqueado. */}
      <div className="shrink-0 space-y-1.5 border-b border-border/60 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wide text-text-muted">Ritmo de envio</span>
          <button
            type="button"
            onClick={() => setConfig((v) => !v)}
            className="text-[10px] font-semibold text-brand-500 hover:underline"
          >
            {config ? "fechar" : "limites"}
          </button>
        </div>

        {wa ? (
          <>
            <p className="text-[11px] text-text-main">
              WhatsApp hoje: <strong>{wa.enviadosHoje}/{wa.cap}</strong>
              {" · "}fila {wa.naFila}
              {" · "}rascunhos {wa.rascunhos}
            </p>
            <p className={`text-[10px] ${wa.pode ? "text-text-muted" : "text-warning"}`}>
              {wa.pode
                ? `Liberado. Intervalo de ${c?.intervalo_seg}s entre mensagens, janela ${c?.hora_inicio}h-${c?.hora_fim}h.`
                : `Bloqueado: ${wa.motivo}`}
            </p>
            {!status.rodando && (
              // Fila cheia com despachante parado é o caso em que nada sai e
              // ninguém entende por quê.
              <p className="text-[10px] text-warning">
                O despachante não está rodando — a fila não anda sozinha. Use “Enviar” para mandar na mão.
              </p>
            )}
          </>
        ) : (
          <p className="text-[11px] text-text-muted">Sem dados do despachante.</p>
        )}

        {config && c && (
          <div className="grid grid-cols-2 gap-2 rounded-md border border-border/60 p-2">
            <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
              Teto por dia
              <input
                type="number" min={1} max={200} defaultValue={c.cap_diario}
                onBlur={(e) => salvarConfig({ cap_diario: Number(e.target.value) })}
                className="h-7 rounded border border-border bg-surface px-1.5 text-xs text-text-main"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
              Intervalo (s)
              <input
                type="number" min={30} max={3600} defaultValue={c.intervalo_seg}
                onBlur={(e) => salvarConfig({ intervalo_seg: Number(e.target.value) })}
                className="h-7 rounded border border-border bg-surface px-1.5 text-xs text-text-main"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
              Início (h)
              <input
                type="number" min={0} max={23} defaultValue={c.hora_inicio}
                onBlur={(e) => salvarConfig({ hora_inicio: Number(e.target.value) })}
                className="h-7 rounded border border-border bg-surface px-1.5 text-xs text-text-main"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
              Fim (h)
              <input
                type="number" min={1} max={24} defaultValue={c.hora_fim}
                onBlur={(e) => salvarConfig({ hora_fim: Number(e.target.value) })}
                className="h-7 rounded border border-border bg-surface px-1.5 text-xs text-text-main"
              />
            </label>
            <label className="col-span-2 flex items-center gap-2 text-[10px] text-text-muted">
              <input
                type="checkbox" defaultChecked={!!c.domingo}
                onChange={(e) => salvarConfig({ domingo: e.target.checked })}
              />
              Enviar também no domingo
            </label>
            <p className="col-span-2 text-[10px] text-text-muted">
              Mínimo de 30s entre mensagens é imposto pelo servidor — abaixo disso não é ritmo, é rajada.
            </p>
          </div>
        )}
      </div>

      {/* Filtro por estado da fila */}
      <div className="flex shrink-0 gap-1 border-b border-border/60 px-2 py-1.5">
        {[
          ["draft", "Rascunhos"],
          ["queued", "Na fila"],
          ["sent", "Enviados"],
          ["failed", "Falhas"],
        ].map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => setFiltro(v)}
            className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
              filtro === v ? "bg-brand-500 text-white" : "text-text-muted hover:bg-surface-2"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {aviso && (
        <p className={`mx-3 mt-2 shrink-0 rounded border p-2 text-[11px] ${
          aviso.tipo === "ok"
            ? "border-brand-500/40 bg-brand-500/5 text-text-main"
            : "border-danger/40 bg-danger/5 text-danger"
        }`}>
          {aviso.texto}
        </p>
      )}

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
        {erro ? (
          <p className="p-3 text-xs text-danger">Não consegui carregar: {erro}</p>
        ) : rascunhos.length === 0 ? (
          <p className="p-4 text-center text-xs text-text-muted">
            {filtro === "draft" ? "Nenhum rascunho aguardando." : "Nada aqui."}
          </p>
        ) : (
          <ul className="space-y-2">
            {rascunhos.map((r) => (
              <li key={r.id} className="rounded-lg border border-border/60 p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-text-main">{r.nome}</p>
                    <p className="truncate text-[10px] text-text-muted">
                      {r.canal} · {r.destino || "sem destino"}
                      {r.cidade ? ` · ${r.cidade}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[9px] uppercase text-text-muted">
                    {r.status}
                  </span>
                </div>

                <p className="mt-1.5 whitespace-pre-wrap break-words rounded bg-surface-2/60 p-1.5 text-[11px] text-text-main">
                  {r.mensagem}
                </p>
                {r.followup && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[10px] text-brand-500">
                      Toque 2 (só depois da resposta)
                    </summary>
                    <p className="mt-1 whitespace-pre-wrap break-words rounded bg-surface-2/40 p-1.5 text-[11px] text-text-muted">
                      {r.followup}
                    </p>
                  </details>
                )}
                {r.erro && <p className="mt-1 text-[10px] text-danger">Erro: {r.erro}</p>}

                {r.status !== "sent" && (
                  <div className="mt-1.5 flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => acao(r.id, "discard", "Descartar")}
                      disabled={ocupado === r.id}
                      className="rounded border border-border px-2 py-1 text-[10px] font-bold text-text-muted hover:border-danger hover:text-danger disabled:opacity-40"
                    >
                      Descartar
                    </button>
                    {r.status === "draft" && (
                      <button
                        type="button"
                        onClick={() => acao(r.id, "approve", "Aprovar")}
                        disabled={ocupado === r.id || !r.podeEnviar}
                        title="Entra na fila e sai no ritmo controlado"
                        className="rounded border border-border px-2 py-1 text-[10px] font-bold text-brand-500 hover:bg-brand-500/10 disabled:opacity-40"
                      >
                        Aprovar p/ fila
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => acao(r.id, "send", "Enviar")}
                      disabled={ocupado === r.id || !r.podeEnviar}
                      title={r.podeEnviar
                        ? "Envia agora. Dispensa a janela de horário, mas respeita o teto do dia e o intervalo."
                        : "Lead sem canal de contato"}
                      className="rounded bg-brand-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-brand-600 disabled:opacity-40"
                    >
                      {ocupado === r.id ? "..." : "Enviar"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
