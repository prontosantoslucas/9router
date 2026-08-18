import { describe, it, expect, beforeEach, afterEach } from "vitest";
const prospector = require("../../apps/agent/src/prospector");

describe("Prospector Zenda B2B Client Engine (apps/agent/src/prospector.js)", () => {
  it("should retrieve default settings and update them for Zenda", () => {
    const s = prospector.getSettings();
    expect(s).toBeDefined();
    expect(s.enabled).toBe(1);

    const updated = prospector.updateSettings({
      target_keywords: "Clínica Odontológica, Clínica Estética",
      product_name: "Zenda AI"
    });
    expect(updated.target_keywords).toBe("Clínica Odontológica, Clínica Estética");
  });

  it("should upsert clinic and business leads with strict deduplication", () => {
    const uniqueName = "Clínica Sorriso_" + Date.now();
    const leadData = {
      name: uniqueName,
      category: "Odontologia",
      city: "São Paulo - SP",
      phone: "5511988887777",
      instagram_handle: "clinicasorriso.sp"
    };

    const first = prospector.upsertLead(leadData);
    expect(first.isNew).toBe(true);
    expect(first.lead.name).toBe(uniqueName);

    const duplicate = prospector.upsertLead(leadData);
    expect(duplicate.isNew).toBe(false);
    expect(duplicate.lead.id).toBe(first.lead.id);
  });

  // A asserção anterior exigia que a mensagem citasse "Zenda"/"Inteligência
  // Artificial" — ou seja, travava o comportamento que causava mensagem
  // ignorada: produto antes de dor. O contrato agora é o oposto.
  it("primeiro contato: toca dor, faz pergunta aberta e NÃO fala de produto", async () => {
    const lead = {
      name: "Centro Odontológico Moema",
      category: "Odontologia",
      city: "São Paulo",
      source: "web"
    };
    const msg = await prospector.generateOutreachMessage(lead, "whatsapp");
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(20);
    expect(msg.length).toBeLessThanOrEqual(520); // margem sobre o limite do canal

    // Termina puxando resposta, não pedindo aceite de sim/não.
    expect(msg).toMatch(/\?/);

    // Nada de produto/tecnologia no toque 1.
    expect(msg).not.toMatch(/\b(Zenda|intelig[êe]ncia artificial|IA|automa[çc][ãa]o|Google Calendar|integra[çc][ãa]o)\b/i);

    // Nada de pedir reunião nem assinatura de e-mail.
    expect(msg).not.toMatch(/(demonstra[çc][ãa]o|5 minutos|cinco minutos|agendar uma call|reuni[ãa]o)/i);
    expect(msg).not.toMatch(/(atenciosamente|abra[çc]os|equipe zenda)/i);

    // Elogio genérico é o que faz a mensagem parecer template.
    expect(msg).not.toMatch(/(trabalho de excel[êe]ncia|parab[ée]ns pelo|refer[êe]ncia na regi[ãa]o)/i);
  }, 15000);

  it("Instagram respeita o limite do canal e mantém a pergunta", async () => {
    const lead = { name: "Clínica Estética&Luxo", category: "Clínica de Estética", city: "Rio de Janeiro", source: "web" };
    const msg = await prospector.generateOutreachMessage(lead, "instagram");
    expect(msg.length).toBeLessThanOrEqual(360); // margem sobre 280
    expect(msg).toMatch(/\?/);
    expect(msg).not.toMatch(/https?:\/\//); // sem link no primeiro toque
  }, 15000);

  it("should return system stats and lead listing", () => {
    const stats = prospector.getStats();
    expect(stats.totalLeads).toBeGreaterThanOrEqual(1);
    const list = prospector.listLeads(5);
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
  });
});

describe("researchMarketAvatar — falha tem que parecer falha", () => {
  // `prospector.js` guarda a REFERÊNCIA do módulo (`const proxy = require(...)`),
  // então trocar o método no objeto cacheado do Node força o caminho de erro
  // sem rede e sem esperar timeout real.
  const proxy = require("../../apps/agent/src/proxy");
  const webSearch = require("../../apps/agent/src/tools/webSearch");
  const db = require("../../apps/agent/src/db");

  const countResearch = () =>
    db.prepare("SELECT COUNT(*) as n FROM prospector_market_research").get().n;

  let originalComplete;
  let originalSearch;

  beforeEach(() => {
    originalComplete = proxy.complete;
    originalSearch = webSearch.searchWeb;
    // A busca web já é fail-open; neutralizada aqui para o teste não depender de rede.
    webSearch.searchWeb = async () => [];
  });

  afterEach(() => {
    proxy.complete = originalComplete;
    webSearch.searchWeb = originalSearch;
  });

  it("não inventa dossiê quando todos os modelos falham", async () => {
    proxy.complete = async () => { throw new Error("todos os modelos indisponíveis"); };
    const before = countResearch();

    const res = await prospector.researchMarketAvatar("Clínicas Odontológicas");

    expect(res.ok).toBe(false);
    expect(res.dossier).toBeNull();
    expect(res.error).toContain("todos os modelos indisponíveis");

    // O fallback antigo devolvia estas frases fixas disfarçadas de pesquisa.
    expect(JSON.stringify(res)).not.toMatch(/Proposta de Valor|\*\*ICP:\*\*|Dossiê de Avatar para/);

    // E nada pode ser gravado como se fosse inteligência de mercado.
    expect(countResearch()).toBe(before);
  });

  it("trata dossiê vazio como falha, não como sucesso", async () => {
    proxy.complete = async () => ({ content: "   " });
    const before = countResearch();

    const res = await prospector.researchMarketAvatar("Clínicas Estéticas");

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/vazio/i);
    expect(countResearch()).toBe(before);
  });

  it("grava pesquisa real sem preencher colunas com texto fixo", async () => {
    proxy.complete = async () => ({ content: "# Dossiê real\n\nTomador de decisão: dono da clínica." });
    const before = countResearch();

    const res = await prospector.researchMarketAvatar("Fisioterapia");

    expect(res.ok).toBe(true);
    expect(res.dossier).toContain("Dossiê real");
    expect(countResearch()).toBe(before + 1);

    const row = db.prepare(
      "SELECT pain_points, objections, hooks, full_dossier FROM prospector_market_research ORDER BY id DESC LIMIT 1"
    ).get();
    expect(row.full_dossier).toContain("Dossiê real");
    // Antes eram três frases hardcoded, idênticas para qualquer nicho.
    expect(row.pain_points).toBe("");
    expect(row.objections).toBe("");
    expect(row.hooks).toBe("");
  });
});

