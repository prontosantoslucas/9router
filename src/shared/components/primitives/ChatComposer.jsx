"use client";

import React, { useState, useRef, useEffect } from "react";

// Converte Blob → base64 puro (sem o prefixo data:)
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result || "";
      const base64 = String(result).split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function ChatComposer({ onSend, onUpload, isSending, placeholder = "Converse com o Lucas..." }) {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const recTimerRef = useRef(null);

  // Auto-grow do textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  // Limpeza ao desmontar
  useEffect(() => {
    return () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!text.trim() || isSending) return;
    onSend(text.trim());
    setText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onUpload) onUpload(file);
    e.target.value = "";
  };

  // ── Gravação de áudio (MediaRecorder) → transcrição (Groq Whisper) ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRecorderRef.current = rec;

      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
        await transcribe(blob);
      };

      rec.start();
      setIsRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch (err) {
      alert("Não consegui acessar o microfone. Verifique a permissão do navegador.");
      console.error("[Audio] getUserMedia:", err.message);
    }
  };

  const stopRecording = (cancel = false) => {
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    setIsRecording(false);
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    if (cancel) {
      rec.onstop = null;
      try { rec.stop(); } catch {}
      streamRef.current?.getTracks().forEach((t) => t.stop());
      chunksRef.current = [];
      return;
    }
    try { rec.stop(); } catch {}
  };

  const transcribe = async (blob) => {
    setIsTranscribing(true);
    try {
      const base64 = await blobToBase64(blob);
      const res = await fetch("/api/agent/audio/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimeType: blob.type || "audio/webm", filename: "nota.webm" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const transcript = (data.text || "").trim();
      if (transcript) {
        setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        textareaRef.current?.focus();
      } else {
        alert("Não entendi o áudio. Tente falar mais perto do microfone.");
      }
    } catch (err) {
      alert(`Falha na transcrição: ${err.message}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(1, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <form
      onSubmit={handleSubmit}
      className="relative w-full rounded-2xl border border-border/80 bg-surface/90 p-2 shadow-elev backdrop-blur transition-all focus-within:border-brand-500/60 focus-within:shadow-warm dark:bg-surface-2/90"
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xlsx,.txt"
      />

      {isRecording ? (
        // ── Estado de gravação ──
        <div className="flex items-center gap-3 px-2 py-1.5">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger/70" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-danger" />
          </span>
          <span className="font-mono text-sm text-text-main tabular-nums">{fmtTime(recSeconds)}</span>
          <span className="flex-1 text-xs text-text-muted">Gravando… fale e toque em enviar</span>
          <button
            type="button"
            onClick={() => stopRecording(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-bg-alt hover:text-danger"
            title="Cancelar"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
          <button
            type="button"
            onClick={() => stopRecording(false)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white transition-all hover:bg-brand-600"
            title="Transcrever"
          >
            <span className="material-symbols-outlined text-xl">check</span>
          </button>
        </div>
      ) : (
        // ── Estado normal ──
        <div className="flex items-end gap-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isTranscribing}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-bg-alt hover:text-brand-500 disabled:opacity-40"
            title="Anexar imagem, áudio, vídeo ou documento"
          >
            <span className="material-symbols-outlined text-[22px]">add_circle</span>
          </button>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isTranscribing ? "Transcrevendo áudio…" : placeholder}
            rows={1}
            disabled={isSending || isTranscribing}
            className="custom-scrollbar max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2.5 text-sm leading-relaxed text-text-main placeholder-text-muted/70 focus:outline-none disabled:opacity-60"
          />

          {text.trim() ? (
            <button
              type="submit"
              disabled={isSending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-soft transition-all hover:bg-brand-600 hover:shadow-warm disabled:opacity-50"
              title="Enviar"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={isTranscribing}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-bg-alt hover:text-brand-500 disabled:opacity-40"
              title="Gravar áudio"
            >
              <span className="material-symbols-outlined text-[22px]">
                {isTranscribing ? "sync" : "mic"}
              </span>
            </button>
          )}
        </div>
      )}
    </form>
  );
}
