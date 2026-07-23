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
  const [modules, setModules] = useState({
    audioSttTts: true,
    copilotMode: false,
    dailyBriefing: true,
    webBrowsing: true,
    codeInterpreter: true,
    autonomousInteractions: true,
  });

  // Integration Google Workspace
  const [googleStatus, setGoogleStatus] = useState(null);
  // Status real dos serviços (agent/memory/google/workers/channels)
  const [sidecars, setSidecars] = useState(null);

  useEffect(() => {
    fetchStats();
    fetchGoogleStatus();
    fetchBotStatus();
    fetchSidecars();
    fetchModules();
  }, []);

  const fetchModules = async () => {
    try {
      const res = await fetch("/api/agent/modules");
      if (res.ok) {
        const data = await res.json();
        if (data.modules) setModules(data.modules);
      }
    } catch (err) {
      console.error("[Dashboard2] Erro ao carregar módulos:", err);
    }
  };

  const handleToggleModule = async (key) => {
    const updated = { ...modules, [key]: !modules[key] };
    setModules(updated);
    try {
      const res = await fetch("/api/agent/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modules: updated }),
      });
      if (!res.ok) {
        setModules(modules);
        console.error("Falha ao salvar módulo:", await res.text());
      }
    } catch (err) {
      console.error("[Dashboard2] Erro ao salvar módulo:", err);
      setModules(modules);
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
  const isWaConnected = waConnected || !!sidecars?.channels?.whatsapp;

  return (
    <div className="min-h-screen bg-bg text-text-main p-4 sm:p-8 space-y-8">
      {/* Header com estilo premium */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-text-main via-text-main to-brand-500 bg-clip-text text-transparent">
              Painel de Controle — Agente Lucas
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
            { label: "WhatsApp", ok: sidecars.channels?.whatsapp, sub: sidecars.channels?.whatsapp ? "Evolution on" : "off" },
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

        {/* Card 4: Toggles dos Módulos Avançados */}
        <div className="card-soft p-6 border border-border space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <span className="material-symbols-outlined text-brand-500">tune</span>
            <h3 className="font-bold text-base">Módulos Avançados do Lucas</h3>
          </div>

          <div className="space-y-3">
            {Object.entries(modules).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between p-2 rounded-lg hover:bg-bg-alt transition-colors">
                <span className="text-xs font-semibold capitalize text-text-main">
                  {key.replace(/([A-Z])/g, " $1")}
                </span>
                <input
                  type="checkbox"
                  checked={val}
                  onChange={() => handleToggleModule(key)}
                  className="h-4 w-4 rounded accent-brand-500 cursor-pointer"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
