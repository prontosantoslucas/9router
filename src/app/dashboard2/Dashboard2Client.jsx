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

  // Form Telegram Userbot MTProto
  const [tgApiId, setTgApiId] = useState("");
  const [tgApiHash, setTgApiHash] = useState("");
  const [tgPhone, setTgPhone] = useState("");
  const [tgOtpCode, setTgOtpCode] = useState("");
  const [tgStep, setTgStep] = useState(1); // 1 = Credenciais, 2 = OTP
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

  useEffect(() => {
    fetchStats();
  }, []);

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
      if (res.ok) {
        setTgStep(2);
        alert("📱 Código OTP enviado para o seu aplicativo do Telegram!");
      }
    } catch (err) {
      alert(`Erro no envio do OTP: ${err.message}`);
    }
  };

  const handleCompleteTelegramAuth = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/agent/telegram/userbot/complete-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: tgPhone, code: tgOtpCode }),
      });
      if (res.ok) {
        setTgConnected(true);
        alert("✅ Telegram Userbot conectado com sucesso como sua conta pessoal!");
      }
    } catch (err) {
      alert(`Erro na validação do OTP: ${err.message}`);
    }
  };

  const handleConnectWhatsApp = async () => {
    try {
      const res = await fetch("/api/agent/evolution/instance", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setWaQrCode(data.qrcode || "mock_qr_code");
      }
    } catch (err) {
      alert(`Erro ao gerar QR Code do WhatsApp: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text-main p-6 space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold">Painel de Controle — Agente Lucas</h1>
            <HealthDot status="ok" label="Agente Online" />
          </div>
          <p className="text-sm text-text-muted mt-1">
            Gerencie o comportamento, personalidades do GitHub, memória e canais do Lucas.
          </p>
        </div>

        <button
          onClick={fetchStats}
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-xs font-bold hover:bg-bg-alt transition-colors"
        >
          <span className="material-symbols-outlined text-base">refresh</span>
          <span>Atualizar Dados</span>
        </button>
      </header>

      {/* Grid de Estatísticas / Analytics */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Mensagens Atendidas" value={stats?.metrics?.totalRequests || "0"} icon="forum" trend="+14%" />
        <StatCard title="Sessões Ativas" value={stats?.sessionCount || "0"} icon="group" />
        <StatCard title="Chaves LLM" value={`${stats?.keys?.total || 0}`} subtitle={`${stats?.keys?.exhausted || 0} esgotadas`} icon="key" />
        <StatCard title="Status ai-memory" value="Conectado" icon="psychology" subtitle="Wiki e Busca Ativas" />
      </section>

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

        {/* Card 2: Telegram Userbot (MTProto Conta Pessoal) */}
        <div className="card-soft p-6 border border-border space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-brand-500">send</span>
              <h3 className="font-bold text-base">Telegram Userbot (Conta Pessoal)</h3>
            </div>
            <HealthDot status={tgConnected ? "ok" : "warning"} label={tgConnected ? "Conectado" : "Desconectado"} />
          </div>

          {tgStep === 1 ? (
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
                <label className="block text-xs font-semibold text-text-muted mb-1">Código de Verificação OTP:</label>
                <input
                  type="text"
                  value={tgOtpCode}
                  onChange={(e) => setTgOtpCode(e.target.value)}
                  placeholder="12345"
                  className="w-full rounded-lg border border-border bg-transparent p-2.5 text-xs text-text-main focus:border-brand-500 focus:outline-none"
                />
              </div>

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

        {/* Card 3: WhatsApp (Evolution API) */}
        <div className="card-soft p-6 border border-border space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-success">chat</span>
              <h3 className="font-bold text-base">WhatsApp (Evolution API)</h3>
            </div>
            <HealthDot status={waConnected ? "ok" : "warning"} label={waConnected ? "Conectado" : "Aguardando QR Code"} />
          </div>

          {waQrCode ? (
            <div className="flex flex-col items-center justify-center p-4 bg-bg-alt rounded-lg">
              <div className="h-44 w-44 bg-surface border border-border flex items-center justify-center rounded-lg text-xs font-mono">
                [QR Code do WhatsApp]
              </div>
              <p className="text-xs text-text-muted mt-2">Escaneie com o app do WhatsApp no celular</p>
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
                  onChange={() => setModules((prev) => ({ ...prev, [key]: !prev[key] }))}
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
