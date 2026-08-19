"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

// 🏛️ Grupos de Navegação Modernos (Estilo Linear / Supabase)
const NAV_SECTIONS = [
  {
    id: "lucas",
    title: "Lucas",
    icon: "smart_toy",
    isPrimary: true,
    items: [
      { href: "/chat", label: "Chat do Lucas", icon: "forum", badge: "Live" },
      { href: "/coder", label: "Coder do Lucas", icon: "code", badge: "IDE" },
      { href: "/dashboard", label: "Painel de Controle", icon: "dashboard_customize" },
      { href: "/dashboard/painel", label: "Hábitos & Metas", icon: "psychology" },
    ],
  },
  {
    id: "routing",
    title: "Roteamento",
    icon: "alt_route",
    items: [
      { href: "/dashboard/endpoint", label: "Endpoint API", icon: "api" },
      { href: "/dashboard/providers", label: "Provedores", icon: "dns" },
      { href: "/dashboard/combos", label: "Combinações", icon: "layers" },
      { href: "/dashboard/proxy-pools", label: "Proxy Pools", icon: "lan" },
    ],
  },
  {
    id: "metrics",
    title: "Métricas",
    icon: "monitoring",
    items: [
      { href: "/dashboard/telemetry", label: "Telemetria", icon: "query_stats" },
      { href: "/dashboard/usage", label: "Consumo & Tokens", icon: "bar_chart" },
      { href: "/dashboard/analytics", label: "Analytics", icon: "insights" },
      { href: "/dashboard/scanner", label: "Scanner de Modelos", icon: "search" },
    ],
  },
  {
    id: "tools",
    title: "Ferramentas",
    icon: "science",
    items: [
      { href: "/dashboard/playground", label: "Playground A/B", icon: "compare" },
      { href: "/dashboard/rag", label: "RAG Documentos", icon: "folder_data" },
      { href: "/dashboard/skills", label: "Skills de IA", icon: "extension" },
      { href: "/dashboard/token-saver", label: "Token Saver", icon: "savings" },
      { href: "/dashboard/cli-tools", label: "Ferramentas CLI", icon: "terminal" },
    ],
  },
  {
    id: "business",
    title: "Negócios",
    icon: "business_center",
    items: [
      { href: "/dashboard/billing", label: "Planos & Faturas", icon: "payments" },
      { href: "/dashboard/crm", label: "CRM de Clientes", icon: "people" },
      { href: "/dashboard/crm/billing", label: "Checkout & Faturamento", icon: "credit_card" },
      { href: "/dashboard/crm/analytics", label: "Analytics CRM", icon: "insights" },
      { href: "/dashboard/crm/automations", label: "Automações CRM", icon: "bolt" },
    ],
  },
  {
    id: "system",
    title: "Sistema",
    icon: "tune",
    items: [
      { href: "/dashboard/quota", label: "Quotas de Uso", icon: "data_usage" },
      { href: "/dashboard/notion-config", label: "Notion Sync", icon: "book" },
      { href: "/dashboard/console-log", label: "Console Log", icon: "terminal" },
      { href: "/dashboard/profile", label: "Configurações", icon: "settings" },
    ],
  },
];

