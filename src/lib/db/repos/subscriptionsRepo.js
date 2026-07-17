import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

function rowToSub(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    planId: row.planId,
    gateway: row.gateway,
    externalId: row.externalId,
    status: row.status,
    currentPeriodEnd: row.currentPeriodEnd,
    data: parseJson(row.data, null),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getSubscriptionsByUser(userId) {
  const db = await getAdapter();
  return db.all(`SELECT * FROM subscriptions WHERE userId = ? ORDER BY createdAt DESC`, [userId]).map(rowToSub);
}

export async function getSubscriptionByExternal(gateway, externalId) {
  const db = await getAdapter();
  return rowToSub(db.get(`SELECT * FROM subscriptions WHERE gateway = ? AND externalId = ?`, [gateway, externalId]));
}

export async function createSubscription(data) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  const sub = {
    id: uuidv4(),
    userId: data.userId,
    planId: data.planId,
    gateway: data.gateway,
    externalId: data.externalId ?? null,
    status: data.status || "active",
    currentPeriodEnd: data.currentPeriodEnd ?? null,
    data: data.data ?? null,
    createdAt: now,
    updatedAt: now,
  };
  db.run(
    `INSERT INTO subscriptions(id, userId, planId, gateway, externalId, status, currentPeriodEnd, data, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [sub.id, sub.userId, sub.planId, sub.gateway, sub.externalId, sub.status, sub.currentPeriodEnd, stringifyJson(sub.data), sub.createdAt, sub.updatedAt]
  );
  return sub;
}

export async function updateSubscription(id, data) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get(`SELECT * FROM subscriptions WHERE id = ?`, [id]);
    if (!row) return;
    const merged = { ...rowToSub(row), ...data, updatedAt: new Date().toISOString() };
    db.run(
      `UPDATE subscriptions SET status = ?, currentPeriodEnd = ?, data = ?, updatedAt = ? WHERE id = ?`,
      [merged.status, merged.currentPeriodEnd, stringifyJson(merged.data ?? null), merged.updatedAt, id]
    );
    result = merged;
  });
  return result;
}
