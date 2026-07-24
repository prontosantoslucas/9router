import { describe, it, expect } from "vitest";
import db from "../../apps/agent/src/db";

describe("Agent Settings & Modules Persistence (apps/agent/src/db.js)", () => {
  it("deve carregar a instância do banco de dados db com a tabela agent_settings criada", () => {
    expect(db).toBeDefined();
    expect(typeof db.prepare).toBe("function");

    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agent_settings'").get();
    expect(row).toBeDefined();
    expect(row.name).toBe("agent_settings");
  });

  it("deve salvar e ler as configurações dos módulos no banco SQLite do Agente sem erros", () => {
    const modulesData = {
      audioSttTts: true,
      copilotMode: true,
      dailyBriefing: false,
    };

    db.prepare(`
      INSERT INTO agent_settings (key, value, updated_at) VALUES ('modules_test', ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `).run(JSON.stringify(modulesData));

    const savedRow = db.prepare("SELECT value FROM agent_settings WHERE key = 'modules_test'").get();
    expect(savedRow).toBeDefined();
    const parsed = JSON.parse(savedRow.value);
    expect(parsed.copilotMode).toBe(true);
    expect(parsed.dailyBriefing).toBe(false);
  });
});
