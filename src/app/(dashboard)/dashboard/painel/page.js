"use client";

// Painel de hábitos, humor, metas e aprendizado.
//
// Princípio que governa toda a tela: NADA aqui é estimado. Cada número vem de
// um registro explícito, e a ausência de registro aparece como "—" e não como
// zero. Um painel que mostra 0 onde não houve medição transforma falta de dado
// em mau desempenho, e a pessoa passa a desconfiar da tela inteira.
//
// Os dados vêm de um único GET (/api/agent/painel), que agrega no lado do
// agente. Cada seção carrega o próprio erro: inglês quebrado não apaga hábitos.

import { useState, useEffect, useCallback } from "react";
import { Card, Badge, Button } from "@/shared/components";

const HUMOR_ROTULOS = { 1: "muito ruim", 2: "ruim", 3: "neutro", 4: "bom", 5: "muito bom" };

// Escala em degradê: humor baixo em vermelho, alto em verde. Cinza é ausência
// de registro — visualmente distinto dos dois extremos, de propósito.
const HUMOR_CORES = {
  1: "bg-red-500", 2: "bg-orange-400", 3: "bg-yellow-400", 4: "bg-lime-500", 5: "bg-emerald-500",
};
const ESTADO_CORES = {
  feito: "bg-emerald-500",
  falhou: "bg-red-500/70",
  sem_registro: "bg-border/60",
};

function Vazio({ children }) {
  return <p className="text-sm text-text-muted italic">{children}</p>;
}

function Metrica({ label, valor, sufixo = "", hint = null }) {
  // valor null → "—". É a regra da tela: não medido nunca vira zero.
  const vazio = valor == null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-text-muted">{label}</span>
      <span className={`text-xl font-semibold ${vazio ? "text-text-muted" : ""}`}>
        {vazio ? "—" : valor}
        {!vazio && sufixo ? <span className="text-sm font-normal text-text-muted">{sufixo}</span> : null}
      </span>
      {hint ? <span className="text-[11px] text-text-muted">{hint}</span> : null}
    </div>
  );
}

function SecaoErro({ secao, nome }) {
  if (secao?.ok !== false) return null;
  return (
    <Card className="p-4 border-red-500/40">
      <p className="text-sm text-red-400">
        A seção {nome} falhou: {secao.erro}
      </p>
    </Card>
  );
}

// Grade de 30 dias. Um quadradinho por dia, com title para o dia exato —
// gráfico sem rótulo obriga a adivinhar qual dia é qual.
function Grade({ serie, corDe }) {
  return (
    <div className="flex flex-wrap gap-1">
      {serie.map((d) => (
        <div
          key={d.ymd}
          title={`${d.ymd}: ${corDe.rotulo(d)}`}
          className={`h-3.5 w-3.5 rounded-sm ${corDe.classe(d)}`}
        />
      ))}
    </div>
  );
}

