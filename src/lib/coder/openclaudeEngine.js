/**
 * OpenClaude Engine for Coder — backed by the real 9Router LLM gateway (streaming).
 * Keeps the public API (processOpenClaudePrompt / enhanceUserPrompt /
 * INITIAL_PROJECT_FILES) so both Coder UIs keep working unchanged.
 */

import { generateProjectFromLLM } from "./generatorClient";

export const INITIAL_PROJECT_FILES = [];

export function enhanceUserPrompt(rawIdea = "") {
  const idea = rawIdea.trim();
  if (!idea) return "";

  return `[ESPECIFICAÇÃO DE APLICAÇÃO - CODER]
Objetivo: Criar uma aplicação web completa, responsiva e moderna com base na ideia: "${idea}".

--- ESTRUTURA E ARQUITETURA ---
1. FRONTEND (construir primeiro):
   - Interface responsiva em React (src/App.tsx) com Tailwind CSS e componentes modernos.
   - Navegação, cards interativos, tabelas, formulários com useState e badges de status.
   - Design elegante com gradientes e suporte a tema escuro/claro. Sem placeholders genéricos.

2. BACKEND LOCALHOST:
   - Servidor Node.js/Express (server.js) para localhost.
   - Rotas API de leitura/gravação (GET/POST /api/data).

3. VISUALIZAÇÃO INSTANTÂNEA:
   - src/main.tsx com createRoot renderizando src/App.tsx para o Live Preview.`;
}

function mergeFiles(existing, incoming) {
  const map = new Map(existing.map((f) => [f.path, f]));
  for (const f of incoming) map.set(f.path, f);
  return Array.from(map.values());
}

export async function processOpenClaudePrompt({
  prompt,
  currentFiles = [],
  model,
  apiKey,
  signal,
  onStreamMessage,
  onTerminalLog,
  onUpdateFiles,
  onToken,
}) {
  onStreamMessage?.("Enviando pedido ao modelo...");
  onTerminalLog?.({ type: "command", text: `$ coder agent "${String(prompt).slice(0, 60)}..."` });

  // Live-merge files as they stream in.
  let working = [...currentFiles];

  const { message, files } = await generateProjectFromLLM({
    prompt,
    currentFiles,
    model,
    apiKey,
    signal,
    onToken,
    onTerminalLog,
    onStreamMessage,
    onFile: (file) => {
      working = mergeFiles(working, [file]);
      onStreamMessage?.(`Escrevendo ${file.path}...`);
      onUpdateFiles?.(working);
    },
  });

  const merged = mergeFiles(currentFiles, files);
  onStreamMessage?.("Concluído! Renderizando Live Preview...");
  onUpdateFiles?.(merged);
  onTerminalLog?.({ type: "info", text: "➜ Build + Live Preview atualizados no Coder IDE" });

  return { message, files: merged };
}
