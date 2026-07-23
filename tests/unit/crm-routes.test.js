// TDD — comportamento das rotas /api/crm/*.
// Handlers do App Router são funções puras que recebem `Request` e devolvem
// `NextResponse`. Instanciamos requests fake e chamamos direto — sem servidor.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let contactsRoute;
let dealsRoute;
let activitiesRoute;
let crmRepo;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-crm-routes-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  const db = await import("@/lib/db/index.js");
  await db.initDb();
  crmRepo = await import("@/lib/crm/crmRepo.js");
  contactsRoute = await import("@/app/api/crm/contacts/route.js");
  dealsRoute = await import("@/app/api/crm/deals/route.js");
  activitiesRoute = await import("@/app/api/crm/activities/route.js");
});

afterAll(() => {
  if (tempDir) {
    try { fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3 }); } catch {}
  }
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

function makeRequest(url, init = {}) {
  return new Request(url, init);
}

async function jsonOf(res) {
  return res.json();
}

describe("GET /api/crm/contacts", () => {
  it("lista contatos (array vazio em DB fresh — sem 500)", async () => {
    const res = await contactsRoute.GET(makeRequest("http://localhost/api/crm/contacts"));
    expect(res.status).toBe(200);
    const data = await jsonOf(res);
    expect(Array.isArray(data.contacts)).toBe(true);
  });

  it("busca por email usa getContactByEmail (não getContact)", async () => {
    // Cria contato via repo pra ter algo pra buscar
    await crmRepo.upsertContact({ name: "Route Test", email: "route@example.com" });
    const res = await contactsRoute.GET(
      makeRequest("http://localhost/api/crm/contacts?email=route@example.com")
    );
    expect(res.status).toBe(200);
    const data = await jsonOf(res);
    expect(data.contact).not.toBeNull();
    expect(data.contact?.email).toBe("route@example.com");
  });

  it("busca por email inexistente retorna contact:null (não 500)", async () => {
    const res = await contactsRoute.GET(
      makeRequest("http://localhost/api/crm/contacts?email=ninguem@example.com")
    );
    expect(res.status).toBe(200);
    const data = await jsonOf(res);
    expect(data.contact).toBeNull();
  });
});

describe("POST /api/crm/contacts", () => {
  it("cria novo contato — 201 com id gerado", async () => {
    const res = await contactsRoute.POST(makeRequest("http://localhost/api/crm/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Novo POST", email: "post@example.com" }),
    }));
    expect(res.status).toBe(201);
    const data = await jsonOf(res);
    expect(data.contact?.id).toBeTruthy();
    expect(data.contact?.name).toBe("Novo POST");
  });

  it("upsert por email — segunda chamada com mesmo email não duplica", async () => {
    const first = await contactsRoute.POST(makeRequest("http://localhost/api/crm/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Idem 1", email: "idem@example.com" }),
    }));
    const firstData = await jsonOf(first);

    const second = await contactsRoute.POST(makeRequest("http://localhost/api/crm/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Idem 2", email: "idem@example.com" }),
    }));
    const secondData = await jsonOf(second);

    expect(secondData.contact.id).toBe(firstData.contact.id);
    expect(secondData.contact.name).toBe("Idem 2");
  });
});

describe("GET /api/crm/deals — modo summary", () => {
  it("?summary=1 retorna deals + summary + stages simultaneamente (bug fix)", async () => {
    // Cria contato + deal
    const c = await crmRepo.upsertContact({ name: "Deal Owner", email: "dealowner@example.com" });
    await crmRepo.createDeal({ contactId: c.id, title: "Deal Summary Test", valueCents: 15000, stage: "lead" });

    const res = await dealsRoute.GET(makeRequest("http://localhost/api/crm/deals?summary=1"));
    expect(res.status).toBe(200);
    const data = await jsonOf(res);

    // ESSE É O BUG FIX: precisa ter `deals` no payload quando summary=1
    expect(Array.isArray(data.deals)).toBe(true);
    expect(data.deals.length).toBeGreaterThanOrEqual(1);
    expect(data.deals[0].contactName).toBeTruthy(); // JOIN funciona

    expect(data.summary?.stages).toBeDefined();
    expect(Array.isArray(data.stages)).toBe(true);
    expect(data.stages).toEqual(["lead", "qualified", "proposal", "negotiation", "won", "lost"]);
  });

  it("sem summary retorna só deals", async () => {
    const res = await dealsRoute.GET(makeRequest("http://localhost/api/crm/deals"));
    expect(res.status).toBe(200);
    const data = await jsonOf(res);
    expect(Array.isArray(data.deals)).toBe(true);
    expect(data.summary).toBeUndefined();
  });
});

describe("POST /api/crm/deals", () => {
  it("cria deal — 201", async () => {
    const c = await crmRepo.upsertContact({ name: "POST Deal", email: "postdeal@example.com" });
    const res = await dealsRoute.POST(makeRequest("http://localhost/api/crm/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: c.id, title: "POST Deal 1", valueCents: 5000, stage: "lead" }),
    }));
    expect(res.status).toBe(201);
    const data = await jsonOf(res);
    expect(data.deal?.id).toBeTruthy();
    expect(data.deal?.stage).toBe("lead");
  });
});

describe("PATCH /api/crm/deals — mover stage", () => {
  it("PATCH com ?id + body { stage } move o deal", async () => {
    const c = await crmRepo.upsertContact({ name: "Mover", email: "mover@example.com" });
    const d = await crmRepo.createDeal({ contactId: c.id, title: "Move Me", valueCents: 100, stage: "lead" });

    const res = await dealsRoute.PATCH(makeRequest(`http://localhost/api/crm/deals?id=${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: "qualified" }),
    }));
    expect(res.status).toBe(200);
    const data = await jsonOf(res);
    expect(data.deal?.stage).toBe("qualified");
  });

  it("PATCH sem id → 400", async () => {
    const res = await dealsRoute.PATCH(makeRequest(`http://localhost/api/crm/deals`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: "won" }),
    }));
    expect(res.status).toBe(400);
  });

  it("PATCH sem stage no body → 400", async () => {
    const res = await dealsRoute.PATCH(makeRequest(`http://localhost/api/crm/deals?id=fake-id`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/crm/activities", () => {
  it("lista atividades — array (vazio ou não)", async () => {
    const res = await activitiesRoute.GET(makeRequest("http://localhost/api/crm/activities"));
    expect(res.status).toBe(200);
    const data = await jsonOf(res);
    expect(Array.isArray(data.activities)).toBe(true);
  });
});
