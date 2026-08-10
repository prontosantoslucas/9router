"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  EDGE_TTS_VOICES, DEFAULT_VOICE, getSelectedVoice, setSelectedVoice,
} from "@/shared/constants/edgeTtsVoices";

const PREVIEW_TEXT = "Olá, sou o Lucas. Este é um teste de voz — te ajudo a organizar teu dia, achar vagas, e responder no chat.";

/**
 * Modal de escolha de voz TTS. Agrupa por locale, permite preview
 * (chama /api/agent/audio/tts com a voice selecionada) e persiste em
 * localStorage. Auto-play do modo voz e o botão "Ouvir" leem essa pref.
 */
export function VoiceSelectorModal({ open, onClose }) {
  const [selected, setSelected] = useState(DEFAULT_VOICE);
  const [previewing, setPreviewing] = useState(null); // voice id em preview
  const [previewLoading, setPreviewLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const audioRef = useRef(null);

  useEffect(() => {
    if (open) setSelected(getSelectedVoice());
  }, [open]);

  useEffect(() => {
    if (!open && audioRef.current) {
      try { audioRef.current.pause(); } catch {}
      audioRef.current = null;
      setPreviewing(null);
    }
  }, [open]);

  const grouped = useMemo(() => {
    const filtered = filter === "all"
      ? EDGE_TTS_VOICES
      : EDGE_TTS_VOICES.filter((v) => v.locale.startsWith(filter));
    const map = new Map();
    for (const v of filtered) {
      if (!map.has(v.locale)) map.set(v.locale, []);
      map.get(v.locale).push(v);
    }
    return [...map.entries()];
  }, [filter]);

  const handlePreview = async (voice) => {
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch {}
      audioRef.current = null;
    }
    if (previewing === voice.id) {
      setPreviewing(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewing(voice.id);
    try {
      const res = await fetch("/api/agent/audio/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: PREVIEW_TEXT, voice: voice.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const audio = new Audio(`data:${data.mimeType || "audio/mpeg"};base64,${data.base64}`);
      audioRef.current = audio;
      audio.onended = () => setPreviewing(null);
      audio.play().catch(() => setPreviewing(null));
    } catch (err) {
      alert(`Preview falhou: ${err.message}`);
      setPreviewing(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSave = () => {
    setSelectedVoice(selected);
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch {}
    }
    onClose?.();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-border bg-surface shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-text-main">Escolher voz do Lucas</h2>
            <p className="text-xs text-text-muted mt-0.5">Clique em ▶ pra ouvir uma amostra. Só a selecionada é salva.</p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-main transition-colors"
            aria-label="Fechar"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Filtro rápido de locale */}
        <div className="flex gap-1.5 px-4 py-2 border-b border-border overflow-x-auto">
          {[
            ["all", "Todas"], ["pt-BR", "PT-BR"], ["pt-PT", "PT-PT"],
            ["en", "Inglês"], ["es", "Espanhol"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                filter === id
                  ? "bg-brand-500 text-white"
                  : "bg-surface-2 text-text-muted hover:text-text-main"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {grouped.map(([locale, voices]) => (
            <div key={locale} className="mb-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted px-3 py-1.5">
                {locale}
              </div>
              {voices.map((v) => {
                const isSelected = selected === v.id;
                const isPlaying = previewing === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => setSelected(v.id)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? "bg-brand-500/10 ring-1 ring-brand-500/40" : "hover:bg-surface-2"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                      isSelected ? "border-brand-500 bg-brand-500" : "border-border"
                    }`}>
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-main">{v.label}</span>
                        {v.tag && (
                          <span className="text-[9px] uppercase font-bold bg-brand-500/20 text-brand-500 px-1.5 py-0.5 rounded">
                            {v.tag}
                          </span>
                        )}
                        <span className="text-[10px] text-text-muted">
                          {v.gender === "F" ? "♀" : "♂"}
                        </span>
                      </div>
                      <div className="text-xs text-text-muted">{v.desc}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePreview(v); }}
                      disabled={previewLoading}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-text-muted hover:bg-surface-3 hover:text-brand-500 transition-colors disabled:opacity-50"
                      title="Ouvir amostra"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {isPlaying ? "stop_circle" : "play_arrow"}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 p-3 border-t border-border">
          <span className="text-xs text-text-muted">
            {EDGE_TTS_VOICES.length} vozes disponíveis — Edge TTS (grátis)
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-text-muted hover:text-text-main transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded-md bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
