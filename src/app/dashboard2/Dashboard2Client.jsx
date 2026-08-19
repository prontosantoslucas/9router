"use client";

import React, { useState, useEffect } from "react";
import { HealthDot } from "@/shared/components/primitives/HealthDot";
import { StatCard } from "@/shared/components/primitives/StatCard";

export default function Dashboard2Client() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Formulário Personalidade GitHub
  const [githubUrl, setGithubUrl] = useState("");
  const [githubPat, setGithubPat] = useState("");
  const [savingPersonality, setSavingPersonality] = useState(false);

  // Telegram Bot (BotFather)
  const [botToken, setBotToken] = useState("");
  const [botStatus, setBotStatus] = useState(null); // { configured, running, source }
  const [savingBot, setSavingBot] = useState(false);

  // Form Telegram Userbot MTProto
  const [tgApiId, setTgApiId] = useState("");
  const [tgApiHash, setTgApiHash] = useState("");
  const [tgPhone, setTgPhone] = useState("");
  const [tgOtpCode, setTgOtpCode] = useState("");
  const [tg2faPassword, setTg2faPassword] = useState("");
  const [tgNeedPassword, setTgNeedPassword] = useState(false);
  const [tgStep, setTgStep] = useState(1); // 1 = Credenciais, 2 = OTP (+2FA)
  const [tgConnected, setTgConnected] = useState(false);

  // Form WhatsApp (Evolution API)
  const [waConnected, setWaConnected] = useState(false);
  const [waQrCode, setWaQrCode] = useState(null);

  // Toggles de Módulos
  // Controles de prospecção. Substituíram o card "Módulos Avançados", cujos seis
  // checkboxes gravavam em agent_settings e NADA no código lia — desmarcar
  // "Autonomous Interactions" não desligava nada, porque quem manda ali é a env
  // var. Aqui só entra controle que o prospector.js de fato consulta:
  //   enabled       -> runCycle aborta se false
  //   interval_min  -> intervalo do timer 24/7
  //   auto_send_wa  -> gate do envio real no WhatsApp
  //   auto_send_ig  -> gate do envio real no Instagram
  const [prospector, setProspector] = useState(null);
  const [prospectorBusy, setProspectorBusy] = useState(false);
  const [prospectorMsg, setProspectorMsg] = useState(null);

  // Integration Google Workspace
  const [googleStatus, setGoogleStatus] = useState(null);
  // Status real dos serviços (agent/memory/google/workers/channels)
  const [sidecars, setSidecars] = useState(null);

  // Estado REAL do WhatsApp, reconsultado em intervalo. Antes o painel
  // acreditava numa flag ligada por acao do usuario e nunca reconsultada: uma
  // vez verde, ficava verde a sessao inteira, mesmo com o socket fechado.
  const [waStatus, setWaStatus] = useState(null);

  useEffect(() => {
    fetchStats();
    fetchGoogleStatus();
    fetchBotStatus();
    fetchSidecars();
    fetchProspector();
  }, []);

  useEffect(() => {
    let vivo = true;
    const buscar = () => {
      fetch("/api/agent/whatsapp/status")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (vivo && d) setWaStatus(d); })
        .catch(() => {});
    };
    buscar();
    const t = setInterval(buscar, 15000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  const fetchProspector = async () => {
    try {
      const res = await fetch("/api/agent/prospector/status");
      if (res.ok) setProspector(await res.json());
    } catch (err) {
      console.error("[Dashboard2] Erro ao carregar prospector:", err);
    }
  };

  const saveProspectorSetting = async (patch, aviso = null) => {
    // Disparo automático manda mensagem REAL para empresas. Confirmação
    // explícita porque um clique distraído aqui vira spam no número do usuário,
    // com risco de banimento do WhatsApp.
    if (aviso && !window.confirm(aviso)) return;

    const anterior = prospector?.settings;
    setProspector((p) => (p ? { ...p, settings: { ...p.settings, ...patch } } : p));
    try {
      const res = await fetch("/api/agent/prospector/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchProspector();
    } catch (err) {
      // Reverte na tela: mostrar ligado o que não salvou é o tipo de mentira
      // que o card antigo fazia.
      setProspector((p) => (p && anterior ? { ...p, settings: anterior } : p));
      setProspectorMsg("Não salvou: " + String(err.message || err).slice(0, 120));
    }
  };

  const runProspectorNow = async () => {
    setProspectorBusy(true);
    setProspectorMsg("Rodando ciclo… a busca leva de 30s a 2min.");
    try {
      const res = await fetch("/api/agent/prospector/run", { method: "POST" });
      const data = await res.json();
      const r = data.result || {};
      // Respeita r.ok: o ciclo pode falhar por erro técnico e o HTTP voltar 200.
      if (r.ok === false) {
        setProspectorMsg("O ciclo NÃO concluiu: " + (r.error || r.reason || "falha desconhecida"));
      } else {
        const partes = [`${r.discovered ?? 0} novo(s) lead(s)`];
        if (r.rejected) partes.push(`${(r.rejected.noContact || 0) + (r.rejected.aggregator || 0)} descartado(s)`);
        if (r.outreached) partes.push(`${r.outreached} envio(s) confirmado(s)`);
        if (r.queued) partes.push(`${r.queued} enfileirado(s) sem confirmação`);
        if (r.notion) partes.push(r.notion.ok ? `${r.notion.synced} no Notion` : "Notion falhou");
        setProspectorMsg(partes.join(" · "));
      }
      await fetchProspector();
      fetchStats();
    } catch (err) {
      setProspectorMsg("Erro ao rodar: " + String(err.message || err).slice(0, 120));
    } finally {
      setProspectorBusy(false);
    }
  };

  const fetchSidecars = async () => {
    try {
      const res = await fetch("/api/agent/status/sidecars");
      if (res.ok) setSidecars(await res.json());
    } catch (err) {
      console.error("[Dashboard2] Erro ao carregar status dos serviços:", err);
    }
  };

  const fetchBotStatus = async () => {
    try {
      const res = await fetch("/api/agent/telegram/bot/status");
      if (res.ok) setBotStatus(await res.json());
    } catch (err) {
      console.error("[Dashboard2] Erro ao carregar status do Bot:", err);
    }
  };

  const handleSaveBot = async (e) => {
    e.preventDefault();
    if (!botToken.trim()) return;
    setSavingBot(true);
    try {
      const res = await fetch("/api/agent/telegram/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: botToken.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setBotToken("");
        await fetchBotStatus();
        alert("✅ Bot do Telegram conectado e iniciado!");
      } else {
        alert(`Falha ao conectar o bot: ${data.error || `HTTP ${res.status}`}`);
      }
    } catch (err) {
      alert(`Erro ao salvar o token: ${err.message}`);
    } finally {
      setSavingBot(false);
    }
  };

  const handleDisconnectBot = async () => {
    if (!confirm("Desconectar o bot do Telegram? O token salvo será removido.")) return;
    try {
      await fetch("/api/agent/telegram/bot/disconnect", { method: "POST" });
      await fetchBotStatus();
    } catch (err) {
      alert(`Erro ao desconectar: ${err.message}`);
    }
  };

  const handleDisconnectTgUserbot = async () => {
    if (!confirm("Desconectar o Telegram Userbot da sua conta pessoal?")) return;
    try {
      await fetch("/api/agent/telegram/userbot/disconnect", { method: "POST" });
      setTgConnected(false);
      setTgStep(1);
      await fetchSidecars();
      alert("Telegram Userbot desconectado.");
    } catch (err) {
      alert(`Erro ao desconectar: ${err.message}`);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    if (!confirm("Desconectar a instância do WhatsApp?")) return;
    try {
      await fetch("/api/agent/evolution/disconnect", { method: "POST" });
      setWaConnected(false);
      setWaQrCode(null);
      await fetchSidecars();
      alert("WhatsApp desconectado com sucesso.");
    } catch (err) {
      alert(`Erro ao desconectar WhatsApp: ${err.message}`);
    }
  };

  const fetchGoogleStatus = async () => {
    try {
      const res = await fetch("/api/agent/google/status");
      if (res.ok) {
        const data = await res.json();
        setGoogleStatus(data);
      }
    } catch (err) {
      console.error("[Dashboard2] Erro ao carregar status do Google:", err);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      const res = await fetch("/api/agent/google/auth-url");
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.assign(data.url);
      } else {
        alert(data.error || "Google Client ID/Secret não configurado no .env");
      }
    } catch (err) {
      alert(`Erro no Google OAuth: ${err.message}`);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      const res = await fetch("/api/agent/google/disconnect", { method: "POST" });
      if (res.ok) {
        fetchGoogleStatus();
      }
    } catch (err) {
      console.error("Erro ao desconectar Google:", err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/agent/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("[Dashboard2] Erro ao carregar estatísticas:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePersonality = async (e) => {
    e.preventDefault();
    setSavingPersonality(true);
    try {
      const res = await fetch("/api/agent/personality/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: githubUrl, pat: githubPat }),
      });
      if (res.ok) {
        alert("✅ Personalidade do Lucas sincronizada com sucesso!");
      } else {
        alert("Falha ao salvar personalidade.");
      }
    } catch (err) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSavingPersonality(false);
    }
  };

  const handleStartTelegramAuth = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/agent/telegram/userbot/start-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiId: tgApiId, apiHash: tgApiHash, phone: tgPhone }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTgStep(2);
        alert("📱 Código enviado para o seu Telegram. Digite o código recebido.");
      } else {
        alert(`Falha ao enviar código: ${data.error || `HTTP ${res.status}`}`);
      }
    } catch (err) {
      alert(`Erro no envio do código: ${err.message}`);
    }
  };

  const handleCompleteTelegramAuth = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/agent/telegram/userbot/complete-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: tgPhone, code: tgOtpCode, password: tg2faPassword || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTgConnected(true);
        setTgNeedPassword(false);
        await fetchSidecars();
        alert("✅ Telegram conectado como sua conta pessoal!");
      } else if (data.needPassword) {
        setTgNeedPassword(true);
        alert("🔒 Sua conta tem verificação em duas etapas. Digite a senha 2FA e confirme de novo.");
      } else {
        alert(`Falha ao validar: ${data.error || `HTTP ${res.status}`}`);
      }
    } catch (err) {
      alert(`Erro na validação: ${err.message}`);
    }
  };

  const handleConnectWhatsApp = async () => {
    setWaQrCode(null);
    try {
      const res = await fetch("/api/agent/evolution/instance", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        alert(`WhatsApp: ${data.error || `Falha na Evolution API (HTTP ${res.status})`}`);
        return;
      }
      const qrString = data.base64 || data.code || null;
      if (!qrString) {
        if (data.status && /open|connected/i.test(data.status)) {
          setWaConnected(true);
          await fetchSidecars();
          alert("WhatsApp já está conectado.");
        } else {
          alert("Aguardando QR Code... tente novamente em alguns segundos.");
        }
        return;
      }
      setWaQrCode(qrString);
    } catch (err) {
      alert(`Erro ao gerar QR Code do WhatsApp: ${err.message}`);
    }
  };

  const isTgUserbotConnected = tgConnected || !!sidecars?.channels?.telegramUserbot;
  // Verde SO com socket aberto de fato. Nem `waConnected` (ligado por acao e
  // nunca revisto) nem EVOLUTION_API_URL configurada provam pareamento.
  const isWaConnected = !!waStatus?.conectado;

  return (
    <div className="min-h-screen bg-bg text-text-main p-4 sm:p-8 space-y-8">
      {/* Header com estilo premium */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-text-main via-text-main to-brand-500 bg-clip-text text-transparent">
              Painel de Controle — Lucas
            </h1>
            <HealthDot status="ok" label="Agente Online" />
          </div>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            Gerencie o comportamento, personalidades do GitHub, memória de longo prazo e canais de atendimento do Lucas.
          </p>
        </div>

        <button
          onClick={() => {
            fetchStats();
            fetchSidecars();
            fetchBotStatus();
            fetchGoogleStatus();
            fetchModules();
          }}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-bold shadow-soft hover:bg-bg-alt hover:border-brand-500/50 transition-all dark:bg-surface-2"
        >
          <span className="material-symbols-outlined text-base text-brand-500">refresh</span>
          <span>Atualizar Todos os Serviços</span>
        </button>
      </header>

      {/* Grid de Estatísticas / Analytics */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Mensagens Atendidas" value={stats?.metrics?.totalRequests || "0"} icon="forum" trend="+14%" />
        <StatCard title="Sessões Ativas" value={stats?.sessionCount || "0"} icon="group" />
        <StatCard title="Chaves LLM" value={`${stats?.keys?.total || 0}`} subtitle={`${stats?.keys?.exhausted || 0} esgotadas`} icon="key" />
        <StatCard
          title="ai-memory"
          value={
            sidecars?.memory?.reachable
              ? sidecars.memory?.mode === "github"
                ? "GitHub Active"
                : "Conectado"
              : "Offline"
          }
          icon="psychology"
          subtitle={
            sidecars?.memory?.mode === "github"
              ? "Repo: nortelucas/meueulucas"
              : sidecars?.memory?.reachable
              ? "MCP Server ativo"
              : "Memória desativada"
          }
        />
      </section>

      {/* Status real dos serviços */}
      {sidecars && (
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "Agente", ok: sidecars.agent?.ok, sub: `porta ${sidecars.agent?.port}` },
            {
              label: "ai-memory",
              ok: sidecars.memory?.reachable,
              sub: sidecars.memory?.mode === "github" ? "GitHub (meueulucas)" : sidecars.memory?.configured ? "MCP on" : "off",
            },
            { label: "Google", ok: sidecars.google?.configured, sub: sidecars.google?.hasRefreshToken ? "conectado" : "não conectado" },
            { label: "WhatsApp", ok: !!waStatus?.conectado, sub: waStatus?.conectado ? "pareado" : waStatus?.evolution?.configurada ? "Evolution configurada, nao pareado" : "nao pareado" },
            { label: "Telegram Userbot", ok: sidecars.channels?.telegramUserbot, sub: sidecars.channels?.telegramUserbot ? "pareado" : "não pareado" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 dark:bg-surface-2">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${s.ok ? "bg-success" : "bg-text-muted/40"}`} />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-text-main">{s.label}</p>
                <p className="truncate text-[10px] text-text-muted">{s.sub}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Seção Principal de Configurações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Card 1: Personalidade via GitHub */}
        <div className="card-soft p-6 border border-border space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <span className="material-symbols-outlined text-brand-500">code</span>
            <h3 className="font-bold text-base">Personalidade do Lucas (GitHub .md)</h3>
          </div>

          <form onSubmit={handleSavePersonality} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">URL do Documento Markdown (.md):</label>
              <input
                type="url"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/usuario/repo/blob/main/LUCAS_SOUL.md"
                className="w-full rounded-lg border border-border bg-transparent p-2.5 text-xs text-text-main focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">GitHub Personal Access Token (PAT) — opcional para repos privados:</label>
              <input
                type="password"
                value={githubPat}
                onChange={(e) => setGithubPat(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
                className="w-full rounded-lg border border-border bg-transparent p-2.5 text-xs text-text-main focus:border-brand-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={savingPersonality}
              className="w-full rounded-lg bg-brand-500 py-2.5 text-xs font-bold text-white shadow-soft hover:bg-brand-600 transition-colors"
            >
              {savingPersonality ? "Sincronizando..." : "Sincronizar Personalidade Agora"}
            </button>
          </form>
        </div>

        {/* Card: Telegram Bot (BotFather) */}
        <div className="card-soft p-6 border border-border space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-brand-500">smart_toy</span>
              <h3 className="font-bold text-base">Telegram Bot (BotFather)</h3>
            </div>
            <HealthDot
              status={botStatus?.running ? "ok" : botStatus?.configured ? "warning" : "warning"}
              label={botStatus?.running ? "Rodando" : botStatus?.configured ? "Configurado" : "Desconectado"}
            />
          </div>

          <p className="text-xs text-text-muted">
            Cole o token do seu bot (obtido com o <strong>@BotFather</strong> no Telegram, comando <code>/newbot</code>).
            O bot inicia na hora, sem reiniciar o servidor.
          </p>

          {botStatus?.source === "env" ? (
            <p className="text-xs text-warning">
              Token definido por variável de ambiente (BOT_TOKEN). Para trocar pela UI, remova a env no Railway.
            </p>
          ) : (
            <form onSubmit={handleSaveBot} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Token do Bot:</label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="123456789:AAE...seu-token-do-BotFather"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text-main focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  autoComplete="off"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingBot || !botToken.trim()}
                  className="flex-1 rounded-lg bg-brand-500 py-2.5 text-xs font-bold text-white shadow-soft hover:bg-brand-600 transition-colors disabled:opacity-50"
                >
                  {savingBot ? "Conectando..." : botStatus?.configured ? "Atualizar token" : "Conectar bot"}
                </button>
                {botStatus?.configured && (
                  <button
                    type="button"
                    onClick={handleDisconnectBot}
                    className="rounded-lg border border-border px-3 py-2.5 text-xs font-semibold text-text-muted hover:text-danger hover:bg-bg-alt transition-colors"
                  >
                    Desconectar
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Card 2: Telegram Userbot (MTProto Conta Pessoal) */}
        <div className="card-soft p-6 border border-border space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-brand-500">send</span>
              <h3 className="font-bold text-base">Telegram Userbot (Conta Pessoal)</h3>
            </div>
            <HealthDot status={isTgUserbotConnected ? "ok" : "warning"} label={isTgUserbotConnected ? "Conectado" : "Desconectado"} />
          </div>

          {isTgUserbotConnected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-500 border border-emerald-500/20">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>Conta Pessoal do Telegram pareada e ativa. As mensagens recebidas serão lidas pelo Lucas.</span>
              </div>
              <button
                type="button"
                onClick={handleDisconnectTgUserbot}
                className="w-full rounded-lg border border-border bg-surface py-2.5 text-xs font-bold text-danger hover:bg-red-500/10 transition-colors"
              >
                Desconectar Conta do Telegram
              </button>
            </div>
          ) : tgStep === 1 ? (
            <form onSubmit={handleStartTelegramAuth} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">API ID (my.telegram.org):</label>
                  <input
                    type="text"
                    value={tgApiId}
                    onChange={(e) => setTgApiId(e.target.value)}
                    placeholder="12345678"
                    className="w-full rounded-lg border border-border bg-transparent p-2 text-xs text-text-main focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">API Hash:</label>
                  <input
                    type="password"
                    value={tgApiHash}
                    onChange={(e) => setTgApiHash(e.target.value)}
                    placeholder="abcdef123456..."
                    className="w-full rounded-lg border border-border bg-transparent p-2 text-xs text-text-main focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Telefone da Conta (+55...):</label>
                <input
                  type="tel"
                  value={tgPhone}
                  onChange={(e) => setTgPhone(e.target.value)}
                  placeholder="+5511999998888"
                  className="w-full rounded-lg border border-border bg-transparent p-2 text-xs text-text-main focus:border-brand-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-brand-500 py-2.5 text-xs font-bold text-white shadow-soft hover:bg-brand-600 transition-colors"
              >
                Solicitar Código OTP no Telegram
              </button>
            </form>
          ) : (
            <form onSubmit={handleCompleteTelegramAuth} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Código de verificação (recebido no Telegram):</label>
                <input
                  type="text"
                  value={tgOtpCode}
                  onChange={(e) => setTgOtpCode(e.target.value)}
                  placeholder="12345"
                  className="w-full rounded-lg border border-border bg-transparent p-2.5 text-xs text-text-main focus:border-brand-500 focus:outline-none"
                />
              </div>

              {tgNeedPassword && (
                <div>
                  <label className="block text-xs font-semibold text-warning mb-1">🔒 Senha de verificação em duas etapas (2FA):</label>
                  <input
                    type="password"
                    value={tg2faPassword}
                    onChange={(e) => setTg2faPassword(e.target.value)}
                    placeholder="Sua senha 2FA do Telegram"
                    autoComplete="off"
                    className="w-full rounded-lg border border-warning/40 bg-transparent p-2.5 text-xs text-text-main focus:border-warning focus:outline-none"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTgStep(1)}
                  className="w-1/3 rounded-lg border border-border py-2.5 text-xs font-bold text-text-muted hover:bg-bg-alt"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="w-2/3 rounded-lg bg-success py-2.5 text-xs font-bold text-white shadow-soft hover:bg-emerald-600 transition-colors"
                >
                  Conectar Userbot MTProto
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Card 3: WhatsApp (Nativo / Baileys) */}
        <div className="card-soft p-6 border border-border space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-success">chat</span>
              <h3 className="font-bold text-base">WhatsApp (Nativo / Baileys)</h3>
            </div>
            <HealthDot status={isWaConnected ? "ok" : "warning"} label={isWaConnected ? "Conectado" : waQrCode ? "Aguardando Leitura" : "Aguardando QR Code"} />
          </div>

          {isWaConnected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-500 border border-emerald-500/20">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>WhatsApp pareado e ativo. As mensagens recebidas serão atendidas pelo Lucas.</span>
              </div>
              <button
                type="button"
                onClick={handleDisconnectWhatsApp}
                className="w-full rounded-lg border border-border bg-surface py-2.5 text-xs font-bold text-danger hover:bg-red-500/10 transition-colors"
              >
                Desconectar Instância do WhatsApp
              </button>
            </div>
          ) : waQrCode ? (
            <div className="flex flex-col items-center justify-center p-4 bg-bg-alt rounded-lg space-y-3">
              <img
                src={
                  waQrCode.startsWith("data:image") || waQrCode.startsWith("http")
                    ? waQrCode
                    : `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(waQrCode)}`
                }
                alt="QR Code de Pareamento do WhatsApp"
                className="h-48 w-48 rounded-lg border border-border bg-white p-2 shadow-soft"
              />
              <p className="text-xs text-text-muted text-center">
                Escaneie o QR Code no seu celular em <span className="font-bold text-text-main">WhatsApp → Aparelhos Conectados</span>
              </p>
              <button
                onClick={handleConnectWhatsApp}
                className="text-xs text-brand-500 font-bold hover:underline flex items-center gap-1 mt-1"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                <span>Gerar Novo QR Code</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectWhatsApp}
              className="w-full rounded-lg border border-border bg-surface py-3 text-xs font-bold text-text-main hover:border-brand-500 transition-colors"
            >
              Gerar QR Code para Pareamento no WhatsApp
            </button>
          )}
        </div>
        {/* Card 4: Google Workspace (Gmail, Calendar, Drive, Docs) */}
        <div className="card-soft p-6 border border-border space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-brand-500">mail</span>
              <h3 className="font-bold text-base">Google Workspace (Gmail, Calendar, Drive)</h3>
            </div>
            <HealthDot status={googleStatus?.authorized ? "ok" : "warning"} label={googleStatus?.authorized ? "Conectado" : "Não Autorizado"} />
          </div>

          <p className="text-xs text-text-muted">
            {googleStatus?.authorized
              ? `Conectado como ${googleStatus.email || "Google Account"}. O Lucas tem acesso a Gmail, Agenda e Google Docs.`
              : "Conecte sua conta do Google para permitir que o Lucas gerencie e-mails, reagende reuniões na Agenda e crie documentos."}
          </p>

          {googleStatus?.authorized ? (
            <button
              onClick={handleDisconnectGoogle}
              className="w-full rounded-lg border border-border bg-surface py-2.5 text-xs font-bold text-danger hover:bg-red-500/10 transition-colors"
            >
              Desconectar Conta Google
            </button>
          ) : (
            <button
              onClick={handleConnectGoogle}
              className="w-full rounded-lg bg-brand-500 py-2.5 text-xs font-bold text-white shadow-soft hover:bg-brand-600 transition-colors"
            >
              Conectar Conta Google via OAuth
            </button>
          )}
        </div>

        {/* Card 4: Prospecção 24/7 — só controles que o código realmente lê.
            Substituiu "Módulos Avançados", onde 6 checkboxes gravavam no banco
            e nada os consultava. */}
        <div className="card-soft p-6 border border-border space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-brand-500">radar</span>
              <h3 className="font-bold text-base">Prospecção 24/7</h3>
            </div>
            {prospector?.totalLeads !== undefined && (
              <span className="text-[11px] text-text-muted">
                {prospector.totalLeads} lead(s) · {prospector.draftedOutreach ?? 0} rascunho(s)
              </span>
            )}
          </div>

          {!prospector ? (
            <p className="text-xs text-text-muted">Carregando…</p>
          ) : (
            <div className="space-y-3">
              {/* Motor: gate real no início do runCycle */}
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-bg-alt transition-colors">
                <div>
                  <span className="text-xs font-semibold text-text-main">Motor automático</span>
                  <p className="text-[11px] text-text-subtle">
                    Busca sozinho a cada {prospector.settings?.interval_min ?? 15} min
                    {prospector.running ? " · rodando" : " · parado"}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={!!prospector.settings?.enabled}
                  onChange={() => saveProspectorSetting({ enabled: !prospector.settings?.enabled })}
                  className="h-4 w-4 rounded accent-brand-500 cursor-pointer"
                />
              </div>

              {/* Disparo automático: manda mensagem REAL. Aviso à vista, não escondido. */}
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-bg-alt transition-colors">
                <div>
                  <span className="text-xs font-semibold text-text-main">Disparo automático — WhatsApp</span>
                  <p className="text-[11px] text-danger">
                    Envia mensagem real sem revisão. Requer WhatsApp pareado.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={!!prospector.settings?.auto_send_wa}
                  onChange={() =>
                    saveProspectorSetting(
                      { auto_send_wa: !prospector.settings?.auto_send_wa },
                      prospector.settings?.auto_send_wa
                        ? null
                        : "Ligar o disparo automático no WhatsApp?\n\nO agente vai enviar mensagem para as empresas SEM você revisar. Disparo em massa para quem não te procurou é o padrão que faz o WhatsApp banir número — e é o mesmo número dos seus CTAs.\n\nRecomendado: manter desligado e enviar pela lista de rascunhos."
                    )
                  }
                  className="h-4 w-4 rounded accent-brand-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-bg-alt transition-colors">
                <div>
                  <span className="text-xs font-semibold text-text-main">Disparo automático — Instagram</span>
                  <p className="text-[11px] text-danger">
                    Depende da extensão do Chrome aberta e logada; entrega não é confirmada.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={!!prospector.settings?.auto_send_ig}
                  onChange={() =>
                    saveProspectorSetting(
                      { auto_send_ig: !prospector.settings?.auto_send_ig },
                      prospector.settings?.auto_send_ig
                        ? null
                        : "Ligar o disparo automático no Instagram?\n\nO envio passa pela extensão do Chrome: se ela não estiver aberta e logada, a mensagem fica na fila e NÃO é entregue (fica marcada como 'enfileirada', nunca 'enviada').\n\nO Instagram também não permite iniciar conversa por API oficial."
                    )
                  }
                  className="h-4 w-4 rounded accent-brand-500 cursor-pointer"
                />
              </div>

              {/* Rodar agora: mesma ação disponível no webchat, aqui fora dele */}
              <button
                onClick={runProspectorNow}
                disabled={prospectorBusy}
                className="w-full mt-1 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
              >
                {prospectorBusy ? "Rodando…" : "Rodar um ciclo agora"}
              </button>

              {prospectorMsg && (
                <p className="text-[11px] text-text-muted whitespace-pre-wrap border-t border-border pt-2">
                  {prospectorMsg}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
