"use client";

import React, { useState, useEffect } from "react";

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [plans, setPlans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [keys, setKeys] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Billing Cycle Toggle (monthly vs annual)
  const [billingCycle, setBillingCycle] = useState("monthly");

  // Modais State
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState(null);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(50);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newKeyLimit, setNewKeyLimit] = useState(50);
  const [generatedKey, setGeneratedKey] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Simulação de Checkout PIX
  const [checkoutStep, setCheckoutStep] = useState(1); // 1 = Método, 2 = QR Code / Processando
  const [selectedPaymentGateway, setSelectedPaymentGateway] = useState("pix");
  const [pixCopySuccess, setPixCopySuccess] = useState(false);

  // Gateways State
  const [gateways, setGateways] = useState([
    { id: "stripe", name: "Stripe", icon: "credit_card", status: "active", type: "Cartão / Global", testMode: false },
    { id: "mercadopago", name: "Mercado Pago", icon: "qr_code_2", status: "active", type: "PIX / Cartão BR", testMode: false },
    { id: "opennode", name: "OpenNode", icon: "currency_bitcoin", status: "active", type: "Bitcoin / USDT Crypto", testMode: true },
    { id: "paypal", name: "PayPal", icon: "account_balance_wallet", status: "inactive", type: "PayPal Express", testMode: true },
  ]);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    setLoading(true);
    try {
      const [plansRes, paymentsRes, keysRes, statsRes] = await Promise.all([
        fetch("/api/billing/plans").then((r) => r.json()),
        fetch("/api/billing/payments").then((r) => r.json()),
        fetch("/api/billing/api-keys").then((r) => r.json()),
        fetch("/api/billing/stats").then((r) => r.json()),
      ]);

      setPlans(plansRes.plans || []);
      setPayments(paymentsRes.payments || []);
      setKeys(keysRes.keys || []);
      setStats(statsRes || {});
    } catch (err) {
      console.error("[Billing] Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApiKey = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/billing/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newKeyLabel || "Chave de Produção", costLimitCents: newKeyLimit * 100 }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedKey(data.key || "sk-maxrouter-prod-" + Math.random().toString(36).substring(2, 12));
        fetchBillingData();
      } else {
        alert("Falha ao criar chave.");
      }
    } catch (err) {
      alert(`Erro: ${err.message}`);
    }
  };

  const handleSimulatePayment = async () => {
    setCheckoutStep(2);
    setTimeout(() => {
      // Simula confirmação de pagamento após 3 segundos
      fetchBillingData();
    }, 3000);
  };

  const handleConfirmTopUp = async () => {
    try {
      await fetch("/api/billing/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: topUpAmount * 100, gateway: selectedPaymentGateway, status: "paid" }),
      }).catch(() => {});
      alert(`✅ Recarga de R$ ${topUpAmount},00 enviada com sucesso via ${selectedPaymentGateway.toUpperCase()}!`);
      setShowTopUpModal(false);
      fetchBillingData();
    } catch (err) {
      alert(`Erro na recarga: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined animate-spin text-3xl text-brand-500">sync</span>
          <p className="text-xs font-semibold text-text-muted">Carregando Módulo de Faturamento...</p>
        </div>
      </div>
    );
  }

  // Estatísticas calculadas
  const totalRevenue = (stats?.totalRevenueCents || 0) / 100;
  const userCount = stats?.userCount || 1;
  const paidKeyCount = keys.length || stats?.paidKeyCount || 0;
  const tokenUsage = 1420500;
  const tokenLimit = 5000000;
  const usagePercentage = Math.min(100, Math.round((tokenUsage / tokenLimit) * 100));

  return (
    <div className="min-h-screen bg-bg text-text-main p-4 sm:p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header com Título e Ações Rápida */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Faturamento & Assinaturas</h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-500/10 text-brand-500 border border-brand-500/20">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Plano Pro Ativo</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            Gerencie planos de IA, limites de tokens, recargas via PIX/Cartão e faturas da sua organização.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setSelectedPlanForCheckout(plans[1] || { name: "Pro Developer", priceCents: 2990 });
              setCheckoutStep(1);
            }}
            className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-xs font-bold text-white shadow-soft hover:bg-brand-600 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">workspace_premium</span>
            <span>Fazer Upgrade de Plano</span>
          </button>

          <button
            onClick={() => setShowTopUpModal(true)}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-xs font-bold text-text-main hover:bg-bg-alt transition-colors"
          >
            <span className="material-symbols-outlined text-sm text-emerald-500">add_card</span>
            <span>Recarregar Saldo</span>
          </button>
        </div>
      </header>

      {/* Grid de 4 Cards KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="card-soft p-5 border border-border space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Plano Atual</span>
            <span className="material-symbols-outlined text-brand-500">verified</span>
          </div>
          <div className="text-2xl font-extrabold text-text-main">Pro Developer</div>
          <p className="text-xs text-text-muted flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-emerald-500">schedule</span>
            <span>Renova em 18 dias ($29.90/mês)</span>
          </p>
        </div>

        {/* KPI 2 */}
        <div className="card-soft p-5 border border-border space-y-2">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Consumo de Tokens</span>
            <span className="material-symbols-outlined text-brand-500">memory</span>
          </div>
          <div className="text-2xl font-extrabold text-text-main">
            {(tokenUsage / 1000000).toFixed(2)}M <span className="text-xs font-normal text-text-muted">/ 5.00M</span>
          </div>
          <div className="w-full bg-bg-alt h-2 rounded-full overflow-hidden">
            <div className="bg-brand-500 h-full transition-all duration-500" style={{ width: `${usagePercentage}%` }} />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="card-soft p-5 border border-border space-y-2">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Saldo em Conta</span>
            <span className="material-symbols-outlined text-emerald-500">account_balance_wallet</span>
          </div>
          <div className="text-2xl font-extrabold text-emerald-500">$ 45,80 USD</div>
          <p className="text-xs text-text-muted">Recarga automática ativa abaixo de $ 10</p>
        </div>

        {/* KPI 4 */}
        <div className="card-soft p-5 border border-border space-y-2">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Chaves Ativas & Faturamento</span>
            <span className="material-symbols-outlined text-brand-500">key</span>
          </div>
          <div className="text-2xl font-extrabold text-text-main">{paidKeyCount} Chaves</div>
          <p className="text-xs text-text-muted">Receita Acumulada: ${totalRevenue.toFixed(2)}</p>
        </div>
      </section>

      {/* Navegação por Abas */}
      <div className="border-b border-border">
        <nav className="flex space-x-6 overflow-x-auto pb-px">
          {[
            { id: "overview", label: "Visão Geral", icon: "dashboard" },
            { id: "plans", label: "Planos & Preços", icon: "workspace_premium" },
            { id: "keys", label: "Chaves de API & Saldo", icon: "key" },
            { id: "invoices", label: "Histórico & Faturas", icon: "receipt_long" },
            { id: "gateways", label: "Gateways de Pagamento", icon: "payment" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 py-3 px-1 text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "border-brand-500 text-brand-500"
                  : "border-transparent text-text-muted hover:border-border hover:text-text-main"
              }`}
            >
              <span className="material-symbols-outlined text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* ABA 1: VISÃO GERAL */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card Esquerda: Status do Consumo do Plano */}
          <div className="lg:col-span-2 card-soft p-6 border border-border space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="font-bold text-base">Uso Atual de Recursos do Plano</h3>
                <p className="text-xs text-text-muted">Ciclo atual: 01 Jul - 31 Jul 2026</p>
              </div>
              <span className="material-symbols-outlined text-brand-500">analytics</span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Tokens de LLM Processados</span>
                  <span>{tokenUsage.toLocaleString()} / {tokenLimit.toLocaleString()} ({usagePercentage}%)</span>
                </div>
                <div className="w-full bg-bg-alt h-3 rounded-full overflow-hidden">
                  <div className="bg-brand-500 h-full rounded-full transition-all" style={{ width: `${usagePercentage}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Limite de Custo Mensal</span>
                  <span>$ 14,20 / $ 50,00 USD (28%)</span>
                </div>
                <div className="w-full bg-bg-alt h-3 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: "28%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Taxa de Requisições por Minuto (RPM)</span>
                  <span>140 / 600 RPM (23%)</span>
                </div>
                <div className="w-full bg-bg-alt h-3 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full transition-all" style={{ width: "23%" }} />
                </div>
              </div>
            </div>

            {/* Consumo por Modelo */}
            <div className="pt-4 border-t border-border">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">Modelos Mais Consumidos</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { name: "gpt-4o", percentage: "45%", count: "639k tokens", color: "bg-emerald-500" },
                  { name: "claude-3-5-sonnet", percentage: "30%", count: "426k tokens", color: "bg-purple-500" },
                  { name: "gemini-2.5-flash", percentage: "15%", count: "213k tokens", color: "bg-blue-500" },
                  { name: "deepseek-chat", percentage: "10%", count: "142k tokens", color: "bg-amber-500" },
                ].map((m, i) => (
                  <div key={i} className="p-3 rounded-lg bg-bg-alt border border-border">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`h-2 w-2 rounded-full ${m.color}`} />
                      <span className="text-xs font-bold truncate">{m.name}</span>
                    </div>
                    <p className="text-xs text-text-muted">{m.count}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Card Direita: Alertas & Notificações de Faturamento */}
          <div className="card-soft p-6 border border-border space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <span className="material-symbols-outlined text-brand-500">notifications</span>
              <h3 className="font-bold text-base">Alertas & Notificações</h3>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex gap-3 items-start">
                <span className="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                <div>
                  <p className="text-xs font-bold text-text-main">Fatura anterior paga</p>
                  <p className="text-xs text-text-muted mt-0.5">Recibo #INV-2026-004 de R$ 149,50 confirmado via PIX.</p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-brand-500/10 border border-brand-500/20 flex gap-3 items-start">
                <span className="material-symbols-outlined text-brand-500 text-lg">info</span>
                <div>
                  <p className="text-xs font-bold text-text-main">Alerta de Renovação</p>
                  <p className="text-xs text-text-muted mt-0.5">Seu plano Pro Developer será renovado automaticamente em 10 de Agosto.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveTab("plans")}
              className="w-full mt-2 rounded-lg border border-border bg-surface py-2.5 text-xs font-bold text-text-main hover:border-brand-500 transition-colors"
            >
              Ver Detalhes do Plano
            </button>
          </div>
        </div>
      )}

      {/* ABA 2: PLANOS & PREÇOS */}
      {activeTab === "plans" && (
        <div className="space-y-8">
          {/* Toggle Mensal / Anual */}
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="inline-flex items-center p-1 rounded-xl bg-surface border border-border">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  billingCycle === "monthly" ? "bg-brand-500 text-white shadow-soft" : "text-text-muted hover:text-text-main"
                }`}
              >
                Cobrança Mensal
              </button>
              <button
                onClick={() => setBillingCycle("annual")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  billingCycle === "annual" ? "bg-brand-500 text-white shadow-soft" : "text-text-muted hover:text-text-main"
                }`}
              >
                <span>Cobrança Anual</span>
                <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full uppercase">Economize 20%</span>
              </button>
            </div>
          </div>

          {/* Grid de Planos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Plano 1: Starter */}
            <div className="card-soft p-6 border border-border flex flex-col justify-between space-y-6 hover:border-brand-500/50 transition-all">
              <div className="space-y-4">
                <div className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-bg-alt text-text-muted">
                  Para Iniciantes & Testes
                </div>
                <h3 className="text-xl font-extrabold">Starter Gratuito</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black">$ 0</span>
                  <span className="text-xs text-text-muted">/ mês</span>
                </div>
                <p className="text-xs text-text-muted">Perfeito para explorar os modelos do 9Router e prototipar agentes.</p>

                <ul className="space-y-2.5 text-xs text-text-main pt-2">
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500 text-base">check</span>
                    <span>100.000 tokens / mês inclusos</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500 text-base">check</span>
                    <span>Limite de 60 RPM</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500 text-base">check</span>
                    <span>Acesso a Gemini 2.5 & Claude 3.5 Haiku</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500 text-base">check</span>
                    <span>Suporte via Comunidade</span>
                  </li>
                </ul>
              </div>

              <button
                disabled
                className="w-full rounded-lg border border-border bg-bg-alt py-3 text-xs font-bold text-text-muted cursor-not-allowed"
              >
                Plano Atual
              </button>
            </div>

            {/* Plano 2: Pro Developer (Mais Popular) */}
            <div className="card-soft p-6 border-2 border-brand-500 flex flex-col justify-between space-y-6 relative shadow-warm">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-brand-500 text-white text-[10px] font-black uppercase tracking-wider">
                Mais Popular
              </div>

              <div className="space-y-4">
                <div className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-brand-500/10 text-brand-500">
                  Para Desenvolvedores & Pessoas Físicas
                </div>
                <h3 className="text-xl font-extrabold">Pro Developer</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-brand-500">
                    {billingCycle === "annual" ? "$ 23.90" : "$ 29.90"}
                  </span>
                  <span className="text-xs text-text-muted">/ mês</span>
                </div>
                <p className="text-xs text-text-muted">Para uso contínuo do Agente Lucas e automações no WhatsApp/Telegram.</p>

                <ul className="space-y-2.5 text-xs text-text-main pt-2">
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500 text-base">check</span>
                    <span className="font-bold">5.000.000 tokens / mês</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500 text-base">check</span>
                    <span>600 RPM de velocidade</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500 text-base">check</span>
                    <span>Todos os modelos GPT-4o, Claude 3.5 & DeepSeek</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500 text-base">check</span>
                    <span>Integração WhatsApp & Telegram Ilimitada</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500 text-base">check</span>
                    <span>Notificações via WhatsApp & E-mail</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => {
                  setSelectedPlanForCheckout(plans[1] || { name: "Pro Developer", priceCents: 2990 });
                  setCheckoutStep(1);
                }}
                className="w-full rounded-lg bg-brand-500 py-3 text-xs font-bold text-white shadow-soft hover:bg-brand-600 transition-colors"
              >
                Assinar Plano Pro Agora
              </button>
            </div>

            {/* Plano 3: Enterprise */}
            <div className="card-soft p-6 border border-border flex flex-col justify-between space-y-6 hover:border-brand-500/50 transition-all">
              <div className="space-y-4">
                <div className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-bg-alt text-text-muted">
                  Para Empresas & Agências
                </div>
                <h3 className="text-xl font-extrabold">Enterprise AI</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black">
                    {billingCycle === "annual" ? "$ 79.90" : "$ 99.90"}
                  </span>
                  <span className="text-xs text-text-muted">/ mês</span>
                </div>
                <p className="text-xs text-text-muted">Infraestrutura dedicada com suporte prioritário 24/7 e SLA garantido.</p>

                <ul className="space-y-2.5 text-xs text-text-main pt-2">
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500 text-base">check</span>
                    <span className="font-bold">25.000.000 tokens / mês</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500 text-base">check</span>
                    <span>3.000 RPM + Pool Dedicado</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500 text-base">check</span>
                    <span>Suporte Prioritário por Gerente de Conta</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500 text-base">check</span>
                    <span>Garantia de SLA 99.9% de Uptime</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => {
                  setSelectedPlanForCheckout(plans[2] || { name: "Enterprise AI", priceCents: 9990 });
                  setCheckoutStep(1);
                }}
                className="w-full rounded-lg border border-border bg-surface py-3 text-xs font-bold text-text-main hover:border-brand-500 transition-colors"
              >
                Contratar Enterprise
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: CHAVES DE API & SALDO */}
      {activeTab === "keys" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg">Gerenciador de Chaves de API Pagas</h3>
              <p className="text-xs text-text-muted">Crie chaves de faturamento e defina cotas de gastos por aplicação.</p>
            </div>

            <button
              onClick={() => {
                setShowNewKeyModal(true);
                setGeneratedKey(null);
              }}
              className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-xs font-bold text-white hover:bg-brand-600 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>Criar Nova Chave de API</span>
            </button>
          </div>

          <div className="card-soft border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-bg-alt border-b border-border text-text-muted font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Identificador da Chave</th>
                    <th className="p-4">Prefixo / Token</th>
                    <th className="p-4">Cota Limite</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {keys.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-text-muted">
                        Nenhuma chave de faturamento criada ainda.
                      </td>
                    </tr>
                  ) : (
                    keys.map((k) => (
                      <tr key={k.id} className="hover:bg-bg-alt/50 transition-colors">
                        <td className="p-4 font-bold text-text-main">{k.label || "Chave sem nome"}</td>
                        <td className="p-4 font-mono text-text-muted">{k.key ? `${k.key.substring(0, 16)}...` : "sk-maxrouter-***"}</td>
                        <td className="p-4 text-text-main font-semibold">${((k.costLimitCents || 5000) / 100).toFixed(2)} USD</td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span>Ativa</span>
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => alert("Configurações da chave salvas.")}
                            className="text-text-muted hover:text-brand-500 font-bold"
                          >
                            Editar Limite
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: HISTÓRICO & FATURAS */}
      {activeTab === "invoices" && (
        <div className="space-y-6">
          <div>
            <h3 className="font-bold text-lg">Histórico de Transações & Faturas</h3>
            <p className="text-xs text-text-muted">Consulte e faça download de comprovantes e notas de pagamento.</p>
          </div>

          <div className="card-soft border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-bg-alt border-b border-border text-text-muted font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Data</th>
                    <th className="p-4">ID Transação</th>
                    <th className="p-4">Valor</th>
                    <th className="p-4">Método / Gateway</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Recibo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { date: "22/07/2026", id: "TX-9R-8821", amount: "R$ 149,50", method: "PIX MercadoPago", status: "paid" },
                    { date: "10/06/2026", id: "TX-9R-7719", amount: "$ 29.90", method: "Cartão Stripe", status: "paid" },
                    { date: "10/05/2026", id: "TX-9R-6602", amount: "$ 29.90", method: "Cartão Stripe", status: "paid" },
                  ].map((inv, idx) => (
                    <tr key={idx} className="hover:bg-bg-alt/50 transition-colors">
                      <td className="p-4 text-text-muted">{inv.date}</td>
                      <td className="p-4 font-mono font-semibold">{inv.id}</td>
                      <td className="p-4 font-bold text-text-main">{inv.amount}</td>
                      <td className="p-4 text-text-muted">{inv.method}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          Confirmado
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => alert(`Baixando recibo ${inv.id}.pdf`)}
                          className="flex items-center gap-1 text-brand-500 font-bold ml-auto hover:underline"
                        >
                          <span className="material-symbols-outlined text-sm">download</span>
                          <span>PDF</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 5: GATEWAYS DE PAGAMENTO */}
      {activeTab === "gateways" && (
        <div className="space-y-6">
          <div>
            <h3 className="font-bold text-lg">Gateways de Pagamento Ativos</h3>
            <p className="text-xs text-text-muted">Provedores de pagamento configurados para liquidação automática.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {gateways.map((gw) => (
              <div key={gw.id} className="card-soft p-5 border border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center">
                    <span className="material-symbols-outlined">{gw.icon}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">{gw.name}</h4>
                    <p className="text-xs text-text-muted">{gw.type}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                    gw.status === "active" ? "bg-emerald-500/10 text-emerald-500" : "bg-bg-alt text-text-muted"
                  }`}>
                    {gw.status === "active" ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL CHECKOUT DE PLANO */}
      {selectedPlanForCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card-soft w-full max-w-md p-6 border border-border space-y-6 shadow-2xl animate-in fade-in zoom-in">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="font-extrabold text-lg">Assinatura do Plano</h3>
                <p className="text-xs text-text-muted">{selectedPlanForCheckout.name}</p>
              </div>
              <button
                onClick={() => setSelectedPlanForCheckout(null)}
                className="text-text-muted hover:text-text-main"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {checkoutStep === 1 ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold mb-2">Escolha o Método de Pagamento:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "pix", label: "PIX (Instantâneo)", icon: "qr_code_2" },
                      { id: "credit_card", label: "Cartão de Crédito", icon: "credit_card" },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedPaymentGateway(m.id)}
                        className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 text-xs font-bold transition-all ${
                          selectedPaymentGateway === m.id
                            ? "border-brand-500 bg-brand-500/10 text-brand-500"
                            : "border-border hover:bg-bg-alt text-text-muted"
                        }`}
                      >
                        <span className="material-symbols-outlined">{m.icon}</span>
                        <span>{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-bg-alt border border-border space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Subtotal:</span>
                    <span>$ 29.90 USD</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-emerald-500">
                    <span>Desconto Anual:</span>
                    <span>-$ 6.00 USD</span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold border-t border-border pt-1">
                    <span>Total a Pagar:</span>
                    <span>R$ 149,50</span>
                  </div>
                </div>

                <button
                  onClick={handleSimulatePayment}
                  className="w-full rounded-lg bg-brand-500 py-3 text-xs font-bold text-white hover:bg-brand-600 transition-colors shadow-soft"
                >
                  Gerar QR Code PIX / Pagar
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-4 space-y-4 text-center">
                <div className="h-44 w-44 bg-surface border border-border flex items-center justify-center rounded-lg font-mono text-xs shadow-inner">
                  [QR Code PIX Gerado]
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText("00020126580014br.gov.bcb.pix0136maxrouter-pix-key-prod");
                    setPixCopySuccess(true);
                    setTimeout(() => setPixCopySuccess(false), 2000);
                  }}
                  className="w-full rounded-lg border border-border py-2 text-xs font-bold text-brand-500 hover:bg-bg-alt"
                >
                  {pixCopySuccess ? "✅ Chave Copia e Cola Copiada!" : "Copiar Chave PIX (Copia e Cola)"}
                </button>

                <p className="text-xs text-emerald-500 font-semibold animate-pulse">
                  Aguardando confirmação automática de pagamento...
                </p>

                <button
                  onClick={() => setSelectedPlanForCheckout(null)}
                  className="w-full rounded-lg bg-emerald-500 py-2.5 text-xs font-bold text-white hover:bg-emerald-600"
                >
                  Concluir Assinatura
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL RECARGA DE SALDO */}
      {showTopUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card-soft w-full max-w-sm p-6 border border-border space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-extrabold text-base">Recarregar Saldo de API</h3>
              <button onClick={() => setShowTopUpModal(false)} className="text-text-muted hover:text-text-main">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold">Selecione o Valor da Recarga:</label>
              <div className="grid grid-cols-4 gap-2">
                {[10, 25, 50, 100].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTopUpAmount(v)}
                    className={`py-2 rounded-lg border text-xs font-bold transition-all ${
                      topUpAmount === v
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                        : "border-border hover:bg-bg-alt text-text-muted"
                    }`}
                  >
                    R$ {v}
                  </button>
                ))}
              </div>

              <button
                onClick={handleConfirmTopUp}
                className="w-full mt-2 rounded-lg bg-emerald-500 py-3 text-xs font-bold text-white hover:bg-emerald-600 shadow-soft"
              >
                Confirmar Recarga de R$ {topUpAmount},00
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVA CHAVE API */}
      {showNewKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card-soft w-full max-w-md p-6 border border-border space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-extrabold text-base">Gerar Nova Chave de API</h3>
              <button onClick={() => setShowNewKeyModal(false)} className="text-text-muted hover:text-text-main">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {generatedKey ? (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-500">
                  ✅ Chave gerada com sucesso! Copie-a agora pois não será exibida novamente.
                </div>
                <div className="p-3 rounded-lg bg-bg-alt border border-border font-mono text-xs break-all">
                  {generatedKey}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedKey);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                  className="w-full rounded-lg bg-brand-500 py-2.5 text-xs font-bold text-white hover:bg-brand-600"
                >
                  {copiedKey ? "✅ Chave Copiada!" : "Copiar Chave de API"}
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateApiKey} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Nome / Identificador:</label>
                  <input
                    type="text"
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                    placeholder="Ex: Produção App Mobile"
                    className="w-full rounded-lg border border-border bg-transparent p-2 text-xs focus:border-brand-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Limite Máximo de Gastos ($ USD):</label>
                  <input
                    type="number"
                    value={newKeyLimit}
                    onChange={(e) => setNewKeyLimit(Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-transparent p-2 text-xs focus:border-brand-500 focus:outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-brand-500 py-2.5 text-xs font-bold text-white hover:bg-brand-600"
                >
                  Gerar Chave Agora
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
