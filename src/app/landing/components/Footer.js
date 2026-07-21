"use client";

import { useRouter } from "next/navigation";

export default function Footer() {
  const router = useRouter();

  return (
    <footer className="border-t border-border bg-bg py-12 px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="size-7 rounded bg-gradient-to-tr from-brand-600 to-amber-400 flex items-center justify-center text-white font-bold shadow-soft">
            <span className="material-symbols-outlined text-base">hub</span>
          </div>
          <span className="text-sm font-bold text-text-main">9Router & Agente Lucas</span>
        </div>

        <div className="flex items-center gap-6 text-xs text-text-muted">
          <button onClick={() => router.push("/chat")} className="hover:text-text-main transition-colors">Chat</button>
          <button onClick={() => router.push("/dashboard2")} className="hover:text-text-main transition-colors">Painel do Lucas</button>
          <button onClick={() => router.push("/dashboard")} className="hover:text-text-main transition-colors">Dashboard ERP</button>
        </div>

        <span className="text-xs text-text-subtle">
          © {new Date().getFullYear()} 9Router. Todos os direitos reservados.
        </span>
      </div>
    </footer>
  );
}
