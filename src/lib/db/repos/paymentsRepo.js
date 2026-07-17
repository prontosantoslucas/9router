import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";

function rowToPayment(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    apiKeyId: row.apiKeyId,
    subscriptionId: row.subscriptionId,
    planId: row.planId,
    gateway: row.gateway,
    externalId: row.externalId,
    amountCents: row.amountCents,
    currency: row.currency,
    status: row.status,
    createdAt: row.createdAt,
    raw: row.raw,
  };
}

export async function getPaymentsByUser(userId) {
  const db = await getAdapter();
  return db.all(`SELECT * FROM payments WHERE userId = ? ORDER BY createdAt DESC`, [userId]).map(rowToPayment);
}

export async function getPaymentByExternal(gateway, externalId) {
  const db = await getAdapter();
  return rowToPayment(db.get(`SELECT * FROM payments WHERE gateway = ? AND externalId = ?`, [gateway, externalId]));
}

export async function createPayment(data) {
  const db = await getAdapter();
  const payment = {
    id: uuidv4(),
    userId: data.userId ?? null,
    apiKeyId: data.apiKeyId ?? null,
    subscriptionId: data.subscriptionId ?? null,
    planId: data.planId ?? null,
    gateway: data.gateway,
    externalId: data.externalId ?? null,
    amountCents: data.amountCents ?? 0,
    currency: data.currency || "USD",
    status: data.status || "pending",
    createdAt: new Date().toISOString(),
    raw: data.raw ? (typeof data.raw === "string" ? data.raw : JSON.stringify(data.raw)) : null,
  };
  db.run(
    `INSERT INTO payments(id, userId, apiKeyId, subscriptionId, planId, gateway, externalId, amountCents, currency, status, createdAt, raw) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [payment.id, payment.userId, payment.apiKeyId, payment.subscriptionId, payment.planId, payment.gateway, payment.externalId, payment.amountCents, payment.currency, payment.status, payment.createdAt, payment.raw]
  );
  return payment;
}

export async function updatePaymentStatus(id, status) {
  const db = await getAdapter();
  const res = db.run(`UPDATE payments SET status = ? WHERE id = ?`, [status, id]);
  return (res?.changes ?? 0) > 0;
}
