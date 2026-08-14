"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";

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

// Catálogo completo de comandos disponíveis do Bot Lucas
export const SLASH_COMMANDS = [
  {
    name: "/manual",
    syntax: "/manual [tema]",
    category: "Instruções & Ensino",
    icon: "menu_book",
    label: "Manual Interativo do Lucas",
    desc: "Abre o menu e ensina passo a passo como usar cada ferramenta, função de prospecção e estratégias de venda.",
    example: "/manual prospecção",
    insert: "/manual ",
  },
  {
    name: "/prospector status",
    syntax: "/prospector status",
    category: "Prospecção B2B",
    icon: "radar",
    label: "Status da Prospecção 24/7",
    desc: "Exibe o painel de controle com status do motor contínuo, produto ativo, métricas do dia e leads minerados.",
    example: "/prospector status",
    insert: "/prospector status",
  },
  {
    name: "/prospector avatar",
    syntax: "/prospector avatar <nicho>",
    category: "Inteligência de Mercado",
    icon: "psychology",
    label: "Pesquisa de Mercado & Avatar/ICP",
    desc: "Realiza varredura na Web com IA para mapear tomadores de decisão, dores latentes, objeções e ganchos comerciais de alta conversão.",
    example: "/prospector avatar Clínicas Odontológicas",
    insert: "/prospector avatar ",
  },
  {
    name: "/prospector run",
    syntax: "/prospector run",
    category: "Prospecção B2B",
    icon: "rocket_launch",
    label: "Executar Busca de Clientes Agora",
    desc: "Dispara um ciclo imediato de mineração de clientes na Web/Google/Instagram e gera abordagens de vendas.",
    example: "/prospector run",
    insert: "/prospector run",
  },
  {
    name: "/prospector produtos",
    syntax: "/prospector produtos",
    category: "Portfólio",
    icon: "inventory_2",
    label: "Portfólio de Produtos à Venda",
    desc: "Lista todas as aplicações e produtos cadastrados no seu catálogo de prospecção (Zenda AI, MaxRouter, etc.).",
    example: "/prospector produtos",
    insert: "/prospector produtos",
  },
  {
    name: "/prospector usar",
    syntax: "/prospector usar <produto_id>",
    category: "Portfólio",
    icon: "check_circle",
    label: "Ativar Produto para Prospecção 24/7",
    desc: "Troca o produto foco da prospecção contínua (ex.: 'zenda-ai' para clínicas ou '9router-gateway' para devs).",
    example: "/prospector usar zenda-ai",
    insert: "/prospector usar ",
  },
  {
    name: "/prospector produto add",
    syntax: "/prospector produto add <Nome>; <Descrição>; <Nichos>; <Cidades>",
    category: "Portfólio",
    icon: "add_box",
    label: "Cadastrar Novo Produto para Vender",
    desc: "Cadastra uma nova aplicação no seu portfólio para o robô minerar clientes e redigir abordagens.",
    example: "/prospector produto add Zenda AI ; Agente de IA para WhatsApp 24/7 ; Clínicas ; São Paulo",
    insert: "/prospector produto add ",
  },
  {
    name: "/prospector add",
    syntax: "/prospector add <nichos>; [cidades]",
    category: "Configuração",
    icon: "tune",
    label: "Configurar Nichos e Cidades de Busca",
    desc: "Atualiza os nichos de mercado e as cidades-alvo onde o robô deve minerar novos clientes.",
    example: "/prospector add Odontologia, Estética Avançada; São Paulo, Moema",
    insert: "/prospector add ",
  },
  {
    name: "/prospector list",
    syntax: "/prospector list",
    category: "Relatórios",
    icon: "list_alt",
    label: "Listar Clientes & Abordagens",
    desc: "Lista os últimos estabelecimentos minerados com telefones WhatsApp, perfis do Instagram e rascunhos de pitch.",
    example: "/prospector list",
    insert: "/prospector list",
  },
  {
    name: "/prospector toggle",
    syntax: "/prospector toggle",
    category: "Controle",
    icon: "toggle_on",
    label: "Ligar / Pausar Motor 24/7",
    desc: "Pausa ou retoma a execução contínua em segundo plano do prospector de clientes.",
    example: "/prospector toggle",
    insert: "/prospector toggle",
  },
  {
    name: "/modelos",
    syntax: "/modelos",
    category: "Sistema",
    icon: "memory",
    label: "Ranking de Modelos & Latência",
    desc: "Exibe os modelos de inteligência artificial disponíveis no gateway e o ranking de velocidade.",
    example: "/modelos",
    insert: "/modelos",
  },
  {
    name: "/limpar",
    syntax: "/limpar",
    category: "Chat",
    icon: "delete_sweep",
    label: "Limpar Histórico da Sessão",
    desc: "Reinicia o contexto da conversa atual com o Lucas.",
    example: "/limpar",
    insert: "/limpar",
  },
];