describe("resetProspection — recomeçar as buscas do zero", () => {
  it("remove todos os leads e abordagens e reporta o que apagou", () => {
    prospector.upsertLead({
      name: "Clínica Para Reset_" + Date.now(),
      category: "Odontologia",
      city: "Curitiba - PR",
      phone: "5541998881234",
    });
    expect(prospector.getStats().totalLeads).toBeGreaterThanOrEqual(1);

    const res = prospector.resetProspection();
    expect(res.leads).toBeGreaterThanOrEqual(1);
    expect(typeof res.outreach).toBe("number");

    const stats = prospector.getStats();
    expect(stats.totalLeads).toBe(0);
    expect(stats.sentOutreach).toBe(0);
    expect(stats.draftedOutreach).toBe(0);
    expect(prospector.listLeads(10)).toEqual([]);
  });

  it("preserva o histórico de pesquisas de mercado por padrão", () => {
    const res = prospector.resetProspection();
    expect(res.research).toBe(0);
  });
});

describe("extractContactsFromText — nunca fabricar número de terceiro", () => {
  const extract = (t) => prospector.extractContactsFromText(t);

  // ── Casos que ANTES viravam telefone inventado ───────────────────────────
  // O código antigo assumia DDD "11" quando não achava um, e forçava o "9"
  // de celular. Qualquer par de 4 dígitos com separador virava um WhatsApp
  // válido de um estranho em São Paulo.

  it("não transforma intervalo de anos em telefone", () => {
    expect(extract("Atendimento 2024-2025").phone).toBeNull();
  });

  it("não transforma faixa de preço em telefone", () => {
    expect(extract("Implante de R$ 1500-2000 à vista").phone).toBeNull();
  });

  it("não inventa DDD quando o texto não tem um", () => {
    expect(extract("Ligue 3333-4444").phone).toBeNull();
  });

  it("rejeita DDD inexistente no plano de numeração brasileiro", () => {
    // 20, 23, 26, 30, 39, 52, 80 e 90 não são DDDs atribuídos.
    expect(extract("(20) 98888-7777").phone).toBeNull();
    expect(extract("(90) 98888-7777").phone).toBeNull();
  });

  it("não casa dígitos dentro de CNPJ ou CEP", () => {
    expect(extract("CNPJ 12.345.678/0001-99").phone).toBeNull();
    expect(extract("CEP 01310-100, São Paulo").phone).toBeNull();
  });

  it("rejeita fixo de 8 dígitos em vez de forjar um celular", () => {
    // O código antigo virava "11 3333-4444" em 5511933334444 — número de outra pessoa.
    expect(extract("Recepção (11) 3333-4444").phone).toBeNull();
  });

  // ── Casos legítimos que precisam continuar funcionando ───────────────────

  it("extrai celular formatado com DDD entre parênteses", () => {
    expect(extract("WhatsApp (11) 98888-7777").phone).toBe("5511988887777");
  });

  it("extrai celular já normalizado com prefixo 55", () => {
    expect(extract("Contato: 5521987654321").phone).toBe("5521987654321");
  });

  it("extrai celular com +55 e espaços", () => {
    expect(extract("Fale conosco: +55 31 99123-4567").phone).toBe("5531991234567");
  });

  it("acha o celular válido mesmo com ruído numérico antes", () => {
    expect(extract("Desde 1998, CEP 01310-100 — WhatsApp (41) 99888-1234").phone)
      .toBe("5541998881234");
  });

  // ── Instagram (comportamento preservado) ─────────────────────────────────

  it("extrai handle do Instagram", () => {
    expect(extract("Siga @clinicasorriso.sp").instagram).toBe("clinicasorriso.sp");
    expect(extract("instagram.com/OdontoPrime").instagram).toBe("odontoprime");
  });

  it("ignora caminhos reservados do Instagram", () => {
    expect(extract("instagram.com/p/Cx123abc").instagram).toBeNull();
    expect(extract("instagram.com/reel/abc123").instagram).toBeNull();
  });
});
