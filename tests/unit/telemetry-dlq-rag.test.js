import { describe, it, expect } from "vitest";

describe("Pacote de Aprimoramentos — Telemetria, DLQ e RAG Semântico", () => {
  it("deve registrar e recuperar eventos de telemetria no SQLite", () => {
    const telemetry = require("../../apps/agent/src/telemetry");
    const ok = telemetry.recordTelemetryEvent({
      eventType: "llm_request",
      provider: "vitest-provider",
      model: "vitest-model-v1",
      tokensIn: 500,
      tokensOut: 120,
      tokensSaved: 180,
      latencyMs: 320,
      status: "success",
      filterApplied: "git-diff"
    });
    expect(ok).toBe(true);

    const stats = telemetry.getTelemetryStats();
    expect(stats.totals).toBeDefined();
    expect(stats.totals.total_requests).toBeGreaterThan(0);
  });

  it("deve enfileirar e consultar status da Dead-Letter Queue (DLQ)", () => {
    const dlq = require("../../apps/agent/src/channels/dlqQueue");
    const id = dlq.enqueueFailedMessage(
      "whatsapp",
      "5511999999999",
      { text: "Mensagem de teste unitário" },
      "Timeout de conexão"
    );
    expect(id).toBeDefined();
    expect(typeof id).toBe("number");

    const stats = dlq.getDlqStats();
    expect(stats.total_events).toBeGreaterThan(0);
    expect(stats.pending_count).toBeGreaterThan(0);
  });

  it("deve tokenizar e calcular similaridade semântica no RAG local", () => {
    const vectorMemory = require("../../apps/agent/src/memory/vectorMemory");
    const tokens = vectorMemory.tokenize("Configuração de deploy no Railway e Next.js");
    expect(tokens).toContain("configuracao");
    expect(tokens).toContain("railway");

    const scoreHigh = vectorMemory.computeSemanticSimilarity(
      tokens,
      "Manual de deploy no Railway com servidor Next.js standalone"
    );
    const scoreLow = vectorMemory.computeSemanticSimilarity(
      tokens,
      "Receita de bolo de cenoura com chocolate"
    );

    expect(scoreHigh).toBeGreaterThan(scoreLow);
  });
});
