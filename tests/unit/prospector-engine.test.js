import { describe, it, expect } from "vitest";
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

  it("should generate personalized Zenda sales pitch", async () => {
    const lead = {
      name: "Centro Odontológico Moema",
      category: "Odontologia",
      city: "São Paulo",
      source: "web"
    };
    const msg = await prospector.generateOutreachMessage(lead, "whatsapp");
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(20);
    expect(msg.includes("Zenda") || msg.includes("Inteligência Artificial") || msg.includes("WhatsApp")).toBe(true);
  }, 15000);

  it("should return system stats and lead listing", () => {
    const stats = prospector.getStats();
    expect(stats.totalLeads).toBeGreaterThanOrEqual(1);
    const list = prospector.listLeads(5);
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
  });
});