export default function PainelPage() {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(null);
  const [novoHabito, setNovoHabito] = useState("");
  const [tipoNovo, setTipoNovo] = useState("diario");
  const [metaNova, setMetaNova] = useState(3);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/painel?dias=30");
      if (!res.ok) throw new Error(`o agente respondeu ${res.status}`);
      setDados(await res.json());
      setErro(null);
    } catch (e) {
      // Mostra o motivo: "não carregou" sem causa não permite agir.
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function acao(fn, chave) {
    setSalvando(chave);
    try { await fn(); await carregar(); } finally { setSalvando(null); }
  }

  const marcar = (id, feito) => acao(async () => {
    await fetch(`/api/agent/habitos/${id}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feito }),
    });
  }, `h${id}`);

  const registrarHumor = (score) => acao(async () => {
    await fetch("/api/agent/humor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score }),
    });
  }, `m${score}`);

  const criarHabito = () => acao(async () => {
    if (!novoHabito.trim()) return;
    await fetch("/api/agent/habitos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: novoHabito.trim(),
        tipo: tipoNovo,
        meta_semanal: tipoNovo === "semanal" ? Number(metaNova) : null,
      }),
    });
    setNovoHabito("");
  }, "novo");

  if (carregando) return <div className="p-6 text-text-muted">Carregando o painel…</div>;

  if (erro) {
    return (
      <div className="p-6">
        <Card className="p-4 border-red-500/40">
          <p className="text-sm text-red-400">Não consegui carregar o painel: {erro}</p>
          <p className="mt-1 text-xs text-text-muted">
            O painel lê do agente (porta 3717). Se ele não estiver rodando, esta tela fica vazia — sem dado inventado.
          </p>
          <Button className="mt-3" onClick={carregar}>Tentar de novo</Button>
        </Card>
      </div>
    );
  }

  const habitos = dados.habitos?.dados || [];
  const humor = dados.humor?.dados;
  const metas = dados.metas?.dados;
  const ap = dados.aprendizado?.dados;
  const neg = dados.negocio?.dados;
  const humorHoje = humor?.serie?.find((s) => s.ymd === dados.hoje)?.score ?? null;

  return (
    <div className="p-4 lg:p-6 flex flex-col gap-5 max-w-6xl">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Painel</h1>
          <p className="text-sm text-text-muted">
            Hábitos, humor, metas e aprendizado — janela de {dados.janela_dias} dias. Hoje: {dados.hoje}.
          </p>
        </div>
        <Button variant="secondary" onClick={carregar}>Atualizar</Button>
      </div>

      {/* ── Humor ── */}
      <SecaoErro secao={dados.humor} nome="humor" />
      {humor ? (
        <Card className="p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold">Mapa de humor</h2>
            {humor.tendencia ? (
              <Badge variant={humor.tendencia === "melhorando" ? "success" : humor.tendencia === "piorando" ? "error" : "default"}>
                {humor.tendencia}
              </Badge>
            ) : (
              // Sem dado nas duas metades da janela, não há tendência — dizer
              // "estável" aqui seria afirmar o que não se mediu.
              <span className="text-xs text-text-muted">tendência indisponível: falta registro em uma das metades</span>
            )}
          </div>

          <div className="flex gap-6 flex-wrap">
            <Metrica label="Média" valor={humor.media} sufixo="/5" />
            <Metrica label="Dias registrados" valor={humor.dias_registrados} sufixo={`/${dados.janela_dias}`} />
            <Metrica label="Sem registro" valor={humor.dias_sem_registro} />
          </div>

          <Grade
            serie={humor.serie}
            corDe={{
              classe: (d) => (d.score ? HUMOR_CORES[d.score] : "bg-border/60"),
              rotulo: (d) => (d.score ? `${d.score}/5 ${HUMOR_ROTULOS[d.score]}${d.nota ? ` — ${d.nota}` : ""}` : "sem registro"),
            }}
          />

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-text-muted">
              {humorHoje ? `Hoje: ${humorHoje}/5 (${HUMOR_ROTULOS[humorHoje]}).` : "Como foi hoje?"}
            </span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => registrarHumor(n)}
                disabled={salvando === `m${n}`}
                title={HUMOR_ROTULOS[n]}
                className={`h-8 w-8 rounded-md text-sm font-medium transition ${
                  humorHoje === n ? "ring-2 ring-primary " : ""
                }${HUMOR_CORES[n]} text-white disabled:opacity-50`}
              >
                {n}
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      {/* ── Hábitos ── */}
      <SecaoErro secao={dados.habitos} nome="hábitos" />
      <Card className="p-4 flex flex-col gap-4">
        <h2 className="font-semibold">Hábitos</h2>

        {habitos.length === 0 ? (
          <Vazio>Nenhum hábito cadastrado. Crie o primeiro abaixo.</Vazio>
        ) : (
          <div className="flex flex-col divide-y divide-border/60">
            {habitos.map((h) => (
              <div key={h.id} className="py-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{h.nome}</span>
                    {h.tipo === "semanal" ? (
                      <Badge variant="default">{h.na_semana}/{h.meta_semanal} na semana</Badge>
                    ) : (
                      <Badge variant={h.streak > 0 ? "success" : "default"}>
                        {h.streak} dia{h.streak === 1 ? "" : "s"} seguidos
                      </Badge>
                    )}
                    {h.tipo === "diario" && h.melhor_streak > h.streak ? (
                      <span className="text-xs text-text-muted">melhor: {h.melhor_streak}</span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    {h.hoje === "sem_registro" ? (
                      <>
                        {/* Dois botões, não um toggle: "não fiz" é um registro
                            com valor, e é o que distingue falha de silêncio. */}
                        <Button size="sm" disabled={salvando === `h${h.id}`} onClick={() => marcar(h.id, true)}>Fiz hoje</Button>
                        <Button size="sm" variant="secondary" disabled={salvando === `h${h.id}`} onClick={() => marcar(h.id, false)}>Não fiz</Button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant={h.hoje === "feito" ? "success" : "error"}>
                          {h.hoje === "feito" ? "feito hoje" : "não feito hoje"}
                        </Badge>
                        <button
                          className="text-xs text-text-muted underline"
                          disabled={salvando === `h${h.id}`}
                          onClick={() => marcar(h.id, h.hoje !== "feito")}
                        >
                          corrigir
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <Grade
                  serie={h.serie}
                  corDe={{
                    classe: (d) => ESTADO_CORES[d.estado],
                    rotulo: (d) => (d.estado === "feito" ? "feito" : d.estado === "falhou" ? "não feito" : "sem registro"),
                  }}
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 flex-wrap pt-2 border-t border-border/60">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Novo hábito</label>
            <input
              value={novoHabito}
              onChange={(e) => setNovoHabito(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && criarHabito()}
              placeholder="Ex.: ler 20 min"
              className="h-9 px-3 rounded-md bg-surface border border-border text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Frequência</label>
            <select
              value={tipoNovo}
              onChange={(e) => setTipoNovo(e.target.value)}
              className="h-9 px-2 rounded-md bg-surface border border-border text-sm"
            >
              <option value="diario">Diário</option>
              <option value="semanal">Semanal</option>
            </select>
          </div>
          {tipoNovo === "semanal" ? (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted">Vezes/semana</label>
              <input
                type="number" min={1} max={7}
                value={metaNova}
                onChange={(e) => setMetaNova(e.target.value)}
                className="h-9 w-20 px-2 rounded-md bg-surface border border-border text-sm"
              />
            </div>
          ) : null}
          <Button disabled={!novoHabito.trim() || salvando === "novo"} onClick={criarHabito}>Adicionar</Button>
        </div>
      </Card>

      {/* ── Metas e compromissos ── */}
      <SecaoErro secao={dados.metas} nome="metas" />
      {metas ? (
        <Card className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Metas e compromissos</h2>
            <span className="text-xs text-text-muted">{metas.fechados_7d.length} fechada(s) nos últimos 7 dias</span>
          </div>
          {metas.abertos.length === 0 ? (
            <Vazio>Nenhum compromisso aberto. O agente registra os que você assume na conversa.</Vazio>
          ) : (
            <ul className="flex flex-col gap-2">
              {metas.abertos.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>{c.texto}</span>
                  {c.prazo ? (
                    <Badge variant={c.atrasado ? "error" : "default"}>
                      {c.atrasado ? "atrasado desde " : "até "}{c.prazo}
                    </Badge>
                  ) : (
                    <span className="text-xs text-text-muted">sem prazo</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {/* ── Aprendizado ── */}
      <SecaoErro secao={dados.aprendizado} nome="aprendizado" />
      {ap ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4 flex flex-col gap-3">
            <h2 className="font-semibold">Inglês</h2>
            <div className="flex gap-6 flex-wrap">
              <Metrica label="Vocabulário" valor={ap.ingles.vocabulario} />
              <Metrica label="Consolidadas" valor={ap.ingles.consolidadas} hint="16 dias sem errar" />
              <Metrica label="Revisar hoje" valor={ap.ingles.para_revisar_hoje} />
              <Metrica label="Acerto (7d)" valor={ap.ingles.taxa_acerto_7d} sufixo="%" />
            </div>
            {ap.ingles.vocabulario === 0 ? (
              <Vazio>Nenhuma palavra cadastrada ainda — o vocabulário nasce das conversas de estudo.</Vazio>
            ) : null}
          </Card>

          <Card className="p-4 flex flex-col gap-3">
            <h2 className="font-semibold">Roadmap de 12 meses</h2>
            {ap.roadmap.inicio ? (
              <>
                <div className="text-sm">
                  Mês {ap.roadmap.mes} — <span className="font-medium">{ap.roadmap.modulo?.nome}</span>
                </div>
                <div className="flex gap-6 flex-wrap">
                  <Metrica label="Itens concluídos" valor={ap.roadmap.itens.feitos} sufixo={`/${ap.roadmap.itens.total}`} />
                  <Metrica label="Meta técnica (semana)" valor={ap.roadmap.semana.pctTecnico} sufixo="%" hint={`${ap.roadmap.semana.minTecnico} min`} />
                  <Metrica label="Meta inglês (semana)" valor={ap.roadmap.semana.pctIngles} sufixo="%" hint={`${ap.roadmap.semana.minIngles} min`} />
                </div>
              </>
            ) : (
              <Vazio>
                Falta a data de início do roadmap. Sem ela não é possível dizer em que mês você está — e
                chutar o mês 1 mostraria progresso que não existe.
              </Vazio>
            )}
            <div className="text-xs text-text-muted">
              Trilha espiritual:{" "}
              {ap.trilha_espiritual.length
                ? ap.trilha_espiritual.map((t) => `${t.trilha.replace("_", " ")} ${t.entregues}/${t.total}`).join(" · ")
                : "não iniciada"}
              {" · "}devocional em {ap.devocionais_7d} de 7 dias
            </div>
          </Card>
        </div>
      ) : null}

      {/* ── Negócio ── */}
      <SecaoErro secao={dados.negocio} nome="negócio" />
      {neg && neg.leads_7d != null ? (
        <Card className="p-4 flex flex-col gap-3">
          <h2 className="font-semibold">Prospecção (7 dias)</h2>
          <div className="flex gap-6 flex-wrap">
            <Metrica
              label="Leads"
              valor={neg.leads_7d}
              hint={neg.leads_7d_anterior != null ? `semana anterior: ${neg.leads_7d_anterior}` : null}
            />
            <Metrica label="Com contato" valor={neg.com_contato_7d} hint="lead sem contato não serve" />
            <Metrica label="Enviadas" valor={neg.enviadas_7d} />
            <Metrica label="Respostas" valor={neg.respostas} />
            <Metrica label="Rascunhos parados" valor={neg.rascunhos} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
