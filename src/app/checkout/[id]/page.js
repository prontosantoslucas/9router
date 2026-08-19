"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle, XCircle, CreditCard, Lock, ArrowLeft, ShieldCheck, Zap } from "lucide-react";

export default function PublicCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-bg-alt">
          <Loader2 className="animate-spin text-brand-500" size={32} />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const checkoutId = params.id;

  const [checkout, setCheckout] = useState(null);
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState("mercadopago");

  useEffect(() => {
    fetchCheckout();
  }, [checkoutId]);

  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "success") {
      setError(null);
      // Atualiza o checkout após redirect do gateway
      setTimeout(fetchCheckout, 1500);
    }
  }, [searchParams]);

  async function fetchCheckout() {
    try {
      setLoading(true);
      const res = await fetch(`/api/checkout/${checkoutId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout não encontrado");
      setCheckout(data.checkout);
      setContact(data.contact);
      setProviders(data.providers || []);
      if (data.providers?.length > 0) setSelectedProvider(data.providers[0]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePay() {
    try {
      setCreating(true);
      setError(null);
      const res = await fetch(`/api/checkout/${checkoutId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar pagamento");

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data.mock) {
        alert("Modo sandbox: pagamento simulado com sucesso!");
        fetchCheckout();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-alt">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-brand-500 mx-auto" size={40} />
          <p className="text-xs font-mono text-text-muted">Carregando detalhes do pagamento...</p>
        </div>
      </div>
    );
  }

  if (error || !checkout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-alt p-4">
        <div className="bg-surface rounded-2xl border border-border p-8 max-w-md w-full text-center shadow-xl space-y-4">
          <XCircle className="text-crimson-400 mx-auto" size={48} />
          <h1 className="text-lg font-bold text-text-main">Pagamento indisponível</h1>
          <p className="text-xs text-text-muted leading-relaxed">{error || "Link de checkout inválido ou expirado."}</p>
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-400 hover:underline pt-2">
            <ArrowLeft size={14} /> Voltar para o início
          </Link>
        </div>
      </div>
    );
  }

  const amount = (checkout.amountCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const isPaid = checkout.status === "paid";

  return (
    <div className="min-h-screen bg-bg-alt flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Card principal */}
        <div className="bg-surface rounded-2xl border border-border shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-brand-500 to-brand-600 p-6 text-white space-y-1">
            <div className="flex items-center gap-2 text-xs text-white/80 font-mono">
              <ShieldCheck size={14} /> Checkout Seguro
            </div>
            <h1 className="text-xl font-bold font-display text-white">{checkout.description || "Pagamento de Serviços"}</h1>
            <p className="text-xs text-white/80">Fatura emitida para: {contact?.name || "Cliente"}</p>
          </div>

          {/* Corpo */}
          <div className="p-6 space-y-6">
            {isPaid ? (
              <div className="text-center py-6 space-y-3">
                <CheckCircle className="text-emerald-400 mx-auto" size={56} />
                <h2 className="text-xl font-bold text-emerald-400 font-display">Pagamento Confirmado!</h2>
                <p className="text-xs text-text-muted">
                  Recebemos <span className="font-bold text-text-main">R$ {amount}</span> com sucesso.
                </p>
                <p className="text-[11px] font-mono text-text-muted bg-surface-2 py-1.5 px-3 rounded-lg">
                  Referência: {checkout.externalRef || checkout.id.slice(0, 12)}
                </p>
              </div>
            ) : (
              <>
                {/* Valor */}
                <div className="text-center space-y-1 bg-surface-2 p-4 rounded-xl border border-border">
                  <div className="text-xs text-text-muted font-medium">Valor total a pagar</div>
                  <div className="text-4xl font-black font-display text-text-main">
                    <span className="text-lg font-bold text-brand-400 mr-1">R$</span>{amount}
                  </div>
                </div>

                {/* Seleção de gateway */}
                {providers.length > 1 && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-text-muted block">
                      Forma de pagamento
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {providers.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setSelectedProvider(p)}
                          className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                            selectedProvider === p
                              ? "border-brand-500 bg-brand-500/10 text-brand-400 shadow-soft"
                              : "border-border bg-surface-2 hover:border-brand-500/50 text-text-muted"
                          }`}
                        >
                          {p === "stripe" ? "💳 Cartão" : p === "paypal" ? "🅿️ PayPal" : "⚡ Pix"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Botão de Pagar */}
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={creating}
                  className="w-full bg-gradient-to-r from-brand-500 to-brand-600 hover:opacity-95 text-white font-bold py-3 rounded-xl shadow-soft transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
                >
                  {creating ? (
                    <>
                      <Loader2 className="animate-spin size-4" />
                      <span>Processando pagamento...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="size-4" />
                      <span>Pagar R$ {amount} agora</span>
                    </>
                  )}
                </button>
              </>
            )}

            {/* Segurança */}
            <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] font-mono text-text-muted border-t border-border">
              <Lock size={12} className="text-emerald-400" />
              <span>Ambiente seguro com criptografia de ponta a ponta</span>
            </div>
          </div>
        </div>

        {/* Status adicional */}
        {!isPaid && checkout.status !== "pending" && (
          <div className="text-center text-xs font-mono text-text-muted">
            Status da Fatura: <span className="font-bold uppercase text-brand-400">{checkout.status}</span>
          </div>
        )}
      </div>
    </div>
  );
}
