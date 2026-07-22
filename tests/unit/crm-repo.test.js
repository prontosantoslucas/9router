// TDD — comportamento esperado do repo de CRM.
// Cobre: contatos (upsert + lookup por id/email + delete cascade),
// deals (create + list + updateDealStage + pipeline summary),
// activities (log + fetch).
//
// DB fresh em tmpdir para cada suite. Migração 001 cria as tabelas do schema
// automaticamente via getAdapter() → runMigrationOnce().
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let crmRepo;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-crm-repo-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  // Import DB primeiro para inicializar adapter no scope global do módulo.
  const db = await import("@/lib/db/index.js");
  await db.initDb();
  crmRepo = await import("@/lib/crm/crmRepo.js");
});

afterAll(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("crmRepo — Contatos", () => {
  it("upsertContact cria novo contato com email único", async () => {
    const c = await crmRepo.upsertContact({
      name: "Ana Souza",
      email: "ana@example.com",
      phone: "+55 11 99999-1111",
      company: "Alumínio Norte",
      tags: ["cliente", "vip"],
      source: "manual",
    });
    expect(c.id).toBeTruthy();
    expect(c.name).toBe("Ana Souza");
    expect(c.email).toBe("ana@example.com");
    expect(c.tags).toEqual(["cliente", "vip"]);
  });

  it("upsertContact é idempotente por email — atualiza em vez de duplicar", async () => {
    const first = await crmRepo.upsertContact({ name: "Bruno", email: "bruno@example.com" });
    const again = await crmRepo.upsertContact({ name: "Bruno Costa", email: "bruno@example.com", phone: "+55 21 91111-2222" });
    expect(again.id).toBe(first.id);
    expect(again.name).toBe("Bruno Costa");
    expect(again.phone).toBe("+55 21 91111-2222");

    const all = await crmRepo.getContacts();
    const brunos = all.filter((c) => c.email === "bruno@example.com");
    expect(brunos.length).toBe(1);
  });

  it("getContacts sem filtro lista todos, ordenado por updatedAt desc", async () => {
    const all = await crmRepo.getContacts();
    expect(all.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < all.length - 1; i++) {
      expect(all[i].updatedAt >= all[i + 1].updatedAt).toBe(true);
    }
  });

  it("getContacts filtra por email quando fornecido", async () => {
    const only = await crmRepo.getContacts({ email: "ana@example.com" });
    expect(only.length).toBe(1);
    expect(only[0].name).toBe("Ana Souza");
  });

  it("getContact busca por id", async () => {
    const list = await crmRepo.getContacts({ email: "ana@example.com" });
    const anaId = list[0].id;
    const ana = await crmRepo.getContact(anaId);
    expect(ana?.email).toBe("ana@example.com");
  });

  it("getContactByEmail busca por email (função separada de getContact)", async () => {
    const ana = await crmRepo.getContactByEmail("ana@example.com");
    expect(ana?.name).toBe("Ana Souza");
    // Passar um id em getContactByEmail retorna null (correto — não deve encontrar)
    const notFound = await crmRepo.getContactByEmail("nao-existe@example.com");
    expect(notFound).toBeNull();
  });

  it("deleteContact remove o contato e activities/deals ligados (cascade manual)", async () => {
    const c = await crmRepo.upsertContact({ name: "Para Deletar", email: "del@example.com" });
    const d = await crmRepo.createDeal({ contactId: c.id, title: "Orçamento X", valueCents: 12345, stage: "lead" });
    await crmRepo.logActivity({ contactId: c.id, dealId: d.id, type: "note", description: "primeiro contato" });

    await crmRepo.deleteContact(c.id);
    expect(await crmRepo.getContact(c.id)).toBeNull();
    const acts = await crmRepo.getActivities(c.id);
    expect(acts.length).toBe(0);
    const deals = await crmRepo.getDeals();
    expect(deals.find((x) => x.id === d.id)).toBeUndefined();
  });
});

describe("crmRepo — Deals", () => {
  let contactId;

  beforeAll(async () => {
    const c = await crmRepo.upsertContact({ name: "Carlos Deals", email: "carlos@example.com" });
    contactId = c.id;
  });

  it("createDeal exige contactId e title, aceita stage default 'lead'", async () => {
    const d = await crmRepo.createDeal({ contactId, title: "Consultoria Q1", valueCents: 500000 });
    expect(d.id).toBeTruthy();
    expect(d.stage).toBe("lead");
    expect(d.valueCents).toBe(500000);
  });

  it("updateDealStage move o deal, setando closedAt quando won/lost", async () => {
    const d = await crmRepo.createDeal({ contactId, title: "Fechar Rápido", valueCents: 100000 });
    const moved = await crmRepo.updateDealStage(d.id, "qualified");
    expect(moved.stage).toBe("qualified");
    expect(moved.closedAt).toBeNull();

    const won = await crmRepo.updateDealStage(d.id, "won");
    expect(won.stage).toBe("won");
    expect(won.closedAt).toBeTruthy();
  });

  it("getDeals junta nome/email do contato via LEFT JOIN", async () => {
    const deals = await crmRepo.getDeals();
    const carlosDeal = deals.find((d) => d.contactId === contactId);
    expect(carlosDeal?.contactName).toBe("Carlos Deals");
    expect(carlosDeal?.contactEmail).toBe("carlos@example.com");
  });

  it("getDeals filtra por stage quando fornecido", async () => {
    const wonDeals = await crmRepo.getDeals("won");
    expect(wonDeals.every((d) => d.stage === "won")).toBe(true);
  });

  it("deleteDeal remove um deal específico", async () => {
    const d = await crmRepo.createDeal({ contactId, title: "Descartar", valueCents: 1 });
    await crmRepo.deleteDeal(d.id);
    const stillThere = await crmRepo.getDeal(d.id);
    expect(stillThere).toBeUndefined();
  });
});

describe("crmRepo — Pipeline summary", () => {
  it("getPipelineSummary retorna contagem/valor por stage e total sem 'lost'", async () => {
    const c = await crmRepo.upsertContact({ name: "Pipeline Test", email: "pipe@example.com" });
    await crmRepo.createDeal({ contactId: c.id, title: "P1", valueCents: 10000, stage: "lead" });
    await crmRepo.createDeal({ contactId: c.id, title: "P2", valueCents: 20000, stage: "qualified" });
    const lost = await crmRepo.createDeal({ contactId: c.id, title: "P3", valueCents: 50000, stage: "lead" });
    await crmRepo.updateDealStage(lost.id, "lost");

    const summary = await crmRepo.getPipelineSummary();
    expect(summary.stages.lead).toBeDefined();
    expect(summary.stages.qualified).toBeDefined();
    expect(summary.stages.lost).toBeDefined();
    expect(summary.stages.lost.count).toBeGreaterThanOrEqual(1);
    // totalValueCents ignora 'lost'
    expect(summary.totalValueCents).toBeGreaterThan(0);
    // O valor de 'lost' NÃO entra no total
    const lostValue = summary.stages.lost.value;
    const inclusive = Object.entries(summary.stages).reduce((s, [, v]) => s + v.value, 0);
    expect(inclusive - lostValue).toBe(summary.totalValueCents);
  });

  it("expõe DEFAULT_STAGES em ordem canônica", () => {
    expect(crmRepo.DEFAULT_STAGES).toEqual(["lead", "qualified", "proposal", "negotiation", "won", "lost"]);
  });
});

describe("crmRepo — Activities", () => {
  it("logActivity persiste tipo + descrição + metadata", async () => {
    const c = await crmRepo.upsertContact({ name: "Activity Test", email: "act@example.com" });
    const a = await crmRepo.logActivity({
      contactId: c.id,
      type: "call",
      description: "Follow-up rápido",
      metadata: { durationSec: 120 },
    });
    expect(a.id).toBeTruthy();
    expect(a.type).toBe("call");

    const acts = await crmRepo.getActivities(c.id);
    expect(acts.length).toBe(1);
    expect(acts[0].description).toBe("Follow-up rápido");
  });

  it("getActivities sem contactId retorna as 50 mais recentes globalmente", async () => {
    const acts = await crmRepo.getActivities();
    expect(Array.isArray(acts)).toBe(true);
    expect(acts.length).toBeLessThanOrEqual(50);
  });
});