export function ChatComposer({
  onSend, onUpload, isSending,
  placeholder = "Converse com o Lucas... (digite / para ver os comandos)",
  value, onChange,
  voiceMode = false,
  onToggleVoiceMode,
  onOpenVoiceSettings,
  autoRecordSignal = 0,
}) {
  const isControlled = value !== undefined;
  const [internalText, setInternalText] = useState("");
  const text = isControlled ? value : internalText;
  const setText = isControlled ? onChange : setInternalText;

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);

  // ── Estado do Menu de Comandos Slash (/) ──
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const recTimerRef = useRef(null);
  const menuContainerRef = useRef(null);

  // Filtra comandos baseado no texto digitado após a barra
  const slashFilter = useMemo(() => {
    if (!text.startsWith("/")) return null;
    const clean = text.slice(1).toLowerCase().trim();
    return clean;
  }, [text]);

  const filteredCommands = useMemo(() => {
    if (slashFilter === null) return [];
    if (!slashFilter) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter((cmd) => {
      const matchName = cmd.name.toLowerCase().includes(slashFilter);
      const matchLabel = cmd.label.toLowerCase().includes(slashFilter);
      const matchCategory = cmd.category.toLowerCase().includes(slashFilter);
      return matchName || matchLabel || matchCategory;
    });
  }, [slashFilter]);

  // Abre ou fecha o menu automaticamente
  useEffect(() => {
    if (slashFilter !== null && filteredCommands.length > 0) {
      setIsMenuOpen(true);
      setSelectedIndex(0);
    } else {
      setIsMenuOpen(false);
    }
  }, [slashFilter, filteredCommands.length]);

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

  const selectCommand = (cmd) => {
    if (!cmd) return;
    setText(cmd.insert || cmd.name);
    setIsMenuOpen(false);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!text.trim() || isSending) return;
    setIsMenuOpen(false);
    onSend(text.trim());
    setText("");
  };

  const handleKeyDown = (e) => {
    if (isMenuOpen && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectCommand(filteredCommands[selectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setIsMenuOpen(false);
        return;
      }
    }

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
      if (!transcript) {
        if (!voiceMode) alert("Não entendi o áudio. Tente falar mais perto do microfone.");
        return;
      }
      if (voiceMode) {
        onSend(transcript);
      } else {
        setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        textareaRef.current?.focus();
      }
    } catch (err) {
      alert(`Falha na transcrição: ${err.message}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  useEffect(() => {
    if (autoRecordSignal > 0 && voiceMode && !isRecording && !isSending && !isTranscribing) {
      startRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRecordSignal]);

  const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(1, "0")}:${String(s % 60).padStart(2, "0")}`;

  const activeCommandForPreview = hoveredIndex !== null ? filteredCommands[hoveredIndex] : filteredCommands[selectedIndex];

  return (
    <form
      onSubmit={handleSubmit}
      className="relative w-full rounded-2xl border border-border/80 bg-surface/95 p-2 shadow-elev backdrop-blur transition-all focus-within:border-brand-500/60 focus-within:shadow-warm dark:bg-surface-2/95"
    >
      {/* ── Menu Pop-up de Comandos Slash (/) ── */}
      {isMenuOpen && filteredCommands.length > 0 && (
        <div
          ref={menuContainerRef}
          className="absolute bottom-full left-0 right-0 mb-3 z-50 overflow-hidden rounded-2xl border border-border/80 bg-surface/95 shadow-2xl backdrop-blur-xl transition-all duration-150 animate-in fade-in slide-in-from-bottom-2 dark:bg-surface-2/95"
        >
          <div className="flex flex-col md:flex-row max-h-[360px]">
            {/* Lista de Comandos */}
            <div className="flex-1 overflow-y-auto p-1.5 custom-scrollbar max-h-[220px] md:max-h-[360px]">
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted/70 flex items-center justify-between border-b border-border/40 mb-1">
                <span>Comandos Disponíveis</span>
                <span className="text-[10px] font-normal lowercase">↑↓ navega • enter seleciona</span>
              </div>

              {filteredCommands.map((cmd, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={cmd.name}
                    type="button"
                    onClick={() => selectCommand(cmd)}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${
                      isSelected
                        ? "bg-brand-500 text-white font-medium shadow-sm"
                        : "text-text-main hover:bg-bg-alt/70"
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[18px] shrink-0 ${
                        isSelected ? "text-white" : "text-brand-500"
                      }`}
                    >
                      {cmd.icon}
                    </span>
                    <span className="font-mono text-xs font-semibold">{cmd.name}</span>
                    <span
                      className={`text-xs truncate flex-1 ${
                        isSelected ? "text-white/90" : "text-text-muted"
                      }`}
                    >
                      {cmd.label}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md uppercase font-mono tracking-tight shrink-0 ${
                        isSelected ? "bg-white/20 text-white" : "bg-bg-alt text-text-muted"
                      }`}
                    >
                      {cmd.category}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Painel Explicativo ao passar o mouse ou navegar com teclado */}
            {activeCommandForPreview && (
              <div className="hidden md:flex flex-col justify-between w-[280px] p-3.5 border-t md:border-t-0 md:border-l border-border/50 bg-bg-alt/40">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="material-symbols-outlined text-brand-500 text-[20px]">
                      {activeCommandForPreview.icon}
                    </span>
                    <span className="font-semibold text-text-main text-xs">
                      {activeCommandForPreview.label}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed mb-3">
                    {activeCommandForPreview.desc}
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-border/40">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted/80 block">
                    Exemplo de Uso
                  </span>
                  <code className="block text-[11px] font-mono p-1.5 rounded-lg bg-surface/80 border border-border/60 text-brand-600 dark:text-brand-400 break-all select-all">
                    {activeCommandForPreview.example}
                  </code>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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

          {/* Toggle modo conversação (auto-envia + auto-play + loop) */}
          {onToggleVoiceMode && (
            <button
              type="button"
              onClick={onToggleVoiceMode}
              disabled={isTranscribing || isRecording}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-40 ${
                voiceMode
                  ? "bg-brand-500 text-white shadow-soft hover:bg-brand-600"
                  : "text-text-muted hover:bg-bg-alt hover:text-brand-500"
              }`}
              title={voiceMode ? "Sair do modo voz" : "Modo conversa por voz (hands-free)"}
            >
              <span className="material-symbols-outlined text-[22px]">
                {voiceMode ? "headset_mic" : "headset"}
              </span>
            </button>
          )}

          {/* Ajustes de voz (escolher qual voz TTS usa) */}
          {onOpenVoiceSettings && (
            <button
              type="button"
              onClick={onOpenVoiceSettings}
              disabled={isRecording}
              className="flex h-10 w-8 shrink-0 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-bg-alt hover:text-brand-500 disabled:opacity-40"
              title="Escolher voz do Lucas"
            >
              <span className="material-symbols-outlined text-[20px]">tune</span>
            </button>
          )}

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
              title="Gravar áudio (transcrever pro campo de texto)"
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
