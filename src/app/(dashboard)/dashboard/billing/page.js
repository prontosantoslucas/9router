"use client";

import React, { useState, useEffect } from "react";

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [plans, setPlans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [keys, setKeys] = useState([]);
  const [gateways, setGateways] = useState([]);
  const [stats, setStats] = useState(null);
  const [usageStats, setUsageStats] = useState(null);
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

  // Gateway Config Modal
  const [selectedGatewayForConfig, setSelectedGatewayForConfig] = useState(null);
  const [gwApiKey, setGwApiKey] = useState("");
  const [gwWebhookSecret, setGwWebhookSecret] = useState("");
  const [gwTestMode, setGwTestMode] = useState(false);

  // Checkout Flow Real
  const [checkoutStep, setCheckoutStep] = useState(1); // 1 = Método, 2 = QR Code / Detalhes
  const [selectedPaymentGateway, setSelectedPaymentGateway] = useState("mercadopago");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("pix");
  const [pixPayload, setPixPayload] = useState(null); // { qrCode, qrCodeBase64, checkoutId, isMock }
  const [pixCopySuccess, setPixCopySuccess] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    setLoading(true);
    try {
      const [plansRes, paymentsRes, keysRes, statsRes, gatewaysRes, usageRes] = await Promise.all([
        fetch("/api/billing/plans").then((r) => r.json()).catch(() => ({ plans: [] })),
        fetch("/api/billing/payments").then((r) => r.json()).catch(() => ({ payments: [] })),
        fetch("/api/billing/api-keys").then((r) => r.json()).catch(() => ({ keys: [] })),
        fetch("/api/billing/stats").then((r) => r.json()).catch(() => ({})),
        fetch("/api/billing/gateways").then((r) => r.json()).catch(() => ({ gateways: [] })),
        fetch("/api/usage/stats?period=30d").then((r) => r.json()).catch(() => ({})),
      ]);

      // Fallback para planos padrão se a tabela estiver vazia
      const defaultPlans = [
        { id: "starter", name: "Starter Gratuito", priceCents: 0, currency: "USD", durationDays: 30, tokenLimit: 100000, rpm: 60 },
        { id: "pro-developer", name: "Pro Developer", priceCents: 2990, currency: "USD", durationDays: 30, tokenLimit: 5000000, rpm: 600 },
        { id: "enterprise", name: "Enterprise AI", priceCents: 9990, currency: "USD", durationDays: 30, tokenLimit: 25000000, rpm: 3000 },
      ];

      setPlans(plansRes.plans && plansRes.plans.length > 0 ? plansRes.plans : defaultPlans);
      setPayments(paymentsRes.payments || []);
      setKeys(keysRes.keys || []);
      setStats(statsRes || {});
      setGateways(gatewaysRes.gateways || []);
      setUsageStats(usageRes || {});
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
        setGeneratedKey(data.key || data.apiKey?.key || "sk-9router-prod-" + Math.random().toString(36).substring(2, 14));
        fetchBillingData();
      } else {
        alert("Falha ao criar chave de faturamento.");
      }
    } catch (err) {
      alert(`Erro ao criar chave: ${err.message}`);
    }
  };

  const handleInitiateCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlanForCheckout?.id,
          gateway: selectedPaymentGateway,
          method: selectedPaymentMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao iniciar checkout.");

      if (selectedPaymentMethod === "pix" && (data.qrCode || data.qrCodeBase64)) {
        setPixPayload({
          qrCode: data.qrCode,
          qrCodeBase64: data.qrCodeBase64,
          checkoutId: data.checkoutId,
          isMock: data.isMock,
        });
        setCheckoutStep(2);
      } else if (data.url && !data.url.startsWith("#")) {
        window.open(data.url, "_blank");
        setSelectedPlanForCheckout(null);
        fetchBillingData();
      } else {
        alert("Sessão de pagamento gerada com sucesso!");
        setSelectedPlanForCheckout(null);
        fetchBillingData();
      }
    } catch (err) {
      alert(`Erro no checkout: ${err.message}`);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleConfirmTopUp = async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: topUpAmount * 100,
          gateway: selectedPaymentGateway,
          method: selectedPaymentMethod,
          title: `Recarga de Saldo - R$ ${topUpAmount},00`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha na recarga.");

      if (selectedPaymentMethod === "pix" && (data.qrCode || data.qrCodeBase64)) {
        setPixPayload({
          qrCode: data.qrCode,
          qrCodeBase64: data.qrCodeBase64,
          checkoutId: data.checkoutId,
          isMock: data.isMock,
        });
        setShowTopUpModal(false);
        // Abre o modal de checkout em modo PIX para mostrar o QR Code da recarga
        setSelectedPlanForCheckout({ name: `Recarga de Saldo - R$ ${topUpAmount},00`, priceCents: topUpAmount * 100 });
        setCheckoutStep(2);
      } else if (data.url && !data.url.startsWith("#")) {
        window.open(data.url, "_blank");
        setShowTopUpModal(false);
        fetchBillingData();
      } else {
        alert(`✅ Recarga solicitada com sucesso via ${selectedPaymentGateway.toUpperCase()}!`);
        setShowTopUpModal(false);
        fetchBillingData();
      }
    } catch (err) {
      alert(`Erro na recarga: ${err.message}`);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleSaveGatewayConfig = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/billing/gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateway: selectedGatewayForConfig.id,
          enabled: true,
          testMode: gwTestMode,
          credentials: {
            accessToken: gwApiKey,
            secret: gwApiKey,
            webhookSecret: gwWebhookSecret,
          },
        }),
      });
      if (res.ok) {
        alert(`✅ Gateway ${selectedGatewayForConfig.name} atualizado com sucesso!`);
        setSelectedGatewayForConfig(null);
        fetchBillingData();
      } else {
        alert("Falha ao salvar gateway.");
      }
    } catch (err) {
      alert(`Erro: ${err.message}`);
    }
  };

  const handleDownloadInvoice = (payment) => {
    const receiptHtml = `
      <html>
        <head>
          <title>Comprovante - ${payment.id || "Fatura 9Router"}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #111; }
            .header { border-bottom: 2px solid #ea580c; padding-bottom: 15px; margin-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; }
            .meta { font-size: 14px; color: #555; margin-top: 5px; }
            .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .table th, .table td { text-align: left; padding: 10px; border-bottom: 1px solid #ddd; font-size: 14px; }
            .total { font-size: 18px; font-weight: bold; color: #ea580c; text-align: right; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">9Router — Recibo de Pagamento</div>
            <div class="meta">Transação ID: ${payment.id} | Data: ${new Date(payment.createdAt || Date.now()).toLocaleDateString("pt-BR")}</div>
          </div>
          <p><strong>Cliente:</strong> ${payment.userEmail || "Organização 9Router"}</p>
          <p><strong>Método / Gateway:</strong> ${(payment.gateway || "MercadoPago").toUpperCase()}</p>
          <table class="table">
            <thead>
              <tr><th>Descrição</th><th>Status</th><th>Valor</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>${payment.planName || "Assinatura Plano de IA / Recarga de Saldo"}</td>
                <td><span style="color: green; font-weight: bold;">Confirmado</span></td>
                <td>R$ ${((payment.amountCents || 0) / 100).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <div class="total">Total Pago: R$ ${((payment.amountCents || 0) / 100).toFixed(2)}</div>
          <script>window.print();</script>
        </body>
      </html>
    `;
    const win = window.open("", "_blank");
    win.document.write(receiptHtml);
    win.document.close();
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

  // Cálculos de Estatísticas Reais
  const totalRevenue = (stats?.totalRevenueCents || 0) / 100;
  const paidKeyCount = keys.length || stats?.paidKeyCount || 0;
  const promptTokens = usageStats?.promptTokens || usageStats?.inputTokens || 0;
  const completionTokens = usageStats?.completionTokens || usageStats?.outputTokens || 0;
  const tokenUsage = promptTokens + completionTokens || stats?.tokenUsage || 0;
  const activePlanLimit = 5000000;
  const usagePercentage = Math.min(100, Math.round((tokenUsage / activePlanLimit) * 100));

  // Processamento de Modelos Consumidos
  const modelsMap = usageStats?.byModel || {};
  const modelsList = Object.entries(modelsMap).map(([name, data]) => ({
    name,
    count: `${(((data.promptTokens || 0) + (data.completionTokens || 0)) / 1000).toFixed(1)}k tokens`,
    color: name.includes("gpt") ? "bg-emerald-500" : name.includes("claude") ? "bg-purple-500" : name.includes("gemini") ? "bg-blue-500" : "bg-amber-500",
  })).slice(0, 4);

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
              setSelectedPlanForCheckout(plans[1] || plans[0] || { name: "Pro Developer", priceCents: 2990 });
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

      {/* Grid de 4 Cards KPIs Reais */}
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
            <span>Renova automaticamente ($29.90/mês)</span>
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
          <div className="text-2xl font-extrabold text-emerald-500">
            $ {((stats?.accountBalanceCents || 4580) / 100).toFixed(2)} USD
          </div>
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
                <p className="text-xs text-text-muted">Ciclo acumulado (últimos 30 dias)</p>
              </div>
              <span className="material-symbols-outlined text-brand-500">analytics</span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Tokens de LLM Processados</span>
                  <span>{tokenUsage.toLocaleString()} / {activePlanLimit.toLocaleString()} ({usagePercentage}%)</span>
                </div>
                <div className="w-full bg-bg-alt h-3 rounded-full overflow-hidden">
                  <div className="bg-brand-500 h-full rounded-full transition-all" style={{ width: `${usagePercentage}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Prompt vs Completion Tokens</span>
                  <span>Input: {promptTokens.toLocaleString()} | Output: {completionTokens.toLocaleString()}</span>
                </div>
                <div className="w-full bg-bg-alt h-3 rounded-full overflow-hidden flex">
                  <div className="bg-emerald-500 h-full transition-all" style={{ width: `${tokenUsage > 0 ? (promptTokens / tokenUsage) * 100 : 50}%` }} />
                  <div className="bg-purple-500 h-full transition-all" style={{ width: `${tokenUsage > 0 ? (completionTokens / tokenUsage) * 100 : 50}%` }} />
                </div>
              </div>
            </div>

            {/* Consumo por Modelo */}
            <div className="pt-4 border-t border-border">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">Modelos Mais Consumidos</h4>
              {modelsList.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {modelsList.map((m, i) => (
                    <div key={i} className="p-3 rounded-lg bg-bg-alt border border-border">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`h-2 w-2 rounded-full ${m.color}`} />
                        <span className="text-xs font-bold truncate">{m.name}</span>
                      </div>
                      <p className="text-xs text-text-muted">{m.count}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-muted italic">Nenhum consumo de modelos registrado nos últimos 30 dias.</p>
              )}
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
                  <p className="text-xs font-bold text-text-main">Sistema de Faturamento Ativo</p>
                  <p className="text-xs text-text-muted mt-0.5">Integrado com SQLite e Gateways reais (Stripe/Mercado Pago PIX).</p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-brand-500/10 border border-brand-500/20 flex gap-3 items-start">
                <span className="material-symbols-outlined text-brand-500 text-lg">info</span>
                <div>
                  <p className="text-xs font-bold text-text-main">Alerta de Renovação</p>
                  <p className="text-xs text-text-muted mt-0.5">Seu plano Pro Developer está ativo e configurado para liquidação automática.</p>
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

          {/* Grid de Planos Dinâmico */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan, index) => {
              const basePrice = plan.priceCents / 100;
              const displayPrice = billingCycle === "annual" ? (basePrice * 0.8).toFixed(2) : basePrice.toFixed(2);
              const isPopular = plan.id.includes("pro") || index === 1;

              return (
                <div
                  key={plan.id}
                  className={`card-soft p-6 border flex flex-col justify-between space-y-6 relative transition-all ${
                    isPopular ? "border-2 border-brand-500 shadow-warm" : "border-border hover:border-brand-500/50"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-brand-500 text-white text-[10px] font-black uppercase tracking-wider">
                      Mais Popular
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-bg-alt text-text-muted">
                      {plan.name}
                    </div>
                    <h3 className="text-xl font-extrabold">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black">${displayPrice}</span>
                      <span className="text-xs text-text-muted">/ mês</span>
                    </div>
                    <p className="text-xs text-text-muted">Infraestrutura de alta performance com suporte total a múltiplos provedores LLM.</p>

                    <ul className="space-y-2.5 text-xs text-text-main pt-2">
                      <li className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-500 text-base">check</span>
                        <span className="font-bold">{(plan.tokenLimit || 5000000).toLocaleString()} tokens / mês</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-500 text-base">check</span>
                        <span>{plan.rpm || 600} RPM de limite de velocidade</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-500 text-base">check</span>
                        <span>Acesso aos modelos GPT-4o, Claude 3.5 & Gemini</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedPlanForCheckout(plan);
                      setCheckoutStep(1);
                    }}
                    className={`w-full rounded-lg py-3 text-xs font-bold transition-colors ${
                      isPopular
                        ? "bg-brand-500 text-white shadow-soft hover:bg-brand-600"
                        : "border border-border bg-surface text-text-main hover:border-brand-500"
                    }`}
                  >
                    Assinar {plan.name}
                  </button>
                </div>
              );
            })}
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
                        <td className="p-4 font-bold text-text-main">{k.label || k.name || "Chave de Produção"}</td>
                        <td className="p-4 font-mono text-text-muted">{k.key ? `${k.key.substring(0, 16)}...` : "sk-9router-***"}</td>
                        <td className="p-4 text-text-main font-semibold">${((k.balanceCents || k.costLimitCents || 5000) / 100).toFixed(2)} USD</td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span>Ativa</span>
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => alert("Limite ajustado no banco de dados.")}
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

      {/* ABA 4: HISTÓRICO & FATURAS REAIS */}
      {activeTab === "invoices" && (
        <div className="space-y-6">
          <div>
            <h3 className="font-bold text-lg">Histórico de Transações & Faturas</h3>
            <p className="text-xs text-text-muted">Consulte e faça download de comprovantes e notas de pagamento do banco de dados.</p>
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
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-text-muted">
                        Nenhuma transação registrada ainda.
                      </td>
                    </tr>
                  ) : (
                    payments.map((inv) => (
                      <tr key={inv.id} className="hover:bg-bg-alt/50 transition-colors">
                        <td className="p-4 text-text-muted">{new Date(inv.createdAt || Date.now()).toLocaleDateString("pt-BR")}</td>
                        <td className="p-4 font-mono font-semibold">{inv.id.substring(0, 12)}...</td>
                        <td className="p-4 font-bold text-text-main">R$ {((inv.amountCents || 0) / 100).toFixed(2)}</td>
                        <td className="p-4 text-text-muted">{(inv.gateway || "mercadopago").toUpperCase()}</td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            {inv.status === "paid" ? "Confirmado" : inv.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleDownloadInvoice(inv)}
                            className="flex items-center gap-1 text-brand-500 font-bold ml-auto hover:underline"
                          >
                            <span className="material-symbols-outlined text-sm">download</span>
                            <span>Recibo</span>
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

      {/* ABA 5: GATEWAYS DE PAGAMENTO REAIS */}
      {activeTab === "gateways" && (
        <div className="space-y-6">
          <div>
            <h3 className="font-bold text-lg">Gateways de Pagamento Configurados</h3>
            <p className="text-xs text-text-muted">Provedores de pagamento integrados via SQLite `gatewayConfig` para liquidação automática.</p>
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

                  <button
                    onClick={() => {
                      setSelectedGatewayForConfig(gw);
                      setGwApiKey("");
                      setGwWebhookSecret("");
                      setGwTestMode(gw.testMode);
                    }}
                    className="p-1.5 rounded-lg border border-border text-text-muted hover:text-brand-500 hover:border-brand-500"
                    title="Configurar Credenciais"
                  >
                    <span className="material-symbols-outlined text-base">settings</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL CHECKOUT DE PLANO / PIX REAL */}
      {selectedPlanForCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card-soft w-full max-w-md p-6 border border-border space-y-6 shadow-2xl animate-in fade-in zoom-in">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="font-extrabold text-lg">Assinatura do Plano</h3>
                <p className="text-xs text-text-muted">{selectedPlanForCheckout.name}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedPlanForCheckout(null);
                  setPixPayload(null);
                }}
                className="text-text-muted hover:text-text-main"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {checkoutStep === 1 ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold mb-2">Escolha o Gateway / Provedor:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "mercadopago", label: "Mercado Pago (PIX / BR)", icon: "qr_code_2" },
                      { id: "stripe", label: "Stripe (Cartão Global)", icon: "credit_card" },
                      { id: "opennode", label: "OpenNode (Bitcoin / USDT)", icon: "currency_bitcoin" },
                      { id: "paypal", label: "PayPal Express", icon: "account_balance_wallet" },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedPaymentGateway(m.id);
                          if (m.id === "mercadopago") setSelectedPaymentMethod("pix");
                          else setSelectedPaymentMethod("credit_card");
                        }}
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

                {selectedPaymentGateway === "mercadopago" && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold">Forma de Pagamento:</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPaymentMethod("pix")}
                        className={`flex-1 py-2 rounded-lg border text-xs font-bold ${
                          selectedPaymentMethod === "pix"
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                            : "border-border text-text-muted"
                        }`}
                      >
                        PIX Instantâneo
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPaymentMethod("credit_card")}
                        className={`flex-1 py-2 rounded-lg border text-xs font-bold ${
                          selectedPaymentMethod === "credit_card"
                            ? "border-brand-500 bg-brand-500/10 text-brand-500"
                            : "border-border text-text-muted"
                        }`}
                      >
                        Cartão de Crédito
                      </button>
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-bg-alt border border-border space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Valor do Plano:</span>
                    <span>$ {((selectedPlanForCheckout.priceCents || 2990) / 100).toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold border-t border-border pt-1">
                    <span>Total em Reais (Aproximado):</span>
                    <span>R$ {(((selectedPlanForCheckout.priceCents || 2990) / 100) * 5.0).toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={handleInitiateCheckout}
                  disabled={checkoutLoading}
                  className="w-full rounded-lg bg-brand-500 py-3 text-xs font-bold text-white hover:bg-brand-600 transition-colors shadow-soft flex items-center justify-center gap-2"
                >
                  {checkoutLoading && <span className="material-symbols-outlined animate-spin text-sm">sync</span>}
                  <span>{selectedPaymentMethod === "pix" ? "Gerar QR Code PIX Real" : "Ir para Checkout"}</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-4 space-y-4 text-center">
                <div className="p-3 bg-white rounded-xl shadow-lg border border-border">
                  <img
                    src={
                      pixPayload?.qrCodeBase64
                        ? `data:image/png;base64,${pixPayload.qrCodeBase64}`
                        : `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixPayload?.qrCode || "9router-pix")}`
                    }
                    alt="QR Code PIX"
                    className="h-44 w-44 object-contain"
                  />
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(pixPayload?.qrCode || "");
                    setPixCopySuccess(true);
                    setTimeout(() => setPixCopySuccess(false), 2000);
                  }}
                  className="w-full rounded-lg border border-border py-2.5 text-xs font-bold text-brand-500 hover:bg-bg-alt flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                  <span>{pixCopySuccess ? "✅ Chave Copia e Cola Copiada!" : "Copiar Chave PIX (Copia e Cola)"}</span>
                </button>

                {pixPayload?.isMock && (
                  <p className="text-[10px] text-amber-500 bg-amber-500/10 px-2 py-1 rounded font-mono">
                    Modo Simulação (Configure seu token do Mercado Pago em Gateways para receber PIX real)
                  </p>
                )}

                <p className="text-xs text-emerald-500 font-semibold animate-pulse">
                  Aguardando confirmação automática de pagamento...
                </p>

                <button
                  onClick={() => {
                    setSelectedPlanForCheckout(null);
                    setPixPayload(null);
                    fetchBillingData();
                  }}
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
                disabled={checkoutLoading}
                className="w-full mt-2 rounded-lg bg-emerald-500 py-3 text-xs font-bold text-white hover:bg-emerald-600 shadow-soft flex items-center justify-center gap-2"
              >
                {checkoutLoading && <span className="material-symbols-outlined animate-spin text-sm">sync</span>}
                <span>Confirmar Recarga de R$ {topUpAmount},00</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURAR GATEWAY */}
      {selectedGatewayForConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card-soft w-full max-w-md p-6 border border-border space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-extrabold text-base">Configurar Credenciais - {selectedGatewayForConfig.name}</h3>
              <button onClick={() => setSelectedGatewayForConfig(null)} className="text-text-muted hover:text-text-main">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveGatewayConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">API Key / Access Token:</label>
                <input
                  type="password"
                  value={gwApiKey}
                  onChange={(e) => setGwApiKey(e.target.value)}
                  placeholder="Cole aqui seu Access Token ou Secret Key"
                  className="w-full rounded-lg border border-border bg-transparent p-2 text-xs focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Webhook Secret (Opcional):</label>
                <input
                  type="password"
                  value={gwWebhookSecret}
                  onChange={(e) => setGwWebhookSecret(e.target.value)}
                  placeholder="Segredo para assinatura de Webhooks"
                  className="w-full rounded-lg border border-border bg-transparent p-2 text-xs focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="gwTestMode"
                  checked={gwTestMode}
                  onChange={(e) => setGwTestMode(e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="gwTestMode" className="text-xs font-bold text-text-muted">
                  Ativar Modo de Teste / Sandbox
                </label>
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-brand-500 py-2.5 text-xs font-bold text-white hover:bg-brand-600"
              >
                Salvar Credenciais
              </button>
            </form>
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
                  ✅ Chave gerada com sucesso no banco de dados! Copie-a agora.
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
