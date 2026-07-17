import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";

// --- webhook idempotency ---
export async function isWebhookProcessed(gateway, externalId) {
  const db = await getAdapter();
  return !!db.get(`SELECT id FROM webhookEvents WHERE gateway = ? AND externalId = ?`, [gateway, externalId]);
}

export async function markWebhookProcessed(gateway, externalId, type = null) {
  const db = await getAdapter();
  try {
    db.run(
      `INSERT INTO webhookEvents(id, gateway, externalId, type, processedAt) VALUES(?, ?, ?, ?, ?)`,
      [uuidv4(), gateway, externalId, type, new Date().toISOString()]
    );
    return true;
  } catch {
    // unique-index race: already processed
    return false;
  }
}

// --- ip log ---
export async function recordKeyIp(apiKeyId, ip) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  const existing = db.get(`SELECT * FROM keyIpLog WHERE apiKeyId = ? AND ip = ?`, [apiKeyId, ip]);
  if (existing) {
    db.run(`UPDATE keyIpLog SET lastSeen = ?, hitCount = hitCount + 1 WHERE id = ?`, [now, existing.id]);
  } else {
    db.run(
      `INSERT INTO keyIpLog(id, apiKeyId, ip, firstSeen, lastSeen, hitCount) VALUES(?, ?, ?, ?, ?, ?)`,
      [uuidv4(), apiKeyId, ip, now, now, 1]
    );
  }
}

export async function distinctIpsSince(apiKeyId, sinceIso) {
  const db = await getAdapter();
  const rows = db.all(`SELECT ip FROM keyIpLog WHERE apiKeyId = ? AND lastSeen >= ?`, [apiKeyId, sinceIso]);
  return rows.map((r) => r.ip);
}

// --- bans ---
export async function recordBanEvent(apiKeyId, ip, reason) {
  const db = await getAdapter();
  db.run(
    `INSERT INTO banEvents(id, apiKeyId, ip, reason, createdAt) VALUES(?, ?, ?, ?, ?)`,
    [uuidv4(), apiKeyId, ip ?? null, reason ?? null, new Date().toISOString()]
  );
}

export async function getBanEvents(apiKeyId) {
  const db = await getAdapter();
  return db.all(`SELECT * FROM banEvents WHERE apiKeyId = ? ORDER BY createdAt DESC`, [apiKeyId]);
}
