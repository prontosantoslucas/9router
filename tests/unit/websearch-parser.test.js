import { describe, it, expect, vi } from "vitest";
const webSearch = require("../../apps/agent/src/tools/webSearch");

const { parseSearchMarkdown, decodeRedirectUrl, searchWeb, getLastFetchFailure } = webSearch;

describe("parseSearchMarkdown — extração de resultados do markdown do Jina Reader", () => {
  it("extrai resultados no formato DuckDuckGo Lite", () => {
    const md = [
      "Title: clinica odontologica curitiba at DuckDuckGo",
      "",
      "Markdown Content:",
      "1.[Clínica OdontoVida - Curitiba](https://odontovida.com.br/)",
      "Atendimento odontológico completo. WhatsApp (41) 99888-1234.",
      "",
      "2.[Sorriso Perfeito Odontologia](https://sorrisoperfeito.com.br/)",
      "Agende pelo Instagram @sorrisoperfeito.cwb",
    ].join("\n");

    const out = parseSearchMarkdown(md, 5);

    expect(out).toHaveLength(2);
    expect(out[0].title).toBe("Clínica OdontoVida - Curitiba");
    expect(out[0].url).toBe("https://odontovida.com.br/");
    expect(out[0].snippet).toContain("99888-1234");
    expect(out[1].url).toBe("https://sorrisoperfeito.com.br/");
  });

  it("extrai resultados no formato Bing e descarta links internos do buscador", () => {
    const md = [
      "1.   ## [Odonto Curitiba | Clínica Odontológica](https://odontocuritiba.com.br)",
      "Clínica odontológica no centro de Curitiba.",
      "2.   ## [Ver mais resultados](https://www.bing.com/search?q=odonto)",
    ].join("\n");

    const out = parseSearchMarkdown(md, 5);

    expect(out).toHaveLength(1);
    expect(out[0].url).toBe("https://odontocuritiba.com.br");
    expect(out.some((r) => r.url.includes("bing.com"))).toBe(false);
  });

  it("devolve vazio para página de consentimento/captcha — o caso que trava a prospecção", () => {
    const md = [
      "Title: Before you continue",
      "",
      "We use cookies and data to deliver and maintain services.",
      "Accept all",
      "Reject all",
    ].join("\n");

    expect(parseSearchMarkdown(md, 5)).toEqual([]);
  });

  it("respeita o limite pedido", () => {
    const md = Array.from({ length: 8 }, (_, i) =>
      `${i + 1}.[Clínica ${i}](https://clinica${i}.com.br/)`
    ).join("\n");

    expect(parseSearchMarkdown(md, 3)).toHaveLength(3);
  });
});

describe("decodeRedirectUrl — resolve URLs de redirecionamento", () => {
  it("decodifica redirect do DuckDuckGo", () => {
    const href = "https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexemplo.com.br%2Fcontato";
    expect(decodeRedirectUrl(href)).toBe("https://exemplo.com.br/contato");
  });

  it("devolve a URL original quando não é redirect", () => {
    expect(decodeRedirectUrl("https://clinica.com.br/")).toBe("https://clinica.com.br/");
  });

  it("não quebra com URL malformada", () => {
    expect(decodeRedirectUrl("nao-e-url")).toBe("nao-e-url");
  });
});

describe("searchWeb — contrato fail-open e instrumentação", () => {
  it("devolve [] sem lançar quando todos os engines falham, e registra o motivo", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error("ENOTFOUND r.jina.ai"); };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const out = await searchWeb("clinica odontologica curitiba", 5);

      expect(out).toEqual([]);

      // Antes da instrumentação esta saída era completamente muda — zero
      // resultados e nenhuma linha de log, impossível saber onde morreu.
      const warnMsgs = warn.mock.calls.map((c) => c.join(" ")).join("\n");
      const errorMsgs = error.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(warnMsgs).toMatch(/ddg-lite|bing|ddg-html/);
      expect(errorMsgs).toMatch(/FALHA DE INFRAESTRUTURA/);
      expect(getLastFetchFailure()).toMatch(/nenhum dos \d+ engines retornou conteúdo/i);
    } finally {
      globalThis.fetch = originalFetch;
      warn.mockRestore();
      error.mockRestore();
      log.mockRestore();
    }
  });

  it("avisa NENHUM resultado quando o markdown é recebido mas o parser não extrai links", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ content: { text: "Sem links aqui, apenas texto corrido." } })
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const out = await searchWeb("termo teste", 5);
      expect(out).toEqual([]);
      const warnMsgs = warn.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(warnMsgs).toMatch(/NENHUM resultado/);
    } finally {
      globalThis.fetch = originalFetch;
      warn.mockRestore();
      log.mockRestore();
    }
  });

  it("devolve [] para query vazia sem tocar na rede", async () => {
    const originalFetch = globalThis.fetch;
    let chamou = false;
    globalThis.fetch = async () => { chamou = true; throw new Error("não deveria"); };
    try {
      expect(await searchWeb("", 5)).toEqual([]);
      expect(chamou).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
