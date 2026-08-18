// Verifica a correção do Coder em duas partes:
//
// 1. O combo "auto", reescrito a cada boot por ensureCombos(), passa a incluir
//    os modelos kr/ (Kiro) — os únicos verificados com cota nesta conta.
// 2. Quando TODO o combo falha por falta de credencial, o handler recorre à
//    resolução dinâmica em vez de devolver 503 direto.
//
// Este ambiente local não tem providerConnections, então a geração em si não
// pode passar aqui: o que se prova é o caminho, não o resultado do modelo.

import { describe, it, expect } from "vitest";
import { ensureCombos } from "@/lib/db/seedProviders.js";
import { getCombos } from "@/lib/db/index.js";
import { getComboModels, resolveAutoModel } from "@/sse/services/model.js";
import { handleChat } from "@/sse/handlers/chat.js";
import { initTranslators } from "open-sse/translator/index.js";

describe("combo auto do Coder", () => {
  it("inclui os modelos Kiro depois do ensureCombos", async () => {
    await ensureCombos();
    const combos = await getCombos();
    const auto = combos.find((c) => c.name === "auto");
    expect(auto, 'combo "auto" não existe').toBeTruthy();

    const kr = auto.models.filter((m) => String(m).startsWith("kr/"));
    console.log(`[diag] combo auto: ${auto.models.length} modelos, ${kr.length} do Kiro`);
    console.log(`[diag] primeiros 6: ${JSON.stringify(auto.models.slice(0, 6))}`);

    expect(kr.length, "nenhum modelo kr/ no combo auto").toBeGreaterThan(0);
    // Kiro deve LIDERAR: é o único verificado com cota, e a ordem do fallback
    // é top-down. Ficar no fim significa esperar 30 falhas antes de chegar nele.
    expect(String(auto.models[0]).startsWith("kr/"), "Kiro não está no topo").toBe(true);
  });

  it("expande auto pelo caminho de combo (não como modelo único)", async () => {
    const models = await getComboModels("auto");
    expect(models, '"auto" não resolve como combo').toBeTruthy();
    expect(models.length).toBeGreaterThan(1);
  });

  it("recorre à resolução dinâmica quando o combo esgota por credencial", async () => {
    await initTranslators();

    // Sem credencial ativa neste ambiente, resolveAutoModel cai na última
    // prioridade (primeira entrada do registry) — o suficiente para provar que
    // o resgate é acionado e escolhe um alvo fora da lista do combo.
    const alvo = await resolveAutoModel();
    console.log(`[diag] resolveAutoModel -> ${alvo ? `${alvo.provider}/${alvo.model}` : "(null)"}`);

    const avisos = [];
    const origWarn = console.warn;
    // O logger do app escreve via console; capturar é o jeito de ver que o
    // resgate rodou, já que ele não altera a resposta quando também falha.
    console.warn = (...a) => { avisos.push(a.join(" ")); origWarn(...a); };

    let res;
    try {
      res = await handleChat(new Request("http://127.0.0.1:20128/api/coder/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "auto",
          stream: true,
          max_tokens: 100,
          messages: [{ role: "user", content: "diga ok" }],
        }),
      }));
    } finally {
      console.warn = origWarn;
    }

    const corpo = res.status === 200 ? "(stream)" : await res.text().catch(() => "");
    console.log(`[diag] status: ${res.status}`);
    console.log(`[diag] corpo: ${String(corpo).slice(0, 300)}`);

    const tentouKiro = avisos.some((l) => /kr\/claude/.test(l));
    const tentouResgate = avisos.some((l) => /resolu[çc][ãa]o din[âa]mica/i.test(l));
    console.log(`[diag] combo tentou modelos Kiro: ${tentouKiro}`);
    console.log(`[diag] resgate dinâmico acionado: ${tentouResgate}`);

    // O combo agora tem Kiro, então ele TEM de ser tentado.
    expect(tentouKiro, "os modelos Kiro não foram tentados pelo combo").toBe(true);
    // Sem credencial nenhuma, o resultado final segue sendo erro — o que não
    // pode acontecer é morrer sem nem tentar a resolução dinâmica.
    expect(res.status === 200 || tentouResgate, "não tentou o resgate dinâmico").toBe(true);
  }, 180000);
});
