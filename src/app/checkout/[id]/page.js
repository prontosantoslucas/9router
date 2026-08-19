"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle, XCircle, CreditCard, Lock } from "lucide-react";

export default function PublicCheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-bg-alt"><Loader2 className="animate-spin text-brand-600" size={32} /></div>}>
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
  const [selectedProvider, setSelectedProvider] = useState("stripe");

  useEffect(() => {
    fetchCheckout();
  }, [checkoutId]);

  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "success") {
      setError(null);
      // Atualiza o checkout apÃ³s redirect do gateway
      setTimeout(fetchCheckout, 1500);
    }
  }, [searchParams]);

  async function fetchCheckout() {
    try {
      setLoading(true);
      const res = await fetch(`/api/checkout/${checkoutId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout nÃ£o encontrado");
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
        <div className="text-center">
          <Loader2 className="animate-spin text-brand-600 mx-auto mb-4" size={40} />
          <p className="text-text-muted">Carregando pagamento...</p>
        </div>
      </div>
    );
  }

  if (error || !checkout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-alt">
        <div className="bg-surface rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <XCircle className="text-label-crimson mx-auto mb-4" size={48} />
          <h1 className="text-xl font-bold mb-2">Pagamento indisponÃ­vel</h1>
          <p className="text-text-muted mb-6">{error || "Link de checkout invÃ¡lido ou expirado."}</p>
          <a href="/" className="text-brand-600 hover:underline">â† Voltar</a>
        </div>
      </div>
    );
  }

  const amount = (checkout.amountCents / 100).toFixed(2);
  const isPaid = checkout.status === "paid";

  return (
    <div className="min-h-screen bg-bg-alt flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card principal */}
        <div className="bg-surface rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-brand-600 to-brand-800 p-6 text-white">
            <h1 className="text-2xl font-bold mb-1">{checkout.description || "Pagamento"}</h1>
            <p className="text-brand-100 text-sm">Fatura para {contact?.name || "Cliente"}</p>
          </div>

          {/* Corpo */}
          <div className="p-6">
            {isPaid ? (
              <div className="text-center py-8">
                <CheckCircle className="text-label-emerald mx-auto mb-4" size={56} />
                <h2 className="text-2xl font-bold text-label-emerald mb-2">Pagamento Confirmado!</h2>
                <p className="text-text-muted mb-2">
                  Recebemos <span className="font-bold">R$ {amount}</span> com sucesso.
                </p>
                <p className="text-text-muted text-sm">
                  ReferÃªncia: {checkout.externalRef || checkout.id.slice(0, 8)}
                </p>
              </div>
            ) : (
              <>
                {/* Valor */}
                <div className="text-center mb-6">
                  <div className="text-sm text-text-muted mb-1">Valor a pagar</div>
                  <div className="text-5xl font-bold text-text-main">
                    <span className="text-2xl align-top">R$</span> {amount}
                  </div>
                </div>

                {/* SeleÃ§Ã£o de gateway */}
                {providers.length > 1 && (
                  <div className="mb-6">
                    <label className="text-sm font-medium text-text-main mb-2 block">
                      Forma de pagamento
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {providers.map((p) => (
                        <button
                          key={p}
                          onClick={() => setSelectedProvider(p)}
                          className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                            selectedProvider === p
                              ? "border-brand-500 bg-label-blue-bg text-label-blue"
                              : "border-border hover:border-border text-text-muted"
                          }`}
                        >
                          {p === "stripe" ? "ðŸ’³ CartÃ£o" : p === "paypal" ? "ðŸ…¿ï¸ PayPal" : "ðŸŸ¡ Mercado Livre"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* BotÃ£o */}
                <button
                  onClick={handlePay}
                  disabled={creating}
                  className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold py-3.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Processando...
                    </>
                  ) : (
                    <>
                      <CreditCard size={20} />
                      Pagar {amount}
                    </>
                  )}
                </button>
              </>
            )}

            {/* SeguranÃ§a */}
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-text-subtle">
              <Lock size={14} />
              Pagamento seguro e criptografado
            </div>
          </div>
        </div>

        {/* Status */}
        {!isPaid && checkout.status !== "pending" && (
          <div className="mt-4 text-center text-sm text-text-muted">
            Status: <span className="font-medium capitalize">{checkout.status}</span>
          </div>
        )}
      </div>
    </div>
  );
}

