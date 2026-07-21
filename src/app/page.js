"use client";
import { useRouter } from "next/navigation";
import Navigation from "./landing/components/Navigation";
import HeroSection from "./landing/components/HeroSection";
import FlowAnimation from "./landing/components/FlowAnimation";
import HowItWorks from "./landing/components/HowItWorks";
import Features from "./landing/components/Features";
import GetStarted from "./landing/components/GetStarted";
import AgentSection from "./landing/components/AgentSection";
import Footer from "./landing/components/Footer";

export default function LandingPage() {
  const router = useRouter();
  return (
    <div className="relative text-white font-sans overflow-x-hidden antialiased selection:bg-[#f97815] selection:text-white">
      {/* Animated Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#181411]">
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: `linear-gradient(to right, #f97815 1px, transparent 1px), linear-gradient(to bottom, #f97815 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}></div>
        
        {/* Animated gradient orbs */}
        <div className="absolute top-0 left-1/4 w-[700px] h-[700px] bg-[#f97815]/12 rounded-full blur-[130px] animate-blob"></div>
        <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[130px] animate-blob" style={{ animationDelay: '2s', animationDuration: '22s' }}></div>
        <div className="absolute bottom-0 left-1/2 w-[650px] h-[650px] bg-blue-500/8 rounded-full blur-[130px] animate-blob" style={{ animationDelay: '4s', animationDuration: '25s' }}></div>
        
        {/* Vignette effect */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(circle at center, transparent 0%, rgba(24, 20, 17, 0.4) 100%)'
        }}></div>
      </div>

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
      
      {/* Global styles for keyframes */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes dash {
          to { stroke-dashoffset: -20; }
        }
        @keyframes blob {
          0%, 100% { 
            transform: translate(0, 0) scale(1);
          }
          33% { 
            transform: translate(30px, -50px) scale(1.1);
          }
          66% { 
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        .animate-blob {
          animation: blob 20s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
