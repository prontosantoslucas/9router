import { describe, it, expect } from "vitest";
import superbrain from "../../apps/agent/src/superbrain";
import aiMemoryClient from "../../apps/agent/src/memory/aiMemoryClient";

describe("GitHub-backed ai-memory (nortelucas/meueulucas)", () => {
  it("deve buscar trechos relevantes no Markdown do Superbrain", () => {
    // Seta um conteúdo fictício de teste
    const testMarkdown = `# Superbrain Lucas\n\n## Preferências\nO usuário prefere respostas em português e é desenvolvedor de software.\n\n## Fatos\nO projeto 9router é um gateway de inteligência artificial multilaboratório.`;
    superbrain.setContent(testMarkdown);
    
    // Testa busca por palavra-chave 'desenvolvedor'
    const queryResult = superbrain.searchMemoryInMarkdown("desenvolvedor", 3);
    expect(queryResult).toHaveLength(1);
    expect(queryResult[0].content).toContain("desenvolvedor de software");
  });

  it("deve retornar status do ai-memory em modo GitHub quando MCP não estiver ativo", async () => {
    const pingStatus = await aiMemoryClient.ping();
    expect(pingStatus.configured).toBe(true);
    expect(pingStatus.reachable).toBe(true);
    expect(pingStatus.mode).toBe("github");
    expect(pingStatus.repo).toBe("nortelucas/meueulucas");
    expect(pingStatus.file).toBe("Superbrain-Lucas.md");
  });
});
