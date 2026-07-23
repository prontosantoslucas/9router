import { describe, it, expect } from "vitest";
import { TOOL_SCHEMAS, runTool } from "../../apps/agent/src/tools";

describe("Ferramentas do Google Workspace (Gmail e Calendar)", () => {
  it("deve registrar os schemas das ferramentas de e-mail e agenda no TOOL_SCHEMAS", () => {
    const names = TOOL_SCHEMAS.map((s) => s.function.name);
    expect(names).toContain("gmail_list");
    expect(names).toContain("gmail_search");
    expect(names).toContain("gmail_read");
    expect(names).toContain("gmail_send");
    expect(names).toContain("calendar_list");
    expect(names).toContain("calendar_create");
    expect(names).toContain("calendar_delete");
  });

  it("deve retornar aviso amigável quando Google OAuth não estiver autorizado", async () => {
    const resList = await runTool("gmail_list", {});
    expect(resList).toContain("Google Workspace não autorizado");

    const resCal = await runTool("calendar_list", {});
    expect(resCal).toContain("Google Workspace não autorizado");
  });
});
