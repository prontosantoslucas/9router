"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/utils/cn";
import { APP_CONFIG, UPDATER_CONFIG } from "@/shared/constants/config";
import { MEDIA_PROVIDER_KINDS } from "@/shared/constants/providers";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import Button from "./Button";
import { ConfirmModal } from "./Modal";
import NineRemotePromoModal from "./NineRemotePromoModal";

const VISIBLE_MEDIA_KINDS = ["embedding", "image", "tts", "stt"];
const COMBINED_WEB_ITEM = { id: "web", label: "Web Fetch & Search", icon: "travel_explore", href: "/dashboard/media-providers/web" };

const navItems = [
  { href: "/dashboard/endpoint", label: "Endpoint", icon: "api" },
  { href: "/dashboard/providers", label: "Providers", icon: "dns" },
  { href: "/dashboard/combos", label: "Combos", icon: "layers" },
  { href: "/dashboard/scanner", label: "Scanner", icon: "search" },
  { href: "/dashboard/usage", label: "Usage", icon: "bar_chart" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "insights" },
  { href: "/dashboard/billing", label: "Billing", icon: "payments" },
  { href: "/dashboard/crm", label: "CRM", icon: "people" },
  { href: "/dashboard/cli-tools", label: "CLI Tools", icon: "terminal" },
];

const systemItems = [
  { href: "/dashboard/proxy-pools", label: "Proxy Pools", icon: "lan" },
  { href: "/dashboard/skills", label: "Skills", icon: "extension" },
  { href: "/dashboard/token-saver", label: "Token Saver", icon: "savings" },
  { href: "/dashboard/quota", label: "Quota", icon: "data_usage" },
];

