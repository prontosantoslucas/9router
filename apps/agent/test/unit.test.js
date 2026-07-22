import { describe, it, expect, beforeEach } from "vitest";
import cache from "../src/cache.js";
import memory from "../src/memory.js";
import { getHistory, clearHistory } from "../src/orchestrator.js";

describe("Agente Lucas - Core Internal Services", () => {
  beforeEach(() => {
    cache.clear();
  });

  describe("Cache Service", () => {
    it("should set and get values correctly", () => {
      cache.set("test", { ok: true }, 5000);
      const v = cache.get("test");
      expect(v).toEqual({ ok: true });
    });

    it("should report cache stats accurately", () => {
      cache.set("test1", { ok: true }, 5000);
      const stats = cache.stats();
      expect(stats.total).toBe(1);
      expect(stats.valid).toBe(1);
    });

    it("should clear cached entries", () => {
      cache.set("test1", { ok: true }, 5000);
      cache.clear();
      expect(cache.stats().total).toBe(0);
    });
  });

  describe("Memory Service", () => {
    it("should record corrections in memory state", async () => {
      await memory.addCorrection("teste de correção");
      const corrections = memory.getState().corrections;
      expect(corrections.length).toBeGreaterThan(0);
      expect(corrections.some((c) => c.includes("teste de correção"))).toBe(true);
    });

    it("should retrieve recent corrections", () => {
      const recent = memory.getRecentCorrections(1);
      expect(recent.length).toBe(1);
      expect(recent[0]).toContain("teste");
    });
  });

  describe("Orchestrator History", () => {
    it("should initialize user chat history", () => {
      const h = getHistory("test-user");
      expect(h).toBeDefined();
      expect(Array.isArray(h.msgs)).toBe(true);
    });

    it("should clear session history", () => {
      getHistory("test-user");
      clearHistory("test-user");
      expect(getHistory("test-user").msgs.length).toBe(0);
    });
  });
});
