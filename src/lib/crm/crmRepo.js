import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "@/lib/db/driver.js";

// ── Contacts ──

export async function getContacts(filters = {}) {
  const db = await getAdapter();
  let sql = "SELECT * FROM crmContacts";
  const params = [];
  if (filters.email) { sql += " WHERE email = ?"; params.push(filters.email); }
  sql += " ORDER BY updatedAt DESC";
  return db.all(sql, params).map(parseContact);
}

export async function getContact(id) {
  const db = await getAdapter();
  return parseContact(db.get("SELECT * FROM crmContacts WHERE id = ?", [id]));
}

export async function getContactByEmail(email) {
  const db = await getAdapter();
  return parseContact(db.get("SELECT * FROM crmContacts WHERE email = ?", [email]));
}

export async function upsertContact(data) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  const existing = data.email ? db.get("SELECT * FROM crmContacts WHERE email = ?", [data.email]) : null;
  if (existing) {
    const merged = { ...parseContact(existing), ...data, updatedAt: now };
    db.run(`UPDATE crmContacts SET name=?, email=?, phone=?, company=?, tags=?, notes=?, source=?, updatedAt=? WHERE id=?`,
      [merged.name, merged.email, merged.phone, merged.company, JSON.stringify(merged.tags || []), merged.notes, merged.source, now, existing.id]);
    return { ...merged, id: existing.id };
  }
  const id = uuidv4();
  db.run(`INSERT INTO crmContacts(id, userId, name, email, phone, company, tags, notes, source, createdAt, updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    [id, data.userId || null, data.name, data.email || null, data.phone || null, data.company || null, JSON.stringify(data.tags || []), data.notes || null, data.source || null, now, now]);
  return { id, ...data, tags: data.tags || [], createdAt: now, updatedAt: now };
}

export async function deleteContact(id) {
  const db = await getAdapter();
  db.run("DELETE FROM crmActivities WHERE contactId = ?", [id]);
  db.run("DELETE FROM crmDeals WHERE contactId = ?", [id]);
  db.run("DELETE FROM crmContacts WHERE id = ?", [id]);
}

function parseContact(row) {
  if (!row) return null;
  return { ...row, tags: safeJson(row.tags, []) };
}

// ── Deals ──

const DEFAULT_STAGES = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];

export async function getDeals(stage) {
  const db = await getAdapter();
  let sql = `SELECT d.*, c.name as contactName, c.email as contactEmail FROM crmDeals d LEFT JOIN crmContacts c ON c.id = d.contactId`;
  const params = [];
  if (stage) { sql += " WHERE d.stage = ?"; params.push(stage); }
  sql += " ORDER BY d.updatedAt DESC";
  return db.all(sql, params);
}

export async function getDeal(id) {
  const db = await getAdapter();
  return db.get(`SELECT d.*, c.name as contactName, c.email as contactEmail FROM crmDeals d LEFT JOIN crmContacts c ON c.id = d.contactId WHERE d.id = ?`, [id]);
}

export async function createDeal(data) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  const id = uuidv4();
  const stage = data.stage || "lead";
  const valueCents = data.valueCents || 0;
  const currency = data.currency || "USD";
  db.run(`INSERT INTO crmDeals(id, contactId, title, valueCents, currency, stage, source, notes, createdAt, updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?)`,
    [id, data.contactId, data.title, valueCents, currency, stage, data.source || null, data.notes || null, now, now]);
  return { id, ...data, stage, valueCents, currency, createdAt: now, updatedAt: now };
}

export async function updateDealStage(id, stage) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  const closedAt = stage === "won" || stage === "lost" ? now : null;
  db.run("UPDATE crmDeals SET stage=?, closedAt=?, updatedAt=? WHERE id=?", [stage, closedAt, now, id]);
  return { id, stage, closedAt, updatedAt: now };
}

export async function deleteDeal(id) {
  const db = await getAdapter();
  db.run("DELETE FROM crmDeals WHERE id = ?", [id]);
}

export { DEFAULT_STAGES };

// ── Activities ──

export async function getActivities(contactId) {
  const db = await getAdapter();
  if (contactId) return db.all("SELECT * FROM crmActivities WHERE contactId = ? ORDER BY createdAt DESC", [contactId]);
  return db.all("SELECT * FROM crmActivities ORDER BY createdAt DESC LIMIT 50");
}

export async function logActivity({ contactId, dealId, type, description, metadata }) {
  const db = await getAdapter();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.run("INSERT INTO crmActivities(id, contactId, dealId, type, description, metadata, createdAt) VALUES(?,?,?,?,?,?,?)",
    [id, contactId, dealId || null, type, description || null, JSON.stringify(metadata || {}), now]);
  return { id, contactId, dealId, type, description, metadata, createdAt: now };
}

// ── Pipeline summary ──

export async function getPipelineSummary() {
  const db = await getAdapter();
  const stages = db.all("SELECT stage, COUNT(*) as count, COALESCE(SUM(valueCents), 0) as value FROM crmDeals GROUP BY stage");
  const totalValue = stages.reduce((s, r) => s + (r.stage !== "lost" ? r.value : 0), 0);
  const summary = {};
  for (const s of DEFAULT_STAGES) {
    const found = stages.find(r => r.stage === s);
    summary[s] = { count: found?.count || 0, value: found?.value || 0 };
  }
  return { stages: summary, totalValueCents: totalValue, totalDeals: stages.reduce((s, r) => s + r.count, 0) };
}

function safeJson(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
