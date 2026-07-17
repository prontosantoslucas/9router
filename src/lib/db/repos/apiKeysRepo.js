import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";

function rowToKey(row) {
  if (!row) return null;
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    machineId: row.machineId,
    isActive: row.isActive === 1 || row.isActive === true,
    createdAt: row.createdAt,
    userId: row.userId ?? null,
    planId: row.planId ?? null,
    label: row.label ?? null,
    balanceCents: row.balanceCents ?? 0,
    tokenBalance: row.tokenBalance ?? null,
    periodStart: row.periodStart ?? null,
    periodEnd: row.periodEnd ?? null,
    revokedAt: row.revokedAt ?? null,
    boundIp: row.boundIp ?? null,
    bannedAt: row.bannedAt ?? null,
    banReason: row.banReason ?? null,
    strikeCount: row.strikeCount ?? 0,
  };
}

export async function getApiKeys() {
  const db = await getAdapter();
  const rows = db.all(`SELECT * FROM apiKeys ORDER BY createdAt ASC`);
  return rows.map(rowToKey);
}

export async function getApiKeyById(id) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
  return rowToKey(row);
}

export async function createApiKey(name, machineId) {
  if (!machineId) throw new Error("machineId is required");
  const db = await getAdapter();
  const { generateApiKeyWithMachine } = await import("@/shared/utils/apiKey");
  const result = generateApiKeyWithMachine(machineId);
  const apiKey = {
    id: uuidv4(),
    name,
    key: result.key,
    machineId,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  db.run(
    `INSERT INTO apiKeys(id, key, name, machineId, isActive, createdAt) VALUES(?, ?, ?, ?, ?, ?)`,
    [apiKey.id, apiKey.key, apiKey.name, apiKey.machineId, 1, apiKey.createdAt]
  );
  return apiKey;
}

export async function updateApiKey(id, data) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
    if (!row) return;
    const merged = { ...rowToKey(row), ...data };
    db.run(
      `UPDATE apiKeys SET key = ?, name = ?, machineId = ?, isActive = ? WHERE id = ?`,
      [merged.key, merged.name, merged.machineId, merged.isActive ? 1 : 0, id]
    );
    result = merged;
  });
  return result;
}

export async function deleteApiKey(id) {
  const db = await getAdapter();
  const res = db.run(`DELETE FROM apiKeys WHERE id = ?`, [id]);
  return (res?.changes ?? 0) > 0;
}

export async function validateApiKey(key) {
  const db = await getAdapter();
  const row = db.get(`SELECT isActive FROM apiKeys WHERE key = ?`, [key]);
  if (!row) return false;
  return row.isActive === 1 || row.isActive === true;
}

export async function getApiKeyByKey(key) {
  const db = await getAdapter();
  return rowToKey(db.get(`SELECT * FROM apiKeys WHERE key = ?`, [key]));
}

export async function getApiKeysByUser(userId) {
  const db = await getAdapter();
  return db.all(`SELECT * FROM apiKeys WHERE userId = ? ORDER BY createdAt DESC`, [userId]).map(rowToKey);
}

// Create a paid key tied to a user + plan, with an access window.
export async function createPaidApiKey({ userId, planId, key, label = null, periodStart, periodEnd, tokenBalance = null, balanceCents = 0 }) {
  if (!key) throw new Error("key is required");
  const db = await getAdapter();
  const rec = {
    id: uuidv4(),
    key,
    name: label,
    label,
    machineId: null,
    isActive: true,
    createdAt: new Date().toISOString(),
    userId,
    planId,
    periodStart: periodStart ?? null,
    periodEnd: periodEnd ?? null,
    tokenBalance,
    balanceCents,
  };
  db.run(
    `INSERT INTO apiKeys(id, key, name, machineId, isActive, createdAt, userId, planId, label, balanceCents, tokenBalance, periodStart, periodEnd, strikeCount) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [rec.id, rec.key, rec.name, rec.machineId, 1, rec.createdAt, rec.userId, rec.planId, rec.label, rec.balanceCents, rec.tokenBalance, rec.periodStart, rec.periodEnd]
  );
  return rowToKey(db.get(`SELECT * FROM apiKeys WHERE id = ?`, [rec.id]));
}

// Extend an existing key's access window / top up balance (renewal or upgrade).
export async function extendApiKey(id, { periodEnd, addTokenBalance = 0, addBalanceCents = 0, planId }) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
    if (!row) return;
    const nextTok = (row.tokenBalance ?? 0) + (addTokenBalance || 0);
    const nextCents = (row.balanceCents ?? 0) + (addBalanceCents || 0);
    db.run(
      `UPDATE apiKeys SET periodEnd = ?, tokenBalance = ?, balanceCents = ?, planId = ?, revokedAt = NULL, bannedAt = NULL, banReason = NULL, isActive = 1 WHERE id = ?`,
      [periodEnd ?? row.periodEnd, nextTok, nextCents, planId ?? row.planId, id]
    );
    result = rowToKey(db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]));
  });
  return result;
}

// Atomically debit usage from a key. Returns updated balances or null if key missing.
export async function debitApiKey(id, { tokens = 0, cents = 0 }) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get(`SELECT tokenBalance, balanceCents FROM apiKeys WHERE id = ?`, [id]);
    if (!row) return;
    const nextTok = row.tokenBalance == null ? null : Math.max(0, row.tokenBalance - (tokens || 0));
    const nextCents = Math.max(0, (row.balanceCents ?? 0) - Math.round(cents || 0));
    db.run(`UPDATE apiKeys SET tokenBalance = ?, balanceCents = ? WHERE id = ?`, [nextTok, nextCents, id]);
    result = { tokenBalance: nextTok, balanceCents: nextCents };
  });
  return result;
}

export async function bindApiKeyIp(id, ip) {
  const db = await getAdapter();
  const res = db.run(`UPDATE apiKeys SET boundIp = ? WHERE id = ? AND boundIp IS NULL`, [ip, id]);
  return (res?.changes ?? 0) > 0;
}

export async function rebindApiKeyIp(id, ip) {
  const db = await getAdapter();
  db.run(`UPDATE apiKeys SET boundIp = ? WHERE id = ?`, [ip, id]);
}

export async function incrementStrike(id) {
  const db = await getAdapter();
  let count = 0;
  db.transaction(() => {
    const row = db.get(`SELECT strikeCount FROM apiKeys WHERE id = ?`, [id]);
    if (!row) return;
    count = (row.strikeCount ?? 0) + 1;
    db.run(`UPDATE apiKeys SET strikeCount = ? WHERE id = ?`, [count, id]);
  });
  return count;
}

export async function banApiKey(id, reason) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  db.run(`UPDATE apiKeys SET bannedAt = ?, banReason = ?, revokedAt = ?, isActive = 0 WHERE id = ?`, [now, reason ?? null, now, id]);
}

export async function unbanApiKey(id) {
  const db = await getAdapter();
  db.run(`UPDATE apiKeys SET bannedAt = NULL, banReason = NULL, revokedAt = NULL, isActive = 1, strikeCount = 0 WHERE id = ?`, [id]);
}
