import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock verifyDashboardAuthToken
vi.mock("@/lib/auth/dashboardSession", () => ({
  verifyDashboardAuthToken: vi.fn(async (token) => token === "valid-jwt-token"),
}));

import { GET, POST } from "@/app/api/agent/[[...path]]/route.js";

describe("Agent Proxy Catch-all Route (/api/agent/[[...path]])", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should return 403 Forbidden for target paths not in ALLOWED_PATHS", async () => {
    const req = new Request("http://localhost/api/agent/unallowed/path", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    req.nextUrl = new URL("http://localhost/api/agent/unallowed/path");
    const context = { params: Promise.resolve({ path: ["unallowed", "path"] }) };

    const response = await POST(req, context);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toContain("Acesso negado");
  });

  it("should return 401 Unauthorized when JWT token is missing or invalid for private paths", async () => {
    const req = new Request("http://localhost/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    req.nextUrl = new URL("http://localhost/api/agent/chat");
    req.cookies = { get: () => null };
    const context = { params: Promise.resolve({ path: ["chat"] }) };

    const response = await POST(req, context);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toContain("Unauthorized");
  });

  it("should bypass JWT auth for public webhook paths", async () => {
    const req = new Request("http://localhost/api/agent/webhook/evolution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    req.nextUrl = new URL("http://localhost/api/agent/webhook/evolution");
    req.cookies = { get: () => null };
    const context = { params: Promise.resolve({ path: ["webhook", "evolution"] }) };

    // Mock global fetch to simulate agent loopback response
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ status: "received" }), { status: 200 }));

    try {
      const response = await POST(req, context);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.status).toBe("received");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("should return 502 Bad Gateway with loopback error message when agent fetch fails", async () => {
    const req = new Request("http://localhost/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    req.nextUrl = new URL("http://localhost/api/agent/chat");
    req.cookies = { get: (name) => (name === "auth_token" ? { value: "valid-jwt-token" } : null) };
    const context = { params: Promise.resolve({ path: ["chat"] }) };

    const originalFetch = global.fetch;
    global.fetch = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:3717");
    });

    try {
      const response = await POST(req, context);
      expect(response.status).toBe(502);
      const json = await response.json();
      expect(json.error).toBe("Erro de comunicação com o Agente Lucas (loopback indisponível)");
      expect(json.details).toContain("ECONNREFUSED");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
