// TDD — utilitários puros do CRM (extraídos da page.js para permitir testes rápidos).
import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  iconForActivity,
  safeParse,
  toDealPayload,
  validateDealPayload,
  filterContacts,
  parseTagsInput,
  STAGE_ORDER,
  STAGE_LABELS,
} from "@/lib/crm/utils.js";

describe("formatCurrency", () => {
  it("converte cents em BRL formatado pt-BR", () => {
    const s = formatCurrency(150050, "BRL");
    // O separador exato varia por locale/versão de ICU — checa presença dos elementos
    expect(s).toMatch(/1\.500,50|1,500\.50/);
    expect(s).toMatch(/R\$|BRL/);
  });

  it("aceita USD com fallback razoável", () => {
    const s = formatCurrency(9999, "USD");
    expect(s).toMatch(/99,99|99\.99/);
  });

  it("retorna traço para valor inválido", () => {
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency(undefined)).toBe("—");
    expect(formatCurrency(NaN)).toBe("—");
  });

  it("zero é formatado (não vira traço)", () => {
    const s = formatCurrency(0, "BRL");
    expect(s).toMatch(/0,00|0\.00/);
  });
});

describe("iconForActivity", () => {
  it("mapeia tipos conhecidos", () => {
    expect(iconForActivity("call")).toBe("call");
    expect(iconForActivity("email")).toBe("mail");
    expect(iconForActivity("note")).toBe("sticky_note_2");
    expect(iconForActivity("meeting")).toBe("event");
    expect(iconForActivity("task")).toBe("task");
  });

  it("fallback para 'history' em tipos desconhecidos", () => {
    expect(iconForActivity("qualquer_coisa")).toBe("history");
    expect(iconForActivity(undefined)).toBe("history");
    expect(iconForActivity("")).toBe("history");
  });
});

describe("safeParse", () => {
  it("parsa JSON válido", () => {
    expect(safeParse('{"a":1}')).toEqual({ a: 1 });
  });

  it("retorna null em JSON inválido em vez de lançar", () => {
    expect(safeParse("not json")).toBeNull();
    expect(safeParse("{ malformed")).toBeNull();
  });

  it("retorna null para vazio/undefined", () => {
    expect(safeParse(null)).toBeNull();
    expect(safeParse("")).toBeNull();
    expect(safeParse(undefined)).toBeNull();
  });

  it("passa através objetos já parseados", () => {
    expect(safeParse({ a: 1 })).toEqual({ a: 1 });
  });
});

describe("toDealPayload", () => {
  it("converte input em Reais para cents (int)", () => {
    const p = toDealPayload({ title: "X", valueCents: "1500.50", stage: "lead" });
    expect(p.valueCents).toBe(150050);
  });

  it("valor vazio vira 0", () => {
    const p = toDealPayload({ title: "X", valueCents: "" });
    expect(p.valueCents).toBe(0);
  });

  it("faz trim no título", () => {
    const p = toDealPayload({ title: "   com espaços   " });
    expect(p.title).toBe("com espaços");
  });

  it("stage default é 'lead' quando não informado", () => {
    const p = toDealPayload({ title: "X" });
    expect(p.stage).toBe("lead");
  });

  it("currency default é 'BRL'", () => {
    const p = toDealPayload({ title: "X" });
    expect(p.currency).toBe("BRL");
  });

  it("contactId vazio vira undefined (não string vazia)", () => {
    const p = toDealPayload({ title: "X", contactId: "" });
    expect(p.contactId).toBeUndefined();
  });
});

describe("validateDealPayload", () => {
  it("payload válido → sem erros", () => {
    const errs = validateDealPayload({ title: "OK", contactId: "abc", valueCents: 100, stage: "lead" });
    expect(errs).toEqual([]);
  });

  it("sem título → erro", () => {
    const errs = validateDealPayload({ contactId: "abc" });
    expect(errs.some((e) => e.includes("Título"))).toBe(true);
  });

  it("sem contato → erro por default", () => {
    const errs = validateDealPayload({ title: "X" });
    expect(errs.some((e) => e.includes("Contato"))).toBe(true);
  });

  it("com contactName mas sem contactId → sem erro", () => {
    const errs = validateDealPayload({ title: "X", contactName: "Ana" });
    expect(errs.some((e) => e.includes("Contato"))).toBe(false);
  });

  it("valor negativo → erro", () => {
    const errs = validateDealPayload({ title: "X", contactId: "abc", valueCents: -10 });
    expect(errs.some((e) => e.includes("negativo"))).toBe(true);
  });

  it("stage inválido → erro", () => {
    const errs = validateDealPayload({ title: "X", contactId: "abc", stage: "xpto" });
    expect(errs.some((e) => e.includes("Stage inválido"))).toBe(true);
  });

  it("todos os STAGE_ORDER são válidos", () => {
    for (const s of STAGE_ORDER) {
      const errs = validateDealPayload({ title: "X", contactId: "abc", stage: s });
      expect(errs).toEqual([]);
    }
  });
});

describe("filterContacts", () => {
  const contacts = [
    { id: "1", name: "Ana Souza", email: "ana@x.com", company: "Alumínio Norte" },
    { id: "2", name: "Bruno Costa", email: "bruno@y.com", company: null },
    { id: "3", name: "Carlos", email: null, company: "Empresa X" },
  ];

  it("query vazia retorna todos", () => {
    expect(filterContacts(contacts, "")).toEqual(contacts);
    expect(filterContacts(contacts, null)).toEqual(contacts);
  });

  it("filtra por nome case-insensitive", () => {
    const r = filterContacts(contacts, "ANA");
    expect(r.length).toBe(1);
    expect(r[0].name).toBe("Ana Souza");
  });

  it("filtra por email", () => {
    const r = filterContacts(contacts, "bruno@");
    expect(r.length).toBe(1);
    expect(r[0].name).toBe("Bruno Costa");
  });

  it("filtra por empresa", () => {
    const r = filterContacts(contacts, "empresa x");
    expect(r.length).toBe(1);
    expect(r[0].name).toBe("Carlos");
  });

  it("não quebra com email/company null", () => {
    expect(() => filterContacts(contacts, "z")).not.toThrow();
  });
});

describe("parseTagsInput", () => {
  it("split por vírgula, trim, remove vazios", () => {
    expect(parseTagsInput("a, b ,  c, ,d ")).toEqual(["a", "b", "c", "d"]);
  });

  it("string vazia → array vazio", () => {
    expect(parseTagsInput("")).toEqual([]);
    expect(parseTagsInput(null)).toEqual([]);
    expect(parseTagsInput(undefined)).toEqual([]);
  });
});

describe("STAGE_LABELS + STAGE_ORDER — invariantes", () => {
  it("todo stage tem label pt-BR", () => {
    for (const s of STAGE_ORDER) {
      expect(STAGE_LABELS[s]).toBeTruthy();
    }
  });

  it("ordem canônica: lead → qualified → proposal → negotiation → won → lost", () => {
    expect(STAGE_ORDER).toEqual(["lead", "qualified", "proposal", "negotiation", "won", "lost"]);
  });
});
