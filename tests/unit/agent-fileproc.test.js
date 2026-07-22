import { describe, it, expect, vi } from "vitest";
import { processFile } from "../../apps/agent/src/fileproc";

describe("Agent File Processing Service (apps/agent/src/fileproc.js)", () => {
  it("should process plain text base64 payload", async () => {
    const content = "Linha 1 de teste\nLinha 2 de conteúdo";
    const base64 = Buffer.from(content).toString("base64");

    const result = await processFile(base64, "text/plain", "exemplo.txt");
    expect(result).toBe(content);
  });

  it("should process JSON base64 payload", async () => {
    const jsonStr = JSON.stringify({ key: "value", number: 123 });
    const base64 = Buffer.from(jsonStr).toString("base64");

    const result = await processFile(base64, "application/json", "config.json");
    expect(result).toBe(jsonStr);
  });

  it("should return warning message for unsupported file extensions", async () => {
    const base64 = Buffer.from("dummy binary content").toString("base64");

    const result = await processFile(base64, "application/octet-stream", "arquivo.unsupported");
    expect(result).toContain("Tipo não suportado");
    expect(result).toContain("unsupported");
  });
});