export default function Sidebar({ onClose }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [collapsedFlyout, setCollapsedFlyout] = useState(null);
  const [openSections, setOpenSections] = useState({
    lucas: true,
    routing: true,
    metrics: true,
    tools: false,
    business: false,
    system: false,
  });

  const [mediaOpen, setMediaOpen] = useState(false);
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
      const saved = localStorage.getItem("9router_sidebar_collapsed_v2");
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      }
    } catch {}
  }, []);

  // Auto-expande a seção correta baseada na rota ativa
  useEffect(() => {
    for (const sec of NAV_SECTIONS) {
      if (
        sec.items.some((it) => {
          if (it.href === "/dashboard") return pathname === "/dashboard";
          return pathname.startsWith(it.href);
        })
      ) {
        setOpenSections((prev) => ({ ...prev, [sec.id]: true }));
        break;
      }
    }
    if (pathname.startsWith("/dashboard/media-providers")) {
      setOpenSections((prev) => ({ ...prev, system: true }));
      setMediaOpen(true);
    }
  }, [pathname]);

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
      localStorage.setItem("9router_sidebar_collapsed_v2", String(next));
    } catch {}
  };

  const toggleSection = (id) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
          "flex flex-col h-full min-h-full border-r border-border bg-sidebar select-none text-text-main transition-all duration-300 ease-in-out relative z-30",
          isCollapsed ? "w-[68px]" : "w-64"
        )}
      >
        {/* Header da Sidebar */}
        <div
          className={cn(
            "flex items-center shrink-0 h-14 border-b border-border px-3.5 transition-all",
            isCollapsed ? "justify-center" : "justify-between"
          )}
        >
          {!isCollapsed ? (
            <>
              <Link href="/dashboard" className="flex items-center gap-2.5 group min-w-0">
                <div className="flex items-center justify-center size-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-md shadow-brand-500/25 group-hover:scale-105 transition-transform shrink-0">
                  <span className="material-symbols-outlined text-[18px]">hub</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-display font-extrabold tracking-tight text-white truncate">
                      {APP_CONFIG.name}
                    </span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-brand-500/15 text-brand-400 font-bold border border-brand-500/30">
                      v{APP_CONFIG.version}
                    </span>
                  </div>
                </div>
              </Link>

              <button
                type="button"
                onClick={toggleCollapse}
                className="flex items-center justify-center size-7 rounded-lg text-text-muted hover:text-brand-400 hover:bg-surface-2 transition-all"
                title="Recolher barra lateral (Shift + [)"
              >
                <span className="material-symbols-outlined text-[18px]">left_panel_close</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={toggleCollapse}
              className="flex items-center justify-center size-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-md shadow-brand-500/20 hover:scale-105 transition-all group"
              title="Expandir barra lateral"
            >
              <span className="material-symbols-outlined text-[19px] group-hover:rotate-180 transition-transform duration-300">
                right_panel_open
              </span>
            </button>
          )}
        </div>

        {/* Corpo de Navegação com Scroll customizado */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-3">
          {NAV_SECTIONS.map((sec) => {
            const isOpen = openSections[sec.id] !== false;
            const hasActiveChild = sec.items.some((it) => isItemActive(it.href));

            if (isCollapsed) {
              // Modo Slim (Ícones Centralizados + Popover no Hover)
              return (
                <div
                  key={sec.id}
                  className="relative flex justify-center"
                  onMouseEnter={() => setCollapsedFlyout(sec.id)}
                  onMouseLeave={() => setCollapsedFlyout(null)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      toggleCollapse();
                      setOpenSections((prev) => ({ ...prev, [sec.id]: true }));
                    }}
                    className={cn(
                      "flex items-center justify-center size-10 rounded-xl transition-all relative group",
                      hasActiveChild
                        ? "bg-brand-500/20 text-brand-400 font-bold shadow-sm shadow-brand-500/10 border border-brand-500/30"
                        : "text-text-muted hover:text-text-main hover:bg-surface-2"
                    )}
                    title={sec.title}
                  >
                    {hasActiveChild && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-brand-500 rounded-r shadow-glow" />
                    )}
                    <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">
                      {sec.icon}
                    </span>
                  </button>

                  {/* Popover Flutuante */}
                  {collapsedFlyout === sec.id && (
                    <div className="absolute left-[58px] top-0 z-50 w-52 p-2 bg-surface border border-border rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-2.5 py-1 mb-1 border-b border-border flex items-center justify-between">
                        <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">
                          {sec.title}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {sec.items.map((subItem) => {
                          const subActive = isItemActive(subItem.href);
                          return (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              onClick={() => {
                                setCollapsedFlyout(null);
                                if (onClose) onClose();
                              }}
                              className={cn(
                                "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all",
                                subActive
                                  ? "bg-brand-500/20 text-brand-400 font-bold border border-brand-500/30"
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

            // Modo Expandido (Cabeçalho de Categoria + Links Modernos)
            return (
              <div key={sec.id} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => toggleSection(sec.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors",
                    sec.isPrimary
                      ? "text-brand-400 hover:text-brand-300"
                      : "text-text-muted/80 hover:text-text-main"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">{sec.icon}</span>
                    <span>{sec.title}</span>
                  </div>
                  <span
                    className="material-symbols-outlined text-[14px] transition-transform duration-200"
                    style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                  >
                    expand_more
                  </span>
                </button>

                {isOpen && (
                  <div className="space-y-0.5 pl-1.5 border-l border-border/50 ml-2 mt-0.5">
                    {sec.items.map((item) => {
                      const active = isItemActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onClose}
                          className={cn(
                            "group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 relative",
                            active
                              ? "bg-brand-500/15 text-brand-400 font-bold border border-brand-500/30 shadow-soft"
                              : "text-text-muted hover:text-text-main hover:bg-surface-2"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={cn(
                                "material-symbols-outlined text-[16px] transition-transform group-hover:scale-110",
                                active ? "text-brand-400" : "text-text-muted/70 group-hover:text-text-main"
                              )}
                            >
                              {item.icon}
                            </span>
                            <span className="truncate">{item.label}</span>
                          </div>

                          {item.badge && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-brand-500/20 text-brand-400 font-bold border border-brand-500/30">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}

                    {/* Sub-itens específicos de Media Providers dentro de Sistema */}
                    {sec.id === "system" && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setMediaOpen((v) => !v)}
                          className={cn(
                            "w-full flex items-center justify-between px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                            pathname.startsWith("/dashboard/media-providers")
                              ? "text-brand-400 bg-brand-500/10"
                              : "text-text-muted hover:text-text-main hover:bg-surface-2"
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[14px]">perm_media</span>
                            <span>Media Providers</span>
                          </div>
                          <span
                            className="material-symbols-outlined text-[12px] transition-transform"
                            style={{ transform: mediaOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                          >
                            expand_more
                          </span>
                        </button>

                        {mediaOpen && (
                          <div className="pl-3 py-0.5 space-y-0.5 border-l border-border ml-2 mt-0.5">
                            {MEDIA_PROVIDER_KINDS.filter((k) => VISIBLE_MEDIA_KINDS.includes(k.id)).map(
                              (kind) => (
                                <Link
                                  key={kind.id}
                                  href={`/dashboard/media-providers/${kind.id}`}
                                  onClick={onClose}
                                  className={cn(
                                    "flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] transition-all",
                                    pathname.startsWith(`/dashboard/media-providers/${kind.id}`)
                                      ? "text-brand-400 font-bold bg-brand-500/10"
                                      : "text-text-muted hover:text-text-main hover:bg-surface-2"
                                  )}
                                >
                                  <span className="material-symbols-outlined text-[13px]">{kind.icon}</span>
                                  <span>{kind.label}</span>
                                </Link>
                              )
                            )}
                            <Link
                              key={COMBINED_WEB_ITEM.id}
                              href={COMBINED_WEB_ITEM.href}
                              onClick={onClose}
                              className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] transition-all",
                                pathname.startsWith(COMBINED_WEB_ITEM.href)
                                  ? "text-brand-400 font-bold bg-brand-500/10"
                                  : "text-text-muted hover:text-text-main hover:bg-surface-2"
                              )}
                            >
                              <span className="material-symbols-outlined text-[13px]">
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
                              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] transition-all mt-0.5",
                              isItemActive("/dashboard/translator")
                                ? "text-brand-400 font-bold bg-brand-500/10"
                                : "text-text-muted hover:text-text-main hover:bg-surface-2"
                            )}
                          >
                            <span className="material-symbols-outlined text-[14px]">translate</span>
                            <span>Translator</span>
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Rodapé da Sidebar */}
        <div className={cn("p-2 border-t border-border bg-sidebar/80 shrink-0", isCollapsed && "items-center flex flex-col")}>
          {!isCollapsed ? (
            <div className="flex items-center justify-between px-2 py-1">
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <button
                  type="button"
                  onClick={() => setShowRemoteModal(true)}
                  className="flex items-center justify-center size-8 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors"
                  title="Acesso Remoto"
                >
                  <span className="material-symbols-outlined text-[17px]">computer</span>
                </button>
                {updateInfo && (
                  <button
                    type="button"
                    onClick={() => setShowUpdateModal(true)}
                    className="flex items-center justify-center size-7 rounded-full bg-brand-500/20 text-brand-400 hover:scale-105 transition-all"
                    title={`Atualização: v${updateInfo.latestVersion}`}
                  >
                    <span className="material-symbols-outlined text-[14px]">system_update</span>
                  </button>
                )}
              </div>

              <Link
                href="/dashboard/profile"
                className="flex items-center justify-center size-7 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-white font-bold text-xs shadow-md shadow-brand-500/20 hover:scale-105 transition-all"
                title="Meu Perfil"
              >
                L
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <button
                type="button"
                onClick={() => setShowRemoteModal(true)}
                className="flex items-center justify-center size-8 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors"
                title="Acesso Remoto"
              >
                <span className="material-symbols-outlined text-[18px]">computer</span>
              </button>
              <ThemeToggle />
              <Link
                href="/dashboard/profile"
                className="flex items-center justify-center size-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-white font-bold text-xs shadow-md shadow-brand-500/20 hover:scale-105 transition-all mt-1"
                title="Meu Perfil"
              >
                L
              </Link>
            </div>
          )}
        </div>
      </aside>

      <NineRemotePromoModal isOpen={showRemoteModal} onClose={() => setShowRemoteModal(false)} />
      <ConfirmModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onConfirm={handleUpdate}
        title="Atualizar MaxRouter"
        message={`Exibir comando de atualização para v${updateInfo?.latestVersion || ""}?`}
        confirmText="Exibir Comando"
        cancelText="Cancelar"
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
              <h2 className="text-xl font-semibold text-white mb-2">Servidor Desconectado</h2>
              <p className="text-text-muted mb-6">O servidor proxy foi pausado.</p>
              <Button variant="secondary" onClick={() => globalThis.location.reload()}>
                Recarregar Página
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
    <div className="w-full max-w-lg rounded-xl bg-surface border border-border p-6 text-text-main shadow-elevated">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center size-11 rounded-xl bg-brand-500/15 text-brand-400">
          <span className="material-symbols-outlined text-[24px]">content_copy</span>
        </div>
        <div>
          <h2 className="text-lg font-display font-semibold">
            Atualizar MaxRouter{latestVersion ? ` para v${latestVersion}` : ""}
          </h2>
          <p className="text-xs text-text-muted">
            {isDisconnected
              ? "Servidor parado. Cole o comando no terminal para instalar."
              : isCountingDown
              ? `Comando copiado. O servidor parará em ${countdown}s…`
              : "Clique abaixo para copiar o comando e reiniciar."}
          </p>
        </div>
      </div>
      <div className="w-full px-3 py-2 rounded-lg bg-bg-alt mb-4 border border-border">
        <code className="text-xs font-mono text-brand-400 break-all">{installCmd}</code>
      </div>
      {isDisconnected ? (
        <Button variant="secondary" fullWidth onClick={() => globalThis.location.reload()}>
          Recarregar Página
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={isCountingDown}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            fullWidth
            onClick={onCopyAndShutdown}
            disabled={isCountingDown}
          >
            {copied
              ? "✓ Copiado — desligando…"
              : isCountingDown
              ? `Desligando em ${countdown}s`
              : "Copiar & Atualizar"}
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
