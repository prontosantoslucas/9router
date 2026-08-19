"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  return (
    <nav className="fixed top-0 z-50 w-full bg-[#0f1115]/80 backdrop-blur-md border-b border-[#262b33]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer bg-transparent border-none p-0"
          onClick={() => router.push("/")}
          aria-label="Navigate to home"
        >
          <div className="size-8 rounded bg-linear-to-br from-[#3b82f6] to-blue-700 flex items-center justify-center text-white">
            <span className="material-symbols-outlined text-[20px]">hub</span>
          </div>
          <h2 className="text-white text-xl font-bold tracking-tight">MaxRouter</h2>
        </button>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-8">
          <a className="text-gray-300 hover:text-white text-sm font-medium transition-colors" href="#features">Recursos</a>
          <a className="text-gray-300 hover:text-white text-sm font-medium transition-colors" href="#how-it-works">Como Funciona</a>
          <a className="text-gray-300 hover:text-white text-sm font-medium transition-colors" href="#lucas">Agente Lucas</a>
          <button
            onClick={() => router.push("/chat")}
            className="text-[#3b82f6] hover:underline text-sm font-semibold transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">forum</span>
            <span>Chat Lucas</span>
          </button>
        </div>

        {/* CTA Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard2")}
            className="hidden sm:flex h-9 items-center justify-center rounded-lg px-4 border border-[#262b33] text-white hover:bg-[#171a21] text-sm font-bold transition-all"
          >
            Painel Lucas
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="flex h-9 items-center justify-center rounded-lg px-4 bg-[#3b82f6] hover:bg-[#2563eb] transition-all text-[#0f1115] text-sm font-bold shadow-[0_0_15px_rgba(59,130,246,0.45)]"
          >
            Dashboard
          </button>
          <button
            className="md:hidden text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="material-symbols-outlined">{mobileMenuOpen ? "close" : "menu"}</span>
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#262b33] bg-[#0f1115]/95 backdrop-blur-md">
          <div className="flex flex-col gap-4 p-6">
            <a className="text-gray-300 hover:text-white text-sm font-medium" href="#features" onClick={() => setMobileMenuOpen(false)}>Recursos</a>
            <a className="text-gray-300 hover:text-white text-sm font-medium" href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>Como Funciona</a>
            <a className="text-gray-300 hover:text-white text-sm font-medium" href="#lucas" onClick={() => setMobileMenuOpen(false)}>Agente Lucas</a>
            <button
              onClick={() => { setMobileMenuOpen(false); router.push("/chat"); }}
              className="text-left text-[#3b82f6] text-sm font-bold"
            >
              Chat do Lucas
            </button>
            <button
              onClick={() => { setMobileMenuOpen(false); router.push("/dashboard"); }}
              className="h-9 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-[#0f1115] text-sm font-bold"
            >
              Dashboard
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
