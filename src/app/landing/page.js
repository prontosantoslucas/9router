"use client";

import { useRouter } from "next/navigation";
import Navigation from "./components/Navigation";
import HeroSection from "./components/HeroSection";
import FlowAnimation from "./components/FlowAnimation";
import HowItWorks from "./components/HowItWorks";
import Features from "./components/Features";
import GetStarted from "./components/GetStarted";
import AgentSection from "./components/AgentSection";
import Footer from "./components/Footer";

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="relative text-text-main font-sans overflow-x-hidden antialiased bg-bg">
      <div className="relative z-10">
        <Navigation />

        <main>
          {/* Hero with Flow Animation */}
          <div className="relative">
            <HeroSection />
            <div className="flex justify-center pb-20">
              <FlowAnimation />
            </div>
          </div>

          <AgentSection />
          <GetStarted />
          <HowItWorks />
          <Features />

          {/* CTA Section */}
          <section className="py-24 px-6 relative overflow-hidden border-t border-border/40 bg-hero-gradient">
            <div className="max-w-4xl mx-auto text-center relative z-10 space-y-6">
              <h2 className="text-3xl sm:text-5xl font-extrabold text-text-main">
                Pronto para Simplificar sua Infraestrutura de IA?
              </h2>
              <p className="text-base sm:text-lg text-text-muted max-w-2xl mx-auto">
                Orquestre seus modelos de IA e tenha o Agente Lucas respondendo por você no WhatsApp, Telegram e Web.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                <button
                  onClick={() => router.push("/chat")}
                  className="w-full sm:w-auto h-13 px-8 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-base font-bold transition-all shadow-warm flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">forum</span>
                  <span>Conversar com o Lucas</span>
                </button>
                <button
                  onClick={() => router.push("/dashboard2")}
                  className="w-full sm:w-auto h-13 px-8 rounded-xl border border-border bg-surface hover:bg-bg-alt text-text-main text-base font-bold transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">tune</span>
                  <span>Painel do Agente</span>
                </button>
              </div>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </div>
  );
}
