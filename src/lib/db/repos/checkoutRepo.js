import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";

function rowToIntegration(row) {
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    config: JSON.parse(row.config),
    isActive: row.isActive === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToCheckout(row) {
  if (!row) return null;
  return {
    id: row.id,
    contactId: row.contactId,
    dealId: row.dealId,
    integrationId: row.integrationId,
    amountCents: row.amountCents,
    currency: row.currency,
    description: row.description,
    status: row.status,
    externalRef: row.externalRef,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    paidAt: row.paidAt,
    metadata: JSON.parse(row.metadata || "{}"),
  };
}

export async function getIntegrations() {
  const db = await getAdapter();
  return db.all("SELECT * FROM crmIntegrations").map(rowToIntegration);
}

export async function getIntegrationByProvider(provider) {
  const db = await getAdapter();
  return rowToIntegration(db.get("SELECT * FROM crmIntegrations WHERE provider = ? AND isActive = 1 LIMIT 1", [provider]));
}

export async function createIntegration({ provider, name, config }) {
  const db = await getAdapter();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO crmIntegrations (id, provider, name, config, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, ?, ?)`,
    [id, provider, name, JSON.stringify(config), now, now]
  );
  return rowToIntegration(db.get("SELECT * FROM crmIntegrations WHERE id = ?", [id]));
}

export async function updateIntegrationConfig(id, config) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  db.run(`UPDATE crmIntegrations SET config = ?, updatedAt = ? WHERE id = ?`, [JSON.stringify(config), now, id]);
  return rowToIntegration(db.get("SELECT * FROM crmIntegrations WHERE id = ?", [id]));
}

export async function deleteIntegration(id) {
  const db = await getAdapter();
  db.run(`DELETE FROM crmIntegrations WHERE id = ?`, [id]);
}

export async function createCheckout({ contactId, dealId, integrationId, amountCents, currency = "BRL", description, expiresAt = null }) {
  const db = await getAdapter();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO crmCheckouts (id, contactId, dealId, integrationId, amountCents, currency, description, status, expiresAt, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [id, contactId, dealId, integrationId, amountCents, currency, description, expiresAt, now]
  );
  return rowToCheckout(db.get("SELECT * FROM crmCheckouts WHERE id = ?", [id]));
}

export async function getCheckoutById(id) {
  const db = await getAdapter();
  return rowToCheckout(db.get("SELECT * FROM crmCheckouts WHERE id = ?", [id]));
}

export async function listCheckouts({ contactId, status, limit = 100, offset = 0 } = {}) {
  const db = await getAdapter();
  let sql = `SELECT * FROM crmCheckouts WHERE 1=1`;
  const params = [];
  if (contactId) { sql += ` AND contactId = ?`; params.push(contactId); }
  if (status) { sql += ` AND status = ?`; params.push(status); }
  sql += ` ORDER BY createdAt DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  return db.all(sql, params).map(rowToCheckout);
}

export async function updateCheckoutStatus(id, status, externalRef = null, metadata = {}) {
  const db = await getAdapter();
  const paidAt = status === "paid" ? new Date().toISOString() : null;
  const existing = rowToCheckout(db.get("SELECT * FROM crmCheckouts WHERE id = ?", [id]));
  const mergedMeta = { ...(existing?.metadata || {}), ...metadata };
  db.run(
    `UPDATE crmCheckouts SET status = ?, externalRef = COALESCE(?, externalRef), paidAt = COALESCE(?, paidAt), metadata = ? WHERE id = ?`,
    [status, externalRef, paidAt, JSON.stringify(mergedMeta), id]
  );
  return rowToCheckout(db.get("SELECT * FROM crmCheckouts WHERE id = ?", [id]));
}

export async function deleteCheckout(id) {
  const db = await getAdapter();
  db.run(`DELETE FROM crmCheckouts WHERE id = ?`, [id]);
}
