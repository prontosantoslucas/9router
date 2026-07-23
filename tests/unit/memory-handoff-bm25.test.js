import { describe, it, expect, vi } from "vitest";
import superbrain from "../../apps/agent/src/superbrain";
import { retrieveContext } from "../../apps/agent/src/memory/contextRetriever";
const aiMemoryClient = require("../../apps/agent/src/memory/aiMemoryClient");

describe("Handoff de Sessão & Ranqueamento BM25", () => {
  it("deve ranquear blocos por pontuação BM25 com peso de bi-gramas", () => {
    const markdownData = `
# Memória do Sistema

## Tópico A: Desenvolvimento Frontend
Desenvolvimento de interfaces de usuário com React e Next.js. O desenvolvedor prefere CSS puro.

## Tópico B: Banco de Dados
Configuração de banco de dados SQLite e MySQL.

## Tópico C: Arquitetura
Arquitetura de microsserviços e gateways de inteligência artificial.
    `;

    superbrain.setContent(markdownData);

    // Busca expressão composta com bi-grama 'desenvolvimento de'
    const results = superbrain.searchMemoryInMarkdown("desenvolvimento interfaces", 3);
    expect(results).not.toHaveLength(0);
    expect(results[0].content).toContain("Desenvolvimento de interfaces");
  });

  it("deve injetar handoff da sessão anterior quando isFirstTurn for true", async () => {
    // Mock do getSessionHandoff
    const spyHandoff = vi.spyOn(aiMemoryClient, "getSessionHandoff").mockResolvedValue("Resumo da reunião anterior: aprovação do orçamento.");

    const context = await retrieveContext("Qual o status do projeto?", "chat-123", { isFirstTurn: true });

    expect(spyHandoff).toHaveBeenCalled();
    expect(context).toContain("Handoff da Sessão Anterior");
    expect(context).toContain("aprovação do orçamento");

    spyHandoff.mockRestore();
  });
});
