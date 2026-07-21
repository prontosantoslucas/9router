"use client";

import React, { useState, useRef } from "react";

export function ChatComposer({ onSend, onUpload, isSending, placeholder = "Converse com o Lucas..." }) {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
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
    if (file && onUpload) {
      onUpload(file);
    }
    e.target.value = "";
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full rounded-xl bg-surface border border-border p-2 shadow-soft transition-all focus-within:border-brand-500 dark:bg-surface-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.xlsx,.txt"
      />

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:bg-bg-alt hover:text-brand-500 transition-colors"
          title="Anexar arquivo ou imagem"
        >
          <span className="material-symbols-outlined text-xl">attach_file</span>
        </button>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={isSending}
          className="max-h-32 min-h-[38px] flex-1 resize-none bg-transparent py-2 text-sm text-text-main placeholder-text-muted focus:outline-none custom-scrollbar"
        />

        <button
          type="button"
          onClick={() => setIsRecording(!isRecording)}
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
            isRecording ? "bg-danger text-white animate-pulse" : "text-text-muted hover:bg-bg-alt hover:text-brand-500"
          }`}
          title={isRecording ? "Parar gravação" : "Gravar áudio"}
        >
          <span className="material-symbols-outlined text-xl">{isRecording ? "mic_off" : "mic"}</span>
        </button>

        <button
          type="submit"
          disabled={!text.trim() || isSending}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white transition-all hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Enviar mensagem"
        >
          <span className="material-symbols-outlined text-xl">send</span>
        </button>
      </div>
    </form>
  );
}
