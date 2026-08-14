import { describe, it, expect } from "vitest";
const prospector = require("../../apps/agent/src/prospector");

describe("Prospector 24/7 Engine (apps/agent/src/prospector.js)", () => {
  it("should retrieve default settings and update them", () => {
    const s = prospector.getSettings();
    expect(s).toBeDefined();
    expect(s.enabled).toBe(1);

    const updated = prospector.updateSettings({
      target_keywords: "Engenheiro de Software, AI Specialist",
      auto_send_wa: 1,
      auto_send_ig: 1
    });
    expect(updated.target_keywords).toBe("Engenheiro de Software, AI Specialist");
  });

  it("should upsert leads with strict deduplication", () => {
    const uniqueCompany = "InnovateTech_" + Date.now();
    const leadData = {
      title: "Senior AI Engineer",
      company: uniqueCompany,
      location: "Remoto / São Paulo",
      phone: "5511988887777",
      instagram_handle: "innovatetech.ai"
    };

    const first = prospector.upsertLead(leadData);
    expect(first.isNew).toBe(true);
    expect(first.lead.title).toBe("Senior AI Engineer");

    const duplicate = prospector.upsertLead(leadData);
    expect(duplicate.isNew).toBe(false);
    expect(duplicate.lead.id).toBe(first.lead.id);
  });

  it("should generate personalized outreach pitch", async () => {
    const lead = {
      title: "Full Stack Engineer",
      company: "Startup XYZ",
      location: "São Paulo",
      source: "linkedin"
    };
    const msg = await prospector.generateOutreachMessage(lead, "whatsapp");
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(20);
  }, 15000);

  it("should return system stats and lead listing", () => {
    const stats = prospector.getStats();
    expect(stats.totalLeads).toBeGreaterThanOrEqual(1);
    const list = prospector.listLeads(5);
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
  });
});
