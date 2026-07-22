"use client";

import { useEffect, useState, useCallback, createContext, useContext } from "react";

// ─────────────────────────────────────────────────────────────
// Toast primitivo do DS — substitui `alert()` do navegador.
// Uso:
//   const { showToast } = useToast();
//   showToast({ kind: "success", text: "Salvo." });
//   showToast({ kind: "error", text: "Falhou." });
//
// Provider é montado uma vez no layout (dashboard + chat).
// Zero deps externas. Portal simples via container fixed.
// ─────────────────────────────────────────────────────────────

const ToastContext = createContext(null);

const DEFAULT_TTL_MS = 3500;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const showToast = useCallback(
    ({ kind = "info", text, ttlMs = DEFAULT_TTL_MS } = {}) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((t) => [...t, { id, kind, text }]);
      if (ttlMs > 0) setTimeout(() => remove(id), ttlMs);
      return id;
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={{ showToast, remove }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback silencioso — se não houver Provider, usa console.
    return {
      showToast: ({ kind, text }) => console.log(`[toast:${kind}] ${text}`),
      remove: () => {},
    };
  }
  return ctx;
}

function ToastViewport({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2 sm:right-6">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const styles = {
    success: "bg-success text-white border-success/50",
    error: "bg-danger text-white border-danger/50",
    warning: "bg-warning text-white border-warning/50",
    info: "bg-surface-2 text-text-main border-border",
  };
  const icons = {
    success: "check_circle",
    error: "error",
    warning: "warning",
    info: "info",
  };
  const kind = toast.kind || "info";

  // Anima entrada
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-elev-2 transition-all duration-200 ${
        styles[kind]
      } ${visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}`}
    >
      <span className="material-symbols-outlined text-base leading-none">{icons[kind]}</span>
      <span className="flex-1 whitespace-pre-wrap">{toast.text}</span>
      <button
        onClick={onDismiss}
        className="opacity-80 hover:opacity-100"
        aria-label="Dispensar"
      >
        <span className="material-symbols-outlined text-base leading-none">close</span>
      </button>
    </div>
  );
}
