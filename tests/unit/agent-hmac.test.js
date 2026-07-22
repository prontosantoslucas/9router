// TDD — middleware HMAC do agente Lucas.
// Testa a função pura verifyHmacHeader + buildHmacHeader (round-trip).
import { describe, it, expect } from "vitest";
import {
  verifyHmacHeader,
  buildHmacHeader,
  createHmacMiddleware,
  HEADER,
  WINDOW_MS,
} from "../../apps/agent/src/hmacAuth.js";

const SECRET = "test-secret-do-not-use-in-prod";

describe("verifyHmacHeader — casos válidos", () => {
  it("aceita header assinado com o mesmo segredo dentro da janela", () => {
    const header = buildHmacHeader(SECRET);
    const result = verifyHmacHeader(header, SECRET);
    expect(result.ok).toBe(true);
  });

  it("aceita header com timestamp de 10s atrás", () => {
    const ts = Date.now() - 10 * 1000;
    const header = buildHmacHeader(SECRET, ts);
    const result = verifyHmacHeader(header, SECRET);
    expect(result.ok).toBe(true);
  });
});

describe("verifyHmacHeader — casos inválidos", () => {
  it("recusa se segredo do servidor estiver ausente", () => {
    const header = buildHmacHeader(SECRET);
    const result = verifyHmacHeader(header, "");
    expect(result).toEqual({ ok: false, reason: "server_secret_missing" });
  });

  it("recusa quando header está ausente", () => {
    const result = verifyHmacHeader(null, SECRET);
    expect(result).toEqual({ ok: false, reason: "header_missing" });
  });

  it("recusa header sem ':'", () => {
    const result = verifyHmacHeader("sem_separador", SECRET);
    expect(result.reason).toBe("header_malformed");
  });

  it("recusa timestamp não-numérico", () => {
    const result = verifyHmacHeader("abc:aaaa", SECRET);
    expect(result.reason).toBe("bad_timestamp");
  });

  it("recusa timestamp fora da janela (60s)", () => {
    const ts = Date.now() - 60 * 1000;
    const header = buildHmacHeader(SECRET, ts);
    const result = verifyHmacHeader(header, SECRET);
    expect(result.reason).toBe("expired");
  });

  it("recusa quando segredo cliente ≠ segredo servidor", () => {
    const header = buildHmacHeader("outro-segredo");
    const result = verifyHmacHeader(header, SECRET);
    expect(result.reason).toBe("hmac_mismatch");
  });

  it("recusa HMAC hex inválido (comprimento errado)", () => {
    const header = `${Date.now()}:xy`;
    const result = verifyHmacHeader(header, SECRET);
    // Buffer.from("xy", "hex") vira vazio → length_mismatch
    expect(["length_mismatch", "invalid_hex"]).toContain(result.reason);
  });
});

describe("WINDOW_MS", () => {
  it("é 30 segundos — proteção contra replay razoável", () => {
    expect(WINDOW_MS).toBe(30 * 1000);
  });
});

describe("HEADER constant", () => {
  it("é 'x-9r-agent-auth' (case-insensitive no Node http)", () => {
    expect(HEADER).toBe("x-9r-agent-auth");
  });
});

describe("createHmacMiddleware — bypass e falha", () => {
  function callMiddleware(mw, req) {
    return new Promise((resolve) => {
      const res = {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; resolve({ statusCode: this.statusCode, body: this.body }); },
      };
      let called = false;
      mw(req, res, () => {
        called = true;
        resolve({ statusCode: 200, body: null, nextCalled: true });
      });
      // Se next não foi chamado sincronamente, esperamos res.json ser chamado
      if (!called) setTimeout(() => {}, 0);
    });
  }

  it("passa direto quando path está em skipPrefixes", async () => {
    const mw = createHmacMiddleware({ secret: SECRET, skipPrefixes: ["/health"] });
    const result = await callMiddleware(mw, { path: "/health", headers: {} });
    expect(result.nextCalled).toBe(true);
  });

  it("recusa quando header ausente", async () => {
    const mw = createHmacMiddleware({ secret: SECRET, skipPrefixes: [] });
    const result = await callMiddleware(mw, { path: "/api/chat", headers: {} });
    expect(result.statusCode).toBe(401);
    expect(result.body?.reason).toBe("header_missing");
  });

  it("aceita quando header válido", async () => {
    const mw = createHmacMiddleware({ secret: SECRET, skipPrefixes: [] });
    const header = buildHmacHeader(SECRET);
    const result = await callMiddleware(mw, {
      path: "/api/chat",
      headers: { [HEADER]: header },
    });
    expect(result.nextCalled).toBe(true);
  });
});
