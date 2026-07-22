import { describe, it, expect, vi, beforeEach } from "vitest";

const models = require("../../apps/agent/src/models");
const { getHistory, clearHistory, processMessage, isMuted, resetMuted } = require("../../apps/agent/src/orchestrator");

describe("Agent Orchestrator (apps/agent/src/orchestrator.js)", () => {
  beforeEach(() => {
    clearHistory("test-chat");
    resetMuted();

    models.setModels(["lucas", "dev", "pesquisador", "escritor", "sysadmin", "gpt-4o", "claude-3-5-sonnet"]);

    vi.stubGlobal("fetch", vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "Resposta simulada do modelo",
                role: "assistant",
              },
            },
          ],
          model: "gpt-4o",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }));
  });

  it("should initialize and manage session history", () => {
    const history = getHistory("test-session");
    expect(history).toBeDefined();
    expect(Array.isArray(history.msgs)).toBe(true);

    history.msgs.push({ role: "user", content: "oi" });
    expect(getHistory("test-session").msgs.length).toBe(1);

    clearHistory("test-session");
    expect(getHistory("test-session").msgs.length).toBe(0);
  });

  it("should process mute commands correctly", async () => {
    const result = await processMessage("test-chat", "cala a boca dev", "UserTest");
    expect(result.content).toContain("calado");
    expect(result.agent).toBe("lucas");
    expect(isMuted("dev")).toBe(true);
  });

  it("should process unmute commands correctly", async () => {
    await processMessage("test-chat", "cala a boca dev", "UserTest");
    expect(isMuted("dev")).toBe(true);

    const result = await processMessage("test-chat", "volta dev", "UserTest");
    expect(result.content).toContain("pode falar");
    expect(isMuted("dev")).toBe(false);
  });

  it("should process standard user messages through proxy completion", async () => {
    const result = await processMessage("test-chat", "Olá Lucas, tudo bem?", "UserTest");
    expect(result.content).toContain("Resposta simulada do modelo");
    expect(result.agent).toBeDefined();
  });
});
