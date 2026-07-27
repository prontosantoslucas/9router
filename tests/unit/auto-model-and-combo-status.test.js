import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/localDb", () => ({
  getModelAliases: vi.fn().mockResolvedValue({}),
  getComboByName: vi.fn().mockResolvedValue(null),
  getProviderNodes: vi.fn().mockResolvedValue([]),
  getProviderConnections: vi.fn().mockResolvedValue([
    { provider: "groq", isActive: true, defaultModel: "llama-3.3-70b-versatile" },
  ]),
}));

import { handleComboChat } from "../../open-sse/services/combo.js";
import { getModelInfo } from "../../src/sse/services/model.js";

describe("combo status code and fallback messaging", () => {
  it("should return 503 status code when lastError contains 'No active credentials'", async () => {
    const mockLog = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const mockHandleSingleModel = vi.fn().mockImplementation(async (body, modelStr) => {
      return new Response(
        JSON.stringify({ error: { message: `No active credentials for provider: ${modelStr.split("/")[0]}` } }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    });

    const result = await handleComboChat({
      body: { model: "auto", messages: [{ role: "user", content: "hi" }] },
      models: ["groq/llama-3.3-70b-versatile"],
      handleSingleModel: mockHandleSingleModel,
      log: mockLog,
      comboName: "auto",
    });

    expect(result.status).toBe(503);
    const body = await result.json();
    expect(body.error.message).toContain("No active credentials for provider: groq");
  });
});

describe("resolveAutoModel fallback to providerConnections", () => {
  it("should prioritize active providerConnections over blind registry when no auto combo exists", async () => {
    const result = await getModelInfo("auto");

    expect(result).toEqual({
      provider: "groq",
      model: "llama-3.3-70b-versatile",
    });
  });
});
