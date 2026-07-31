import { describe, it, expect } from "vitest";
import { validateSchema, chatSchema, moduleToggleSchema } from "../../apps/agent/src/schemas.js";
import rag from "../../apps/agent/src/rag/index.js";

describe("Schemas & Validation", () => {
  it("valida requisição de chat válida", () => {
    const res = validateSchema(chatSchema, { message: "Olá Lucas!", chatId: "web:123" });
    expect(res.valid).toBe(true);
    expect(res.errors.length).toEqual(0);
  });

  it("rejeita requisições com tipo incorreto de dados", () => {
    const res = validateSchema(chatSchema, { images: "não-é-um-array" });
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain("deve ser uma lista");
  });

  it("exige a chave no modelo de toggle", () => {
    const res = validateSchema(moduleToggleSchema, {});
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain("Campo obrigatório ausente: 'key'");
  });
});

describe("Módulo RAG de Documentos", () => {
  it("adiciona e divide documento em chunks no SQLite", () => {
    const text = "O 9Router é um roteador inteligente de IA. Ele suporta WhatsApp, Telegram e Notion.";
    const result = rag.addDocument("manual.txt", text);
    expect(result.ok).toBe(true);
    expect(result.chunksCount).toBeGreaterThan(0);
  });

  it("lista documentos salvos na base", () => {
    const docs = rag.listDocuments();
    expect(Array.isArray(docs)).toBe(true);
    expect(docs.some(d => d.filename === "manual.txt")).toBe(true);
  });

  it("realiza busca semântica por palavras-chave", () => {
    const results = rag.searchDocuments("WhatsApp");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain("WhatsApp");
  });

  it("remove documento da base", () => {
    const result = rag.deleteDocument("manual.txt");
    expect(result.ok).toBe(true);
    const docs = rag.listDocuments();
    expect(docs.some(d => d.filename === "manual.txt")).toBe(false);
  });
});
