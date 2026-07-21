import { describe, expect, it } from "vitest";
import { OpenCodeExecutor } from "../../open-sse/executors/opencode.js";
import opencodeRegistry from "../../open-sse/providers/registry/opencode.js";

describe("OpenCode Executor and Models", () => {
  it("includes valid free models and auto in OpenCode registry", () => {
    const models = (opencodeRegistry.models || []).map((m) => m.id);
    expect(models).toContain("auto");
    expect(models).toContain("deepseek-v4-flash-free");
    expect(models).toContain("big-pickle");
    expect(models).toContain("hy3-free");
  });

  it("transforms auto model to deepseek-v4-flash-free fallback", () => {
    const executor = new OpenCodeExecutor();
    const result = executor.transformRequest("auto", { model: "auto", messages: [] });
    expect(result.model).toBe("deepseek-v4-flash-free");
  });
});
