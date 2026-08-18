"use client";

import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/shared/utils/cn";
import { APP_CONFIG, UPDATER_CONFIG } from "@/shared/constants/config";
import { MEDIA_PROVIDER_KINDS } from "@/shared/constants/providers";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import ThemeToggle from "./ThemeToggle";
import Button from "./Button";
import { ConfirmModal } from "./Modal";
import NineRemotePromoModal from "./NineRemotePromoModal";

const VISIBLE_MEDIA_KINDS = ["embedding", "image", "tts", "stt"];
const COMBINED_WEB_ITEM = {
  id: "web",
  label: "Web Fetch & Search",
  icon: "travel_explore",
  href: "/dashboard/media-providers/web",
};

// 🏛️ Estrutura de Módulos (Estilo ERP Olist / Double-Column & Minimizable)
const MODULES = [
  {
    id: "lucas",
    label: "agente lucas",
    shortLabel: "Lucas",
    icon: "smart_toy",
    badge: "IA",
    items: [
      { href: "/chat", label: "Chat do Lucas", icon: "forum", desc: "Atendimento autônomo e memória" },
      { href: "/coder", label: "Coder do Lucas", icon: "code", desc: "IDE inteligente do Agente" },
      { href: "/dashboard", label: "Painel do Lucas", icon: "dashboard_customize", desc: "Status, métricas e canais" },
    ],
  },
  {
    id: "routing",
    label: "roteamento",
    shortLabel: "Roteamento",
    icon: "alt_route",
    items: [
      { href: "/dashboard/endpoint", label: "Endpoint API", icon: "api", desc: "Rotas OpenAI compatíveis" },
      { href: "/dashboard/providers", label: "Provedores", icon: "dns", desc: "Conexões upstream de IA" },
      { href: "/dashboard/combos", label: "Combinações", icon: "layers", desc: "Chains e fallbacks de modelos" },
      { href: "/dashboard/proxy-pools", label: "Proxy Pools", icon: "lan", desc: "Túneis e pools de saída" },
    ],
  },
  {
    id: "metrics",
    label: "métricas",
    shortLabel: "Métricas",
    icon: "monitoring",
    items: [
      { href: "/dashboard/telemetry", label: "Telemetria", icon: "query_stats", desc: "Tráfego em tempo real" },
      { href: "/dashboard/usage", label: "Consumo & Tokens", icon: "bar_chart", desc: "Uso e custos detalhados" },
      { href: "/dashboard/analytics", label: "Analytics", icon: "insights", desc: "Métricas de performance" },
      { href: "/dashboard/scanner", label: "Scanner", icon: "search", desc: "Saúde e cota de modelos" },
    ],
  },
  {
    id: "tools",
    label: "ferramentas",
    shortLabel: "Ferramentas",
    icon: "science",
    items: [
      { href: "/dashboard/playground", label: "Playground A/B", icon: "compare", desc: "Comparador de prompts" },
      { href: "/dashboard/rag", label: "RAG Documentos", icon: "folder_data", desc: "Base vetorial SQLite" },
      { href: "/dashboard/skills", label: "Skills de IA", icon: "extension", desc: "Capacidades do agente" },
      { href: "/dashboard/token-saver", label: "Token Saver", icon: "savings", desc: "Compressão de contexto" },
      { href: "/dashboard/cli-tools", label: "Ferramentas CLI", icon: "terminal", desc: "Integrações com terminal" },
    ],
  },
  {
    id: "business",
    label: "negócios",
    shortLabel: "Negócios",
    icon: "business_center",
    items: [
      { href: "/dashboard/billing", label: "Faturamento & Planos", icon: "payments", desc: "Créditos, PIX e faturas" },
      { href: "/dashboard/crm", label: "CRM de Clientes", icon: "people", desc: "Prospecção B2B de leads" },
    ],
  },
  {
    id: "system",
    label: "sistema",
    shortLabel: "Sistema",
    icon: "tune",
    items: [
      { href: "/dashboard/quota", label: "Quotas de Uso", icon: "data_usage", desc: "Políticas por chave de API" },
      { href: "/dashboard/notion-config", label: "Notion Sync", icon: "book", desc: "Sincronização de base Notion" },
      { href: "/dashboard/console-log", label: "Console Log", icon: "terminal", desc: "Logs do servidor Next.js" },
      { href: "/dashboard/profile", label: "Configurações", icon: "settings", desc: "Preferências e chaves" },
    ],
  },
];

