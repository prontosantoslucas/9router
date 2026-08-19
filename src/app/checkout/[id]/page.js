"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle, XCircle, CreditCard, Lock } from "lucide-react";

export default function PublicCheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-600" size={32} /></div>}>
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="animate-spin text-blue-600 mx-auto mb-4" size={40} />
          <p className="text-gray-500">Carregando pagamento...</p>
        </div>
      </div>
    );
  }

  if (error || !checkout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <XCircle className="text-red-500 mx-auto mb-4" size={48} />
          <h1 className="text-xl font-bold mb-2">Pagamento indisponível</h1>
          <p className="text-gray-600 mb-6">{error || "Link de checkout inválido ou expirado."}</p>
          <a href="/" className="text-blue-600 hover:underline">← Voltar</a>
        </div>
      </div>
    );
  }

  const amount = (checkout.amountCents / 100).toFixed(2);
  const isPaid = checkout.status === "paid";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
            <h1 className="text-2xl font-bold mb-1">{checkout.description || "Pagamento"}</h1>
            <p className="text-blue-100 text-sm">Fatura para {contact?.name || "Cliente"}</p>
          </div>

          {/* Corpo */}
          <div className="p-6">
            {isPaid ? (
              <div className="text-center py-8">
                <CheckCircle className="text-green-500 mx-auto mb-4" size={56} />
                <h2 className="text-2xl font-bold text-green-700 mb-2">Pagamento Confirmado!</h2>
                <p className="text-gray-600 mb-2">
                  Recebemos <span className="font-bold">R$ {amount}</span> com sucesso.
                </p>
                <p className="text-gray-500 text-sm">
                  Referência: {checkout.externalRef || checkout.id.slice(0, 8)}
                </p>
              </div>
            ) : (
              <>
                {/* Valor */}
                <div className="text-center mb-6">
                  <div className="text-sm text-gray-500 mb-1">Valor a pagar</div>
                  <div className="text-5xl font-bold text-gray-900">
                    <span className="text-2xl align-top">R$</span> {amount}
                  </div>
                </div>

                {/* Seleção de gateway */}
                {providers.length > 1 && (
                  <div className="mb-6">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Forma de pagamento
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {providers.map((p) => (
                        <button
                          key={p}
                          onClick={() => setSelectedProvider(p)}
                          className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                            selectedProvider === p
                              ? "border-blue-600 bg-blue-50 text-blue-700"
                              : "border-gray-200 hover:border-gray-300 text-gray-600"
                          }`}
                        >
                          {p === "stripe" ? "💳 Cartão" : p === "paypal" ? "🅿️ PayPal" : "🟡 Mercado Livre"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Botão */}
                <button
                  onClick={handlePay}
                  disabled={creating}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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

            {/* Segurança */}
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
              <Lock size={14} />
              Pagamento seguro e criptografado
            </div>
          </div>
        </div>

        {/* Status */}
        {!isPaid && checkout.status !== "pending" && (
          <div className="mt-4 text-center text-sm text-gray-500">
            Status: <span className="font-medium capitalize">{checkout.status}</span>
          </div>
        )}
      </div>
    </div>
  );
}