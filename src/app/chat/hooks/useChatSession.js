"use client";

import { useState, useEffect, useCallback } from "react";
import { renderMarkdown } from "../lib/markdown";

const MAX_HISTORY = 200;

export function useChatSession(sessionId = "default") {
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const storageKey = `chat_msgs_${sessionId}`;

  // Carregar histórico inicial do localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setMessages(JSON.parse(saved));
      }
    } catch (err) {
      console.error("[useChatSession] Erro ao carregar mensagens:", err);
    }
  }, [storageKey]);

  // Persistir mensagens no localStorage
  const saveMessages = useCallback((newMsgs) => {
    try {
      const trimmed = newMsgs.slice(-MAX_HISTORY);
      localStorage.setItem(storageKey, JSON.stringify(trimmed));
      setMessages(trimmed);
    } catch (err) {
      console.error("[useChatSession] Erro ao salvar mensagens:", err);
    }
  }, [storageKey]);

  const sendMessage = async (text, options = {}) => {
    if (!text || isSending) return;

    const userMsg = {
      id: Date.now().toString(),
      role: "user",
      sender: "Você",
      content: text,
      htmlContent: renderMarkdown(text),
      timestamp: Date.now(),
    };

    const updatedWithUser = [...messages, userMsg];
    saveMessages(updatedWithUser);
    setIsSending(true);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          chatId: `web:${sessionId}`,
          userName: "Você",
          ...options,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha na resposta do Agente Lucas");

      const agentMsg = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        agentId: "lucas",
        agentName: "Lucas",
        content: data.reply || data.content || "Entendido!",
        htmlContent: renderMarkdown(data.reply || data.content || "Entendido!"),
        image: data.image,
        audioUrl: data.audioUrl,
        timestamp: Date.now(),
      };

      saveMessages([...updatedWithUser, agentMsg]);
    } catch (err) {
      console.error("[useChatSession] Erro no envio:", err.message);
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        agentId: "lucas",
        agentName: "Lucas",
        content: `❌ Ops, não consegui responder: ${err.message}`,
        htmlContent: `<span class="text-danger">❌ Ops, não consegui responder: ${err.message}</span>`,
        isError: true,
        timestamp: Date.now(),
      };
      saveMessages([...updatedWithUser, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const clearSession = () => {
    localStorage.removeItem(storageKey);
    setMessages([]);
  };

  return {
    messages,
    isSending,
    sendMessage,
    clearSession,
  };
}