export default function Sidebar({ onClose }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeFlyout, setActiveFlyout] = useState(null);

  // Determina qual módulo está ativo a partir da rota atual
  const initialActiveModule = useMemo(() => {
    for (const mod of MODULES) {
      if (
        mod.items.some((item) => {
          if (item.href === "/dashboard") return pathname === "/dashboard";
          if (item.href === "/") return pathname === "/";
          return pathname.startsWith(item.href);
        })
      ) {
        return mod.id;
      }
    }
    if (pathname.startsWith("/dashboard/media-providers") || pathname.startsWith("/dashboard/translator")) {
      return "system";
    }
    return "lucas";
  }, [pathname]);

  const [selectedModuleId, setSelectedModuleId] = useState(initialActiveModule);
  const [mediaOpen, setMediaOpen] = useState(false);

  // Modals & Updater states
  const [showRemoteModal, setShowRemoteModal] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [shutdownCountdown, setShutdownCountdown] = useState(0);
  const [enableTranslator, setEnableTranslator] = useState(false);
  const { copied, copy } = useCopyToClipboard(2000);

  useEffect(() => {
    setMounted(true);
    try {
      const savedCollapsed = localStorage.getItem("9router_sidebar_collapsed");
      if (savedCollapsed !== null) {
        setIsCollapsed(savedCollapsed === "true");
      }
    } catch {}
  }, []);

  useEffect(() => {
    setSelectedModuleId(initialActiveModule);
    if (pathname.startsWith("/dashboard/media-providers")) {
      setMediaOpen(true);
    }
  }, [pathname, initialActiveModule]);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data?.enableTranslator) setEnableTranslator(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/version")
      .then((res) => res.json())
      .then((data) => {
        if (data?.hasUpdate) setUpdateInfo(data);
      })
      .catch(() => {});
  }, []);

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    try {
      localStorage.setItem("9router_sidebar_collapsed", String(next));
    } catch {}
  };

  const currentModule = MODULES.find((m) => m.id === selectedModuleId) || MODULES[0];

  const isItemActive = (href) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const INSTALL_CMD = UPDATER_CONFIG.installCmdLatest;

  const handleUpdate = () => {
    setShowUpdateModal(false);
    setIsUpdating(true);
  };

  const handleCopyAndShutdown = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_CMD);
    } catch {}
    copy(INSTALL_CMD);
    let remaining = UPDATER_CONFIG.shutdownCountdownSec;
    setShutdownCountdown(remaining);
    const timer = setInterval(() => {
      remaining -= 1;
      setShutdownCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        fetch("/api/version/shutdown", { method: "POST" }).catch(() => {});
        setIsDisconnected(true);
      }
    }, 1000);
  };

  const handleCancelUpdate = () => {
    setIsUpdating(false);
    setShutdownCountdown(0);
  };

  return (
    <>
      <aside
        className={cn(
          "flex h-full min-h-full border-r border-border/80 bg-[#161616] dark:bg-[#121212] select-none text-text-main transition-all duration-300 ease-in-out relative z-30",
          isCollapsed ? "w-[70px]" : "w-auto"
        )}
      >
        {/* ========================================================================= */}
        {/* 1️⃣ COLUNA ESQUERDA: RAIL DE MÓDULOS (ESTILO OLIST / OU MODO ÍCONES)       */}
        {/* ========================================================================= */}
        <div
          className={cn(
            "flex flex-col shrink-0 py-4 bg-[#161616] dark:bg-[#121212] justify-between transition-all duration-300",
            isCollapsed
              ? "w-[70px] px-2 items-center"
              : "w-48 sm:w-52 pl-3.5 pr-2 border-r border-border/40"
          )}
        >
          <div className="w-full">
            {/* Top Logo + Toggle Minimize/Expand Button */}
            {!isCollapsed ? (
              <div className="flex items-center justify-between gap-2 px-1 mb-5">
                <Link href="/dashboard" className="flex items-center gap-2 group min-w-0">
                  <div className="flex items-center justify-center size-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-md shadow-brand-500/25 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[18px]">hub</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-display font-extrabold tracking-tight text-white truncate">
                      {APP_CONFIG.name}
                    </span>
                    <span className="text-[10px] text-text-muted font-medium">v{APP_CONFIG.version}</span>
                  </div>
                </Link>

                {/* Botão Minimizar Completo (Recolhe para Apenas Ícones) */}
                <button
                  type="button"
                  onClick={toggleCollapse}
                  className="flex items-center justify-center size-8 rounded-full border border-border/60 bg-surface text-text-muted hover:text-brand-500 hover:border-brand-500/40 hover:bg-surface-2 transition-all shadow-sm"
                  title="Minimizar menu lateral (somente ícones)"
                >
                  <span className="material-symbols-outlined text-[18px]">left_panel_close</span>
                </button>
              </div>
            ) : (
              /* Top no Modo Minimizado (Apenas Ícone com Botão de Expandir) */
              <div className="flex flex-col items-center mb-5 gap-2">
                <button
                  type="button"
                  onClick={toggleCollapse}
                  className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-md shadow-brand-500/20 hover:scale-105 transition-all group"
                  title="Expandir menu lateral"
                >
                  <span className="material-symbols-outlined text-[20px] group-hover:rotate-180 transition-transform duration-300">
                    right_panel_open
                  </span>
                </button>
              </div>
            )}

            {/* Lista de Módulos (Modo Completo vs Modo Ícones) */}
            <nav className={cn("space-y-1 w-full", isCollapsed && "flex flex-col items-center")}>
              {MODULES.map((mod) => {
                const isSelected = selectedModuleId === mod.id;

                if (isCollapsed) {
                  // Renderização no Modo Minimizado (Ícone Centrado + Flyout Popover no Hover)
                  return (
                    <div
                      key={mod.id}
                      className="relative my-0.5"
                      onMouseEnter={() => setActiveFlyout(mod.id)}
                      onMouseLeave={() => setActiveFlyout(null)}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedModuleId(mod.id);
                          toggleCollapse();
                        }}
                        className={cn(
                          "flex items-center justify-center size-11 rounded-xl transition-all relative group",
                          isSelected
                            ? "bg-brand-500/15 text-brand-500 font-bold shadow-sm"
                            : "text-text-muted hover:text-text-main hover:bg-surface-2"
                        )}
                        title={mod.label}
                      >
                        {isSelected && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-500 rounded-r" />
                        )}
                        <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">
                          {mod.icon}
                        </span>
                      </button>

                      {/* Popover Flutuante no Hover do Modo Minimizado */}
                      {activeFlyout === mod.id && (
                        <div className="absolute left-[62px] top-0 z-50 w-52 p-2 bg-surface border border-border/80 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                          <div className="px-2.5 py-1.5 mb-1 border-b border-border/60 flex items-center justify-between">
                            <span className="text-xs font-bold text-brand-500 uppercase tracking-wider">
                              {mod.label}
                            </span>
                            {mod.badge && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-brand-500/10 text-brand-500 font-semibold">
                                {mod.badge}
                              </span>
                            )}
                          </div>
                          <div className="space-y-0.5">
                            {mod.items.map((subItem) => {
                              const subActive = isItemActive(subItem.href);
                              return (
                                <Link
                                  key={subItem.href}
                                  href={subItem.href}
                                  onClick={() => {
                                    setActiveFlyout(null);
                                    if (onClose) onClose();
                                  }}
                                  className={cn(
                                    "flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-all",
                                    subActive
                                      ? "bg-brand-500/15 text-brand-500 font-bold"
                                      : "text-text-muted hover:text-text-main hover:bg-surface-2"
                                  )}
                                >
                                  <span className="material-symbols-outlined text-[16px]">
                                    {subItem.icon}
                                  </span>
                                  <span className="truncate">{subItem.label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                // Renderização no Modo Expandido (Estilo Abas Arredondadas Olist)
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => {
                      setSelectedModuleId(mod.id);
                      if (mod.id === "lucas" && isSelected) {
                        router.push("/chat");
                        if (onClose) onClose();
                      }
                    }}
                    className={cn(
                      "group w-full flex items-center justify-between px-3.5 py-2.5 rounded-l-2xl rounded-r-lg text-sm font-semibold transition-all duration-150 relative",
                      isSelected
                        ? "bg-surface text-brand-500 font-bold shadow-md shadow-black/10 z-10 translate-x-1"
                        : "text-text-muted hover:text-text-main hover:bg-surface-2/60"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={cn(
                          "material-symbols-outlined text-[18px] transition-transform group-hover:scale-110",
                          isSelected ? "text-brand-500" : "text-text-muted/70 group-hover:text-brand-500"
                        )}
                      >
                        {mod.icon}
                      </span>
                      <span className="capitalize truncate text-[13px]">{mod.label}</span>
                    </div>

                    {/* Indicador de Ponto Ativo (Estilo Olist) */}
                    {isSelected && (
                      <span className="size-1.5 rounded-full bg-brand-500 shrink-0" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Rodapé da Coluna Esquerda */}
          <div className={cn("pt-4 border-t border-border/40 w-full space-y-3", isCollapsed && "items-center flex flex-col")}>
            {!isCollapsed ? (
              <>
                <div className="space-y-0.5 px-1 text-xs">
                  <Link
                    href="/dashboard/profile"
                    onClick={onClose}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[15px]">settings</span>
                    <span className="text-[12px]">configurações</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setShowRemoteModal(true)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-[15px]">computer</span>
                    <span className="text-[12px]">acesso remoto</span>
                  </button>

                  <Link
                    href="/dashboard/skills"
                    onClick={onClose}
                    className="flex items-center justify-between px-2 py-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[15px] text-brand-500">auto_awesome</span>
                      <span className="text-[12px]">agentes de IA</span>
                    </div>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-brand-500/10 text-brand-500 font-semibold">
                      em breve
                    </span>
                  </Link>
                </div>

                <div className="flex items-center justify-between px-2 pt-2 border-t border-border/40">
                  <div className="flex items-center gap-1.5">
                    <ThemeToggle />
                    {updateInfo && (
                      <button
                        type="button"
                        onClick={() => setShowUpdateModal(true)}
                        className="flex items-center justify-center size-7 rounded-full bg-brand-500/15 text-brand-500 hover:scale-105 transition-all"
                        title={`Atualização: v${updateInfo.latestVersion}`}
                      >
                        <span className="material-symbols-outlined text-[14px]">system_update</span>
                      </button>
                    )}
                  </div>

                  <Link
                    href="/dashboard/profile"
                    className="flex items-center justify-center size-7 rounded-full bg-brand-500/20 text-brand-500 font-bold text-xs border border-brand-500/30 hover:scale-105 transition-all"
                    title="Perfil do Usuário"
                  >
                    L
                  </Link>
                </div>
              </>
            ) : (
              /* Rodapé Modo Minimizado */
              <div className="flex flex-col items-center gap-2">
                <Link
                  href="/dashboard/profile"
                  className="flex items-center justify-center size-9 rounded-xl text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors"
                  title="Configurações"
                >
                  <span className="material-symbols-outlined text-[18px]">settings</span>
                </Link>
                <ThemeToggle />
                <Link
                  href="/dashboard/profile"
                  className="flex items-center justify-center size-8 rounded-full bg-brand-500/20 text-brand-500 font-bold text-xs border border-brand-500/30 hover:scale-105 transition-all mt-1"
                  title="Perfil"
                >
                  L
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2️⃣ COLUNA DIREITA: DRAWER DE SUBMENUS (ESTILO OLIST)                       */}
        {/* ========================================================================= */}
        {!isCollapsed && (
          <div className="flex flex-col w-56 sm:w-60 bg-surface dark:bg-[#1a1a1a] py-4 px-3.5 border-r border-border/60 transition-all duration-200 animate-in fade-in slide-in-from-left-2 overflow-y-auto custom-scrollbar">
            {/* Header do Submenu com Título da Categoria */}
            <div className="px-2 pb-3 mb-2 border-b border-border/50">
              <h2 className="text-sm font-display font-bold text-text-main capitalize tracking-tight">
                {currentModule.label}
              </h2>
              <span className="text-[11px] text-text-muted">
                {currentModule.items.length} opções disponíveis
              </span>
            </div>

            {/* Lista de Submenus com Ícones Finos e Links */}
            <div className="space-y-1">
              {currentModule.items.map((item) => {
                const active = isItemActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "group flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150",
                      active
                        ? "bg-brand-500/15 text-brand-500 font-bold shadow-soft"
                        : "text-text-muted hover:text-text-main hover:bg-surface-2/80"
                    )}
                  >
                    <span
                      className={cn(
                        "material-symbols-outlined text-[17px] transition-transform group-hover:scale-110",
                        active ? "text-brand-500" : "text-text-muted/60 group-hover:text-brand-500"
                      )}
                    >
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}

              {/* Seção Específica de Media Providers dentro de Sistema */}
              {currentModule.id === "system" && (
                <div className="pt-2 mt-2 border-t border-border/50">
                  <button
                    type="button"
                    onClick={() => setMediaOpen((v) => !v)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                      pathname.startsWith("/dashboard/media-providers")
                        ? "text-brand-500 bg-brand-500/10"
                        : "text-text-muted hover:text-text-main hover:bg-surface-2"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">perm_media</span>
                      <span>Media Providers</span>
                    </div>
                    <span
                      className="material-symbols-outlined text-[14px] transition-transform"
                      style={{ transform: mediaOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                    >
                      expand_more
                    </span>
                  </button>

                  {mediaOpen && (
                    <div className="pl-4 pr-1 py-1 space-y-0.5 border-l-2 border-border/60 ml-3 mt-1">
                      {MEDIA_PROVIDER_KINDS.filter((k) => VISIBLE_MEDIA_KINDS.includes(k.id)).map(
                        (kind) => (
                          <Link
                            key={kind.id}
                            href={`/dashboard/media-providers/${kind.id}`}
                            onClick={onClose}
                            className={cn(
                              "flex items-center gap-2 px-2 py-1 rounded-md text-[11.5px] transition-all",
                              pathname.startsWith(`/dashboard/media-providers/${kind.id}`)
                                ? "text-brand-500 font-bold bg-brand-500/10"
                                : "text-text-muted hover:text-text-main hover:bg-surface-2"
                            )}
                          >
                            <span className="material-symbols-outlined text-[14px]">{kind.icon}</span>
                            <span>{kind.label}</span>
                          </Link>
                        )
                      )}
                      <Link
                        key={COMBINED_WEB_ITEM.id}
                        href={COMBINED_WEB_ITEM.href}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1 rounded-md text-[11.5px] transition-all",
                          pathname.startsWith(COMBINED_WEB_ITEM.href)
                            ? "text-brand-500 font-bold bg-brand-500/10"
                            : "text-text-muted hover:text-text-main hover:bg-surface-2"
                        )}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {COMBINED_WEB_ITEM.icon}
                        </span>
                        <span>{COMBINED_WEB_ITEM.label}</span>
                      </Link>
                    </div>
                  )}

                  {enableTranslator && (
                    <Link
                      href="/dashboard/translator"
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all mt-1",
                        isItemActive("/dashboard/translator")
                          ? "text-brand-500 font-bold bg-brand-500/10"
                          : "text-text-muted hover:text-text-main hover:bg-surface-2"
                      )}
                    >
                      <span className="material-symbols-outlined text-[16px]">translate</span>
                      <span>Translator</span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </aside>

      <NineRemotePromoModal isOpen={showRemoteModal} onClose={() => setShowRemoteModal(false)} />
      <ConfirmModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onConfirm={handleUpdate}
        title="Update MaxRouter"
        message={`Show install command for v${updateInfo?.latestVersion || ""}?`}
        confirmText="Show Command"
        cancelText="Cancel"
        variant="primary"
      />

      {(isDisconnected || isUpdating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          {isUpdating ? (
            <ManualUpdatePanel
              latestVersion={updateInfo?.latestVersion}
              installCmd={INSTALL_CMD}
              copied={copied}
              onCopyAndShutdown={handleCopyAndShutdown}
              onCancel={handleCancelUpdate}
              countdown={shutdownCountdown}
              isDisconnected={isDisconnected}
            />
          ) : (
            <div className="text-center p-8">
              <div className="flex items-center justify-center size-16 rounded-full bg-red-500/20 text-red-500 mx-auto mb-4">
                <span className="material-symbols-outlined text-[32px]">power_off</span>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Server Disconnected</h2>
              <p className="text-text-muted mb-6">The proxy server has been stopped.</p>
              <Button variant="secondary" onClick={() => globalThis.location.reload()}>
                Reload Page
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

Sidebar.propTypes = {
  onClose: PropTypes.func,
};

function ManualUpdatePanel({
  latestVersion,
  installCmd,
  copied,
  onCopyAndShutdown,
  onCancel,
  countdown,
  isDisconnected,
}) {
  const isCountingDown = countdown > 0;
  return (
    <div className="w-full max-w-lg rounded-xl bg-[#1F1C18] border border-white/10 p-6 text-white shadow-elev">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center size-11 rounded-md bg-brand-500/15 text-brand-400">
          <span className="material-symbols-outlined text-[24px]">content_copy</span>
        </div>
        <div>
          <h2 className="text-lg font-display font-semibold">
            Update MaxRouter{latestVersion ? ` to v${latestVersion}` : ""}
          </h2>
          <p className="text-xs text-white/50">
            {isDisconnected
              ? "Server stopped. Paste the command into a terminal to install."
              : isCountingDown
              ? `Command copied. Server will stop in ${countdown}s…`
              : "Click the button below to copy the install command and shutdown."}
          </p>
        </div>
      </div>
      <p className="text-sm text-white/80 mb-2">Install command:</p>
      <div className="w-full px-3 py-2 rounded bg-white/5 mb-4">
        <code className="text-xs font-mono text-brand-300 break-all">{installCmd}</code>
      </div>
      <ol className="text-xs text-white/60 space-y-1 list-decimal list-inside mb-4">
        <li>
          Click <strong>Copy & Shutdown</strong> below.
        </li>
        <li>Paste the command into your terminal and press Enter.</li>
        <li>
          Run <code className="px-1 rounded bg-white/10 text-brand-400">9router</code> again after install.
        </li>
      </ol>
      {isDisconnected ? (
        <Button variant="secondary" fullWidth onClick={() => globalThis.location.reload()}>
          Reload Page
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={isCountingDown}>
            Cancel
          </Button>
          <Button
            variant="primary"
            fullWidth
            onClick={onCopyAndShutdown}
            disabled={isCountingDown}
          >
            {copied
              ? "✓ Copied — shutting down…"
              : isCountingDown
              ? `Shutting down in ${countdown}s`
              : "Copy & Shutdown"}
          </Button>
        </div>
      )}
    </div>
  );
}

ManualUpdatePanel.propTypes = {
  latestVersion: PropTypes.string,
  installCmd: PropTypes.string.isRequired,
  copied: PropTypes.bool,
  onCopyAndShutdown: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  countdown: PropTypes.number,
  isDisconnected: PropTypes.bool,
};
