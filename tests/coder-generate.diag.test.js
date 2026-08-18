// Diagnóstico do Coder: reproduz o payload exato que /api/coder/generate
// recebe e verifica se o parser do Coder acha arquivos na resposta.
//
// Faz chamada REAL ao gateway local (credenciais do banco em ~/.9router), porque
// "o Coder não funciona" só vira acionável quando se sabe em qual etapa quebra:
// resolução do modelo, autenticação do provedor, stream, ou formato da resposta.
//
// Não é teste de regressão: é instrumento de diagnóstico. Fica fora do baseline.

import { describe, it, expect } from "vitest";
import { getProviderConnections } from "@/lib/db/index.js";
import { handleChat } from "@/sse/handlers/chat.js";
import { initTranslators } from "open-sse/translator/index.js";
import { parseFilesFromReply, extractFilesLenient } from "@/lib/coder/generatorClient.js";

const SYSTEM_PROMPT = `Você é um agente de engenharia de software que gera aplicações web completas e funcionais.

REGRAS DE SAÍDA (obrigatórias):
- Responda SOMENTE com blocos de código de arquivos. Sem texto fora dos blocos, exceto uma única linha final começando com "RESUMO:".
- Cada arquivo deve estar em um bloco cercado assim:
\`\`\`path=caminho/do/arquivo.ext
<conteúdo completo do arquivo>
\`\`\`
- Sempre inclua src/main.tsx que faz createRoot e renderiza src/App.tsx.`;

const MODELO = process.env.CODER_DIAG_MODEL || "auto";

async function chamarComoCoder(model) {
  const req = new Request("http://127.0.0.1:20128/api/coder/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: true,
      temperature: 0.4,
      max_tokens: 700, // pequeno: diagnóstico, não geração de app
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: "Ideia/pedido: uma pagina com um contador simples em React" },
      ],
    }),
  });
  return handleChat(req);
}

// Consome o SSE do mesmo jeito que o generatorClient no navegador.
async function lerSse(res) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let sseBuf = "", texto = "", eventos = 0;
  const naoData = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    sseBuf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = sseBuf.indexOf("\n")) !== -1) {
      const line = sseBuf.slice(0, nl).trim();
      sseBuf = sseBuf.slice(nl + 1);
      if (!line) continue;
      if (!line.startsWith("data:")) { if (naoData.length < 5) naoData.push(line); continue; }
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      eventos++;
      try {
        const j = JSON.parse(payload);
        texto += j?.choices?.[0]?.delta?.content || j?.choices?.[0]?.message?.content || "";
      } catch {
        if (naoData.length < 5) naoData.push(`JSON invalido: ${payload.slice(0, 120)}`);
      }
    }
  }
  return { texto, eventos, naoData };
}

// Exige credencial de provedor ATIVA: sem isso nao ha o que gerar, e deixar o
// teste falhar em toda maquina sem credencial poluiria o baseline da suite
// (que e julgado por tests/__baseline__/verify-no-regression.mjs).
const temCredencial = (await getProviderConnections({ isActive: true }).catch(() => []))?.length > 0;

describe.skipIf(!temCredencial)("diagnóstico do Coder (requer credencial ativa)", () => {
  it("gera arquivos a partir do payload real do Coder", async () => {
    await initTranslators();
    console.log(`\n[diag] modelo pedido: ${MODELO}`);

    const res = await chamarComoCoder(MODELO);
    console.log(`[diag] status HTTP: ${res.status}`);
    console.log(`[diag] content-type: ${res.headers.get("content-type")}`);

    if (res.status !== 200) {
      const corpo = await res.text().catch(() => "(ilegivel)");
      console.log(`[diag] CORPO DE ERRO: ${corpo.slice(0, 1000)}`);
      expect.fail(`gateway devolveu ${res.status}: ${corpo.slice(0, 300)}`);
    }
    expect(res.body, "resposta 200 sem corpo de stream").toBeTruthy();

    const { texto, eventos, naoData } = await lerSse(res);
    console.log(`[diag] eventos data: ${eventos}`);
    if (naoData.length) console.log(`[diag] linhas nao-data: ${JSON.stringify(naoData)}`);
    console.log(`[diag] texto acumulado: ${texto.length} chars`);
    console.log(`[diag] --- inicio da resposta ---\n${texto.slice(0, 800) || "(VAZIO)"}\n[diag] --- fim ---`);

    const estrito = parseFilesFromReply(texto);
    const tolerante = extractFilesLenient(texto);
    console.log(`[diag] parser estrito (path=): ${estrito.length} -> ${JSON.stringify(estrito.map((f) => f.path))}`);
    console.log(`[diag] parser tolerante:       ${tolerante.length} -> ${JSON.stringify(tolerante.map((f) => f.path))}`);

    expect(eventos, "nenhum evento SSE chegou").toBeGreaterThan(0);
    expect(texto.length, "stream veio vazio").toBeGreaterThan(0);
    expect(
      estrito.length + tolerante.length,
      "modelo respondeu mas nenhum parser achou arquivo",
    ).toBeGreaterThan(0);
  }, 180000);
});
