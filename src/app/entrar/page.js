"use client";

import { useState, useEffect, useRef } from "react";
import { Button, Input } from "@/shared/components";

const features = [
  { icon: "hub", label: "Multi-provider gateway" },
  { icon: "bar_chart", label: "Usage analytics" },
  { icon: "key", label: "Key management" },
  { icon: "currency_exchange", label: "Billing automation" },
];

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetHint, setResetHint] = useState("");
  const [retryAfter, setRetryAfter] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasPassword, setHasPassword] = useState(null);
  const [authMode, setAuthMode] = useState("password");
  const [oidcConfigured, setOidcConfigured] = useState(false);
  const [oidcLoginLabel, setOidcLoginLabel] = useState("Sign in with OIDC");
  const [mustChange, setMustChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const id = setInterval(() => setRetryAfter((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [retryAfter]);

  useEffect(() => {
    async function checkAuth() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      try {
        const res = await fetch(`${baseUrl}/api/auth/status`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data.requireLogin === false) { window.location.assign("/dashboard"); return; }
          setHasPassword(!!data.hasPassword);
          setAuthMode(data.authMode || "password");
          setOidcConfigured(data.oidcConfigured === true);
          setOidcLoginLabel(data.oidcLoginLabel || "Sign in with OIDC");
        } else { setHasPassword(true); }
      } catch { clearTimeout(timeoutId); setHasPassword(true); }
    }
    checkAuth();
  }, []);

  useEffect(() => {
    if (mounted && inputRef.current) inputRef.current.focus();
  }, [mounted, mustChange]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResetHint("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.mustChangePassword) { setMustChange(true); return; }
        window.location.assign("/chat");
      } else {
        const data = await res.json();
        setError(data.error || "Invalid password");
        if (data.resetHint) setResetHint(data.resetHint);
        if (data.retryAfter) setRetryAfter(Number(data.retryAfter));
      }
    } catch { setError("An error occurred. Please try again."); }
    finally { setLoading(false); }
  };

  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: password, newPassword }),
      });
      if (res.ok) { window.location.assign("/chat"); }
      else { const data = await res.json(); setError(data.error || "Failed to set password"); }
    } catch { setError("An error occurred."); }
    finally { setLoading(false); }
  };

  const handleOidcLogin = () => { window.location.href = "/api/auth/oidc/start"; };

  const oidcAvailable = oidcConfigured && ["oidc", "both"].includes(authMode);
  const passwordAvailable = authMode !== "oidc" || !oidcConfigured;

  if (hasPassword === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="text-center animate-fade-up">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          <p className="text-text-muted mt-4 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-bg">
      {/* Left panel — brand statement */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#0F0D0A] items-center justify-center p-12">
        <div className="landing-grid absolute inset-0 pointer-events-none" aria-hidden="true" />
        <div className="relative z-10 max-w-xl text-center">
          <div className={`inline-flex items-center justify-center size-16 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-8 ${mounted ? "animate-scale-in" : "opacity-0"}`}>
            <span className="material-symbols-outlined text-amber-400 text-[32px]">hub</span>
          </div>
          <h1 className={`text-5xl font-display font-bold tracking-tight text-white mb-4 ${mounted ? "animate-fade-up" : "opacity-0"}`} style={mounted ? { animationDelay: "0.1s" } : {}}>
            MaxRouter
          </h1>
          <p className={`text-lg text-amber-200/70 font-light leading-relaxed mb-10 ${mounted ? "animate-fade-up" : "opacity-0"}`} style={mounted ? { animationDelay: "0.2s" } : {}}>
            One endpoint for all your AI providers.<br />Manage keys, monitor usage, scale effortlessly.
          </p>
          <div className={`grid grid-cols-2 gap-3 max-w-sm mx-auto ${mounted ? "animate-fade-up" : "opacity-0"}`} style={mounted ? { animationDelay: "0.3s" } : {}}>
            {features.map((f) => (
              <div key={f.label} className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left">
                <span className="material-symbols-outlined text-amber-400/70 text-[18px]">{f.icon}</span>
                <span className="text-sm text-white/70">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
        <div className="dot-grid-bg absolute inset-0 pointer-events-none" aria-hidden="true" />
        <div className={`relative z-10 w-full max-w-sm ${mounted ? "animate-fade-up" : "opacity-0"}`} style={mounted ? { animationDelay: "0.15s" } : {}}>
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center justify-center size-12 rounded-lg bg-primary/10 border border-primary/20 mb-4">
              <span className="material-symbols-outlined text-primary text-[24px]">hub</span>
            </div>
            <h1 className="text-2xl font-display font-bold text-text-main">MaxRouter</h1>
          </div>

          <div className="rounded-xl border border-border bg-surface p-8 shadow-elev">
            {mustChange ? (
              <form onSubmit={handleSetNewPassword} className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-display font-semibold text-text-main">Set new password</h2>
                  <p className="text-sm text-text-muted mt-1">Required before accessing remotely.</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-text-muted">New password</label>
                  <Input ref={inputRef} type="password" placeholder="Enter new password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                  {error && <p className="text-xs text-danger mt-1">{error}</p>}
                </div>
                <Button type="submit" variant="primary" className="w-full" loading={loading} disabled={!newPassword}>
                  Set password
                </Button>
              </form>
            ) : (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-display font-semibold text-text-main">Sign in</h2>
                  <p className="text-sm text-text-muted mt-1">Enter your password to continue.</p>
                </div>

                {oidcAvailable && (
                  <Button type="button" variant="primary" className="w-full" onClick={handleOidcLogin}>
                    {oidcLoginLabel}
                  </Button>
                )}
                {oidcAvailable && passwordAvailable && <div className="h-px bg-border" />}

                {passwordAvailable && (
                  <form onSubmit={handleLogin} className="flex flex-col gap-4">
                    {(authMode === "oidc" && !oidcConfigured) || (authMode === "both" && !oidcConfigured) ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400 text-center">OIDC not configured yet. Password login available.</p>
                    ) : null}
                    {authMode === "both" && oidcConfigured ? (
                      <p className="text-xs text-text-muted text-center">Password and OIDC login enabled.</p>
                    ) : null}

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-text-muted">Password</label>
                      <Input ref={inputRef} type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus={!oidcAvailable} />
                      {error && <p className="text-xs text-danger mt-1">{error}</p>}
                      {retryAfter > 0 && <p className="text-xs text-warning mt-1">Locked. Retry in <span className="font-mono">{retryAfter}s</span>.</p>}
                      {resetHint && <p className="text-xs text-text-muted mt-1">Forgot password? Open <code className="bg-sidebar px-1 rounded">9router</code> CLI → Settings → Reset Password.</p>}
                    </div>

                    <Button type="submit" variant="primary" className="w-full" loading={loading} disabled={retryAfter > 0}>
                      {retryAfter > 0 ? `Wait ${retryAfter}s` : "Sign in"}
                    </Button>

                    <p className="text-xs text-center text-text-muted">Default: <code className="bg-surface-2 px-1.5 rounded text-[11px]">123456</code></p>
                    {hasPassword === false && <p className="text-xs text-center text-warning">No password set. You will be asked to set one when logging in remotely.</p>}
                  </form>
                )}
                {!passwordAvailable && error && <p className="text-xs text-danger">{error}</p>}
              </div>
            )}
          </div>

          <p className="text-center text-xs text-text-muted mt-6">v{typeof window !== "undefined" ? "1.0.0" : ""}</p>
        </div>
      </div>
    </div>
  );
}
