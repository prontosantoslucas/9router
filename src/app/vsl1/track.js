// Eventos de conversão (GA4). O GoogleAnalytics já é montado no layout raiz,
// então aqui só empurramos eventos pro gtag global.
//
// Fail-open por design: bloqueador de anúncio, GA fora do ar ou consent
// negado deixam window.gtag indefinido — e nesse caso um CTA NUNCA pode
// deixar de funcionar por causa de telemetria. Só engole e segue.

export function track(event, params = {}) {
  try {
    if (typeof window === "undefined") return;
    if (typeof window.gtag !== "function") return;
    window.gtag("event", event, params);
  } catch {
    // telemetria nunca quebra fluxo de venda
  }
}
