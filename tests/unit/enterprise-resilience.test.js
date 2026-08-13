import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("Suíte de Resiliência Enterprise: Cache Semântico & Fila Assíncrona SQLite", () => {
  let semanticCache;
  let queue;

  beforeEach(() => {
    semanticCache = require("../../apps/agent/src/semanticCache");
    queue = require("../../apps/agent/src/queue");
    semanticCache.clear();
  });

  describe("1. Cache Semântico de Prompts", () => {
    it("deve normalizar texto corretamente removendo acentos e pontuação", () => {
      const norm = semanticCache.normalizeText("Olá! Como funciona o 9Router???");
      expect(norm).toBe("ola como funciona o 9router");
    });

    it("deve calcular similaridade de Jaccard precisa entre n-grams", () => {
      const tokens1 = semanticCache.getTokens("como configurar o telegram no 9router");
      const tokens2 = semanticCache.getTokens("como posso configurar telegram no 9router");
      const similarity = semanticCache.calcJaccardSimilarity(tokens1, tokens2);
      expect(similarity).toBeGreaterThan(0.70);
    });

    it("deve armazenar e recuperar resposta em cache com alta similaridade (>= 0.90)", () => {
      const prompt = "qual e o comando para iniciar o servidor do agente lucas";
      const answer = "Você pode rodar `npm run agent` na raiz do projeto.";
      
      semanticCache.set(prompt, answer, "gemini-2.5-flash");

      const matchExact = semanticCache.get("qual e o comando para iniciar o servidor do agente lucas", 0.90);
      expect(matchExact).not.toBeNull();
      expect(matchExact.response).toBe(answer);
      expect(matchExact.similarity).toBe(1.0);

      const matchSimilar = semanticCache.get("qual o comando para iniciar o servidor do agente lucas", 0.85);
      expect(matchSimilar).not.toBeNull();
      expect(matchSimilar.response).toBe(answer);
      expect(matchSimilar.similarity).toBeGreaterThanOrEqual(0.85);
    });

    it("deve retornar null para prompts semanticamente distintos", () => {
      semanticCache.set("como configurar a api do whatsapp", "Use o modulo evolution api.", "gpt-4o");
      const match = semanticCache.get("qual o horario de funcionamento do suporte", 0.90);
      expect(match).toBeNull();
    });
  });

  describe("2. Fila Assíncrona de Tarefas SQLite (queue.js)", () => {
    it("deve enfileirar tarefas e atualizar estatísticas", () => {
      const jobId = queue.enqueue("test_job", { payloadData: 123 });
      expect(jobId).toBeDefined();

      const stats = queue.getStats();
      expect(stats.PENDING).toBeGreaterThanOrEqual(1);
    });

    it("deve processar tarefa enfileirada com o manipulador registrado", async () => {
      let executedPayload = null;
      queue.registerHandler("custom_action", async (payload) => {
        executedPayload = payload;
      });

      queue.enqueue("custom_action", { target: "notion_sync", count: 5 });
      const processedCount = await queue.processNextJobs(10);

      expect(processedCount).toBeGreaterThanOrEqual(1);
      expect(executedPayload).toEqual({ target: "notion_sync", count: 5 });
    });
  });
});