export default function Sidebar({ onClose }) {
  const pathname = usePathname();
  const [mediaOpen, setMediaOpen] = useState(false);
  const [showRemoteModal, setShowRemoteModal] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [shutdownCountdown, setShutdownCountdown] = useState(0);
  const [enableTranslator, setEnableTranslator] = useState(false);
  const { copied, copy } = useCopyToClipboard(2000);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    fetch("/api/settings").then(res => res.json()).then(data => { if (data.enableTranslator) setEnableTranslator(true); }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/version").then(res => res.json()).then(data => { if (data.hasUpdate) setUpdateInfo(data); }).catch(() => {});
  }, []);

  const INSTALL_CMD = UPDATER_CONFIG.installCmdLatest;

  const isActive = (href) => {
    if (href === "/dashboard/endpoint") return pathname === "/dashboard" || pathname.startsWith("/dashboard/endpoint");
    return pathname.startsWith(href);
  };

  const handleUpdate = () => { setShowUpdateModal(false); setIsUpdating(true); };

  const handleCopyAndShutdown = async () => {
    try { await navigator.clipboard.writeText(INSTALL_CMD); } catch { }
    copy(INSTALL_CMD);
    let remaining = UPDATER_CONFIG.shutdownCountdownSec;
    setShutdownCountdown(remaining);
    const timer = setInterval(() => {
      remaining -= 1;
      setShutdownCountdown(remaining);
      if (remaining <= 0) { clearInterval(timer); fetch("/api/version/shutdown", { method: "POST" }).catch(() => {}); setIsDisconnected(true); }
    }, 1000);
  };

  const handleCancelUpdate = () => { setIsUpdating(false); setShutdownCountdown(0); };

  return (
    <>
      <aside className="flex w-60 flex-col border-r border-border bg-sidebar backdrop-blur-2xl min-h-full">
        {/* Logo */}
        <div className="px-4 py-5">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="flex items-center justify-center size-8 rounded-md bg-gradient-to-br from-amber-500 to-amber-700 shadow-[0_2px_8px_-2px_rgba(245,158,11,0.3)] group-hover:shadow-[0_2px_12px_-2px_rgba(245,158,11,0.5)] transition-shadow duration-300">
              <span className="material-symbols-outlined text-white text-[18px]">hub</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-sm font-display font-semibold tracking-tight text-text-main">{APP_CONFIG.name}</h1>
              <span className="text-[10px] text-text-muted font-medium tracking-wide uppercase">v{APP_CONFIG.version}</span>
            </div>
          </Link>
          {updateInfo && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              <span className="material-symbols-outlined text-amber-400 text-[14px]">system_update</span>
              <span className="text-[11px] text-amber-400/90 font-medium flex-1">v{updateInfo.latestVersion}</span>
              <button onClick={() => setShowUpdateModal(true)} className="text-[10px] font-semibold text-amber-500 hover:text-amber-400 transition-colors uppercase tracking-wider">Update</button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto custom-scrollbar">
          {navItems.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-all duration-150 group",
                isActive(item.href)
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium"
                  : "text-text-muted hover:bg-surface-2 hover:text-text-main"
              )}
              style={mounted ? { animationDelay: `${i * 0.03}s` } : {}}
            >
              <span className={cn(
                "material-symbols-outlined text-[18px] transition-all",
                isActive(item.href) ? "text-amber-500" : "text-text-muted/60 group-hover:text-amber-400 group-hover:scale-110"
              )}>
                {item.icon}
              </span>
              <span className="text-[13px]">{item.label}</span>
            </Link>
          ))}

          {/* System section */}
          <div className="pt-4 mt-3 space-y-0.5 border-t border-border">
            <p className="px-3 pb-1 text-[10px] font-semibold text-text-muted/50 uppercase tracking-[0.15em]">System</p>

            <button
              onClick={() => setMediaOpen((v) => !v)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-all group",
                pathname.startsWith("/dashboard/media-providers") ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "text-text-muted hover:bg-surface-2 hover:text-text-main"
              )}
            >
              <span className="material-symbols-outlined text-[18px] text-text-muted/60 group-hover:text-amber-400">perm_media</span>
              <span className="text-[13px] flex-1 text-left">Media</span>
              <span className="material-symbols-outlined text-[14px] transition-transform text-text-muted/40" style={{ transform: mediaOpen ? "rotate(180deg)" : "rotate(0deg)" }}>expand_more</span>
            </button>
            {mediaOpen && (
              <div className="pl-3 space-y-0.5">
                {MEDIA_PROVIDER_KINDS.filter((k) => VISIBLE_MEDIA_KINDS.includes(k.id)).map((kind) => (
                  <Link key={kind.id} href={`/dashboard/media-providers/${kind.id}`} onClick={onClose}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-1 rounded-md transition-all group text-sm",
                      pathname.startsWith(`/dashboard/media-providers/${kind.id}`) ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "text-text-muted hover:bg-surface-2 hover:text-text-main"
                    )}
                  >
                    <span className="material-symbols-outlined text-[16px]">{kind.icon}</span>
                    <span className="text-[12px]">{kind.label}</span>
                  </Link>
                ))}
                <Link key={COMBINED_WEB_ITEM.id} href={COMBINED_WEB_ITEM.href} onClick={onClose}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-1 rounded-md transition-all group text-sm",
                    pathname.startsWith(COMBINED_WEB_ITEM.href) ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "text-text-muted hover:bg-surface-2 hover:text-text-main"
                  )}
                >
                  <span className="material-symbols-outlined text-[16px]">{COMBINED_WEB_ITEM.icon}</span>
                  <span className="text-[12px]">{COMBINED_WEB_ITEM.label}</span>
                </Link>
              </div>
            )}

            {systemItems.map((item) => (
              <Link key={item.href} href={item.href} onClick={onClose}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-all group",
                  isActive(item.href) ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "text-text-muted hover:bg-surface-2 hover:text-text-main"
                )}
              >
                <span className={cn("material-symbols-outlined text-[18px]", isActive(item.href) ? "text-amber-500" : "text-text-muted/60 group-hover:text-amber-400")}>{item.icon}</span>
                <span className="text-[13px]">{item.label}</span>
              </Link>
            ))}

            {debugItems.map((item) => {
              const show = item.href !== "/dashboard/translator" || enableTranslator;
              return show ? (
                <Link key={item.href} href={item.href} onClick={onClose}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-all group",
                    isActive(item.href) ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "text-text-muted hover:bg-surface-2 hover:text-text-main"
                  )}
                >
                  <span className={cn("material-symbols-outlined text-[18px]", isActive(item.href) ? "text-amber-500" : "text-text-muted/60 group-hover:text-amber-400")}>{item.icon}</span>
                  <span className="text-[13px]">{item.label}</span>
                </Link>
              ) : null;
            })}

            <button onClick={() => setShowRemoteModal(true)}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-all group text-text-muted hover:bg-surface-2 hover:text-text-main"
            >
              <span className="material-symbols-outlined text-[18px] text-text-muted/60 group-hover:text-amber-400">computer</span>
              <span className="text-[13px]">Remote</span>
            </button>

            <Link href="/dashboard/profile" onClick={onClose}
              className={cn(
                "flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-all group",
                isActive("/dashboard/profile") ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "text-text-muted hover:bg-surface-2 hover:text-text-main"
              )}
            >
              <span className={cn("material-symbols-outlined text-[18px]", isActive("/dashboard/profile") ? "text-amber-500" : "text-text-muted/60 group-hover:text-amber-400")}>settings</span>
              <span className="text-[13px]">Settings</span>
            </Link>
          </div>
        </nav>
      </aside>

      <NineRemotePromoModal isOpen={showRemoteModal} onClose={() => setShowRemoteModal(false)} />
      <ConfirmModal isOpen={showUpdateModal} onClose={() => setShowUpdateModal(false)} onConfirm={handleUpdate}
        title="Update MaxRouter"
        message={`Show install command for v${updateInfo?.latestVersion || ""}?`}
        confirmText="Show Command" cancelText="Cancel" variant="primary"
      />

      {(isDisconnected || isUpdating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          {isUpdating ? (
            <ManualUpdatePanel latestVersion={updateInfo?.latestVersion} installCmd={INSTALL_CMD} copied={copied}
              onCopyAndShutdown={handleCopyAndShutdown} onCancel={handleCancelUpdate}
              countdown={shutdownCountdown} isDisconnected={isDisconnected}
            />
          ) : (
            <div className="text-center p-8">
              <div className="flex items-center justify-center size-16 rounded-full bg-red-500/20 text-red-500 mx-auto mb-4">
                <span className="material-symbols-outlined text-[32px]">power_off</span>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Server Disconnected</h2>
              <p className="text-text-muted mb-6">The proxy server has been stopped.</p>
              <Button variant="secondary" onClick={() => globalThis.location.reload()}>Reload Page</Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

Sidebar.propTypes = { onClose: PropTypes.func, };

function ManualUpdatePanel({ latestVersion, installCmd, copied, onCopyAndShutdown, onCancel, countdown, isDisconnected }) {
  const isCountingDown = countdown > 0;
  return (
    <div className="w-full max-w-lg rounded-xl bg-[#1F1C18] border border-white/10 p-6 text-white shadow-elev">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center size-11 rounded-md bg-amber-500/15 text-amber-400">
          <span className="material-symbols-outlined text-[24px]">content_copy</span>
        </div>
        <div>
          <h2 className="text-lg font-display font-semibold">Update MaxRouter{latestVersion ? ` to v${latestVersion}` : ""}</h2>
          <p className="text-xs text-white/50">{isDisconnected ? "Server stopped. Paste the command into a terminal to install." : isCountingDown ? `Command copied. Server will stop in ${countdown}s…` : "Click the button below to copy the install command and shutdown."}</p>
        </div>
      </div>
      <p className="text-sm text-white/80 mb-2">Install command:</p>
      <div className="w-full px-3 py-2 rounded bg-white/5 mb-4">
        <code className="text-xs font-mono text-amber-300 break-all">{installCmd}</code>
      </div>
      <ol className="text-xs text-white/60 space-y-1 list-decimal list-inside mb-4">
        <li>Click <strong>Copy & Shutdown</strong> below.</li>
        <li>Paste the command into your terminal and press Enter.</li>
        <li>Run <code className="px-1 rounded bg-white/10 text-amber-400">9router</code> again after install.</li>
      </ol>
      {isDisconnected ? (
        <Button variant="secondary" fullWidth onClick={() => globalThis.location.reload()}>Reload Page</Button>
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={isCountingDown}>Cancel</Button>
          <Button variant="primary" fullWidth onClick={onCopyAndShutdown} disabled={isCountingDown}>
            {copied ? "✓ Copied — shutting down…" : isCountingDown ? `Shutting down in ${countdown}s` : "Copy & Shutdown"}
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

const debugItems = [
  { href: "/dashboard/console-log", label: "Console Log", icon: "terminal" },
  { href: "/dashboard/translator", label: "Translator", icon: "translate" },
];
