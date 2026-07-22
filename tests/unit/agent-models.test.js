import { describe, it, expect, beforeEach } from "vitest";
import models from "../../apps/agent/src/models";

describe("Agent Models & Quota Manager (apps/agent/src/models.js)", () => {
  beforeEach(() => {
    models.setModels([
      { id: "gpt-4o", capabilities: { vision: true, reasoning: false } },
      { id: "claude-3-5-sonnet", capabilities: { vision: true, reasoning: true } },
      { id: "deepseek-reasoner", capabilities: { vision: false, reasoning: true } },
    ]);
  });

  it("should fetch models and update available list", () => {
    const status = models.getStatus();
    expect(status.loaded).toBe(true);
    expect(status.total).toBe(3);
  });

  it("should block model when marked exhausted and calculate retry timer", () => {
    models.markExhausted("gpt-4o");
    const status = models.getStatus();

    expect(status.blocked.some((b) => b.modelId === "gpt-4o")).toBe(true);
    const priorityList = models.getPriorityList();
    expect(priorityList).not.toContain("gpt-4o");
  });

  it("should filter priority list by capabilities", () => {
    const visionModels = models.getPriorityList({ vision: true });
    expect(visionModels).toContain("gpt-4o");
    expect(visionModels).toContain("claude-3-5-sonnet");
    expect(visionModels).not.toContain("deepseek-reasoner");
  });
});
