import { DM_Sans, Outfit, JetBrains_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "material-symbols/outlined.css";
import "./globals.css";
import { ThemeProvider } from "@/shared/components/ThemeProvider";
import "@/lib/network/initOutboundProxy"; // Auto-initialize outbound proxy env
import "@/shared/services/bootstrap"; // Auto-run initializeApp (watchdog, auto-resume tunnel)
import { initConsoleLogCapture } from "@/lib/consoleLogBuffer";
import { RuntimeI18nProvider } from "@/i18n/RuntimeI18nProvider";

// Hook console immediately at module load time (server-side only, runs once)
initConsoleLogCapture();

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

// CAUSA RAIZ do bug "/login mostra RSC cru": o Next prerenderiza páginas
// estáticas (login, landing, callback) e as serve com `Cache-Control:
// s-maxage=31536000`. O edge do Railway (railway-hikari) respeita esse header,
// cacheia a variante RSC (.rsc / text/x-component) sob a chave da URL e passa a
// servir esse payload cru para navegações HTML (não respeita `Vary: rsc`).
// `force-dynamic` no layout raiz torna TODA rota dinâmica → o Next emite
// `Cache-Control: private, no-cache, no-store, must-revalidate` → o edge nunca
// mais cacheia página. É a única correção de raiz (headers no-store sozinhos
// não bastavam porque a página continuava estática e re-assinava s-maxage).
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = {
  title: "MaxRouter - AI Router & Gateway",
  description: "One endpoint for all your AI providers. Manage keys, monitor usage, and scale effortlessly.",
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="MaxRouter" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
        <script
          dangerouslySetInnerHTML={{
            __html: `if(document.fonts&&document.fonts.ready){document.fonts.ready.then(function(){document.documentElement.classList.add('fonts-loaded')})}else{document.documentElement.classList.add('fonts-loaded')};(function(){if(typeof window!=='undefined'){if(document.documentElement&&document.documentElement.innerText&&document.documentElement.innerText.indexOf('$Sreact')!==-1){if('caches'in window){caches.keys().then(function(keys){for(var i=0;i<keys.length;i++){caches.delete(keys[i]);}});}if('serviceWorker'in navigator){navigator.serviceWorker.getRegistrations().then(function(regs){for(var i=0;i<regs.length;i++){regs[i].unregister();}});}window.location.reload(true);}}})();`,
          }}
        />
      </head>
      <body className={`${dmSans.variable} ${outfit.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ThemeProvider>
          <RuntimeI18nProvider>
            {children}
          </RuntimeI18nProvider>
        </ThemeProvider>
        <GoogleAnalytics gaId={"G-LC959F603F"} />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').then(function(reg){reg.update()})})}`,
          }}
        />
      </body>
    </html>
  );
}
