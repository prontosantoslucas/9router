/**
 * Real code generator for Coder.
 * Streams from the router OpenAI-compatible endpoint (/api/v1/chat/completions,
 * stream:true) and emits each file as soon as its ```path=...``` block closes.
 */

const SYSTEM_PROMPT = `Você é um agente de engenharia de software que gera aplicações web completas e funcionais.

REGRAS DE SAÍDA (obrigatórias):
- Responda SOMENTE com blocos de código de arquivos. Sem texto fora dos blocos, exceto uma única linha final começando com "RESUMO:".
- Cada arquivo deve estar em um bloco cercado assim:
\`\`\`path=caminho/do/arquivo.ext
<conteúdo completo do arquivo>
\`\`\`
- Gere uma árvore de pastas coerente (ex.: src/App.tsx, src/main.tsx, index.html, package.json, vite.config.ts, server.js quando fizer sentido).
- Frontend React + Tailwind. Código real, sem placeholders "TODO".
- Use apenas react e react-dom como dependências de runtime no frontend (o preview compila com esbuild). Não use outros pacotes npm no frontend.
- Inclua package.json com scripts dev/build/start.
- Se pedir backend, gere server.js (Node/Express) com rotas /api reais.
- Sempre inclua src/main.tsx que faz createRoot e renderiza src/App.tsx.
- Não repita arquivos. Conteúdo completo em cada bloco.`;

const FENCE_OPEN = /```(?:[a-zA-Z]*[ \t]+)?path=([^\n`]+)\n/;

function makeStreamParser(onFile) {
  let buf = "";
  let inFile = false;
  let curPath = "";
  let curContent = "";

  return function feed(chunk) {
    buf += chunk;

    // Consume as much as possible each call.
    while (true) {
      if (!inFile) {
        const m = buf.match(FENCE_OPEN);
        if (!m) {
          // keep only a tail that could still contain a partial fence marker
          if (buf.length > 512) buf = buf.slice(-512);
          return;
        }
        curPath = m[1].trim().replace(/^["'`]|["'`]$/g, "").replace(/^\.?\//, "");
        curContent = "";
        inFile = true;
        buf = buf.slice(m.index + m[0].length);
      } else {
        const close = buf.indexOf("\n```");
        if (close === -1) {
          // stream all but a tiny tail (closing fence might be split across chunks)
          if (buf.length > 4) {
            curContent += buf.slice(0, buf.length - 4);
            buf = buf.slice(-4);
          }
          return;
        }
        curContent += buf.slice(0, close);
        buf = buf.slice(close + 4); // drop "\n```"
        inFile = false;
        if (curPath) onFile({ path: curPath, content: curContent });
      }
    }
  };
}

function extractSummary(text) {
  const m = text.match(/RESUMO:\s*(.+)$/m);
  return m ? m[1].trim() : "";
}

async function resolveModel() {
  try {
    const res = await fetch("/api/models");
    if (res.ok) {
      const data = await res.json();
      const list = data.models || [];
      const preferred = list.find((x) => x.caps?.reasoning) || list[0];
      if (preferred?.fullModel) return preferred.fullModel;
    }
  } catch {}
  return "auto";
}

/**
 * Streams generation. Calls:
 *  - onToken(textDelta)   raw model text (for terminal echo)
 *  - onFile({path,content}) as each file block closes
 * Returns { message, files }.
 */
export async function generateProjectFromLLM({
  prompt,
  currentFiles = [],
  model,
  apiKey,
  signal,
  onToken,
  onFile,
  onTerminalLog,
  onStreamMessage,
}) {
  const chosenModel = model || (await resolveModel());
  onStreamMessage?.(`Gerando com modelo ${chosenModel}...`);
  onTerminalLog?.({ type: "info", text: `$ coder generate --stream --model ${chosenModel}` });

  const contextNote =
    currentFiles.length > 0
      ? `\n\nArquivos atuais do projeto (modifique/estenda conforme necessário):\n${currentFiles
          .map((f) => `- ${f.path}`)
          .join("\n")}`
      : "";

  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch("/api/v1/chat/completions", {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      model: chosenModel,
      stream: true,
      temperature: 0.4,
      max_tokens: 8192,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Ideia/pedido: ${prompt}${contextNote}` },
      ],
    }),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Gateway ${res.status}: ${String(errText).slice(0, 300)}`);
  }

  const files = [];
  const parser = makeStreamParser((file) => {
    files.push(file);
    onFile?.(file);
    onTerminalLog?.({ type: "success", text: `✓ ${file.path}` });
  });

  let fullText = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sseBuf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sseBuf += decoder.decode(value, { stream: true });

    let nl;
    while ((nl = sseBuf.indexOf("\n")) !== -1) {
      const line = sseBuf.slice(0, nl).trim();
      sseBuf = sseBuf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      let delta = "";
      try {
        const json = JSON.parse(payload);
        delta = json?.choices?.[0]?.delta?.content || json?.choices?.[0]?.message?.content || "";
      } catch {
        continue;
      }
      if (delta) {
        fullText += delta;
        onToken?.(delta);
        parser(delta);
      }
    }
  }

  if (files.length === 0) {
    throw new Error("Modelo não retornou arquivos em blocos path=. Tente reescrever o pedido.");
  }

  const summary = extractSummary(fullText) || `Projeto gerado com ${files.length} arquivo(s).`;
  return { message: summary, files };
}

// Non-stream fallback parser (kept for tests / callers that pass a full reply).
export function parseFilesFromReply(text) {
  const files = [];
  const parser = makeStreamParser((f) => files.push(f));
  parser(text.endsWith("\n") ? text : text + "\n");
  return files;
}

