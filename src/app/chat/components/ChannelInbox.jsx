"use client";

import React, { useState, useEffect, useCallback } from "react";

export function ChannelInbox({ onSelectPrompt }) {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/channels/notifications?peek=1");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch (err) {
      console.warn("[ChannelInbox] Erro ao buscar notificações:", err.message);
    }
  }, []);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 10000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  const markAllRead = async () => {
    try {
      await fetch("/api/agent/channels/notifications"); // Sem peek -> marca como lidas
      setNotifications([]);
    } catch {}
  };

  const handleAction = (notif, actionType) => {
    const channelName = notif.channel === "whatsapp" ? "WhatsApp" : "Telegram";
    const target = notif.senderName || notif.chatName || "contato";

    if (actionType === "summarize") {
      onSelectPrompt(`Resuma as últimas mensagens de ${target} no ${channelName}`);
    } else if (actionType === "reply") {
      onSelectPrompt(`Responda para ${target} no ${channelName}: `);
    }
    setIsOpen(false);
  };

  const unreadCount = notifications.length;

  return (
    <div className="relative">
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchUnread();
        }}
        className="relative flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:border-brand-500 hover:text-text-main transition-colors"
        title="Inbox de Canais (WhatsApp / Telegram)"
      >
        <span className="material-symbols-outlined text-sm text-brand-500">inbox</span>
        <span>Canais</span>
        {unreadCount > 0 && (
          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-border bg-surface p-4 shadow-2xl space-y-3 dark:bg-surface-2 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-brand-500">inbox</span>
              <h4 className="font-bold text-xs text-text-main">Inbox de Mensagens</h4>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[10px] font-semibold text-text-muted hover:text-brand-500"
              >
                Limpar todas
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto space-y-2.5 divide-y divide-border/40">
            {notifications.length === 0 ? (
              <p className="py-4 text-center text-xs text-text-muted">
                Nenhuma mensagem pendente nos canais.
              </p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="pt-2 first:pt-0 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-text-main flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-brand-500">
                        {n.channel === "whatsapp" ? "chat" : "send"}
                      </span>
                      <span>{n.senderName || n.chatName}</span>
                    </span>
                    <span className="text-[10px] text-text-muted">
                      {n.at ? new Date(n.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>

                  <p className="text-xs text-text-muted line-clamp-2 bg-bg-alt/50 p-2 rounded border border-border/30">
                    "{n.text}"
                  </p>

                  <div className="flex justify-end gap-1.5 pt-0.5">
                    <button
                      onClick={() => handleAction(n, "summarize")}
                      className="px-2 py-1 rounded border border-border text-[10px] font-bold text-brand-500 hover:bg-brand-500/10"
                    >
                      Resumir
                    </button>
                    <button
                      onClick={() => handleAction(n, "reply")}
                      className="px-2 py-1 rounded bg-brand-500 text-[10px] font-bold text-white hover:bg-brand-600"
                    >
                      Responder
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
