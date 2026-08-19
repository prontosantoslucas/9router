import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";

function rowToAlert(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    contactId: row.contactId,
    dealId: row.dealId,
    apiKeyId: row.apiKeyId,
    title: row.title,
    message: row.message,
    metadata: row.metadata ? JSON.parse(row.metadata) : {},
    resolved: row.resolved === 1,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
  };
}

function rowToWebhook(row) {
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    events: row.events ? JSON.parse(row.events) : [],
    secret: row.secret,
    isActive: row.isActive === 1,
    lastFiredAt: row.lastFiredAt,
    failCount: row.failCount,
    createdAt: row.createdAt,
  };
}

export async function getAlerts({ contactId, resolved, limit = 50, offset = 0 } = {}) {
  const db = await getAdapter();
  let sql = `SELECT * FROM crmAlerts WHERE 1=1`;
  const params = [];

  if (contactId) {
    sql += ` AND contactId = ?`;
    params.push(contactId);
  }

  if (resolved !== undefined) {
    sql += ` AND resolved = ?`;
    params.push(resolved ? 1 : 0);
  }

  sql += ` ORDER BY createdAt DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = db.all(sql, params);
  return rows.map(rowToAlert);
}

export async function createAlert({ type, severity, contactId, dealId, apiKeyId, title, message, metadata = {} }) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  const alert = {
    id: uuidv4(),
    type,
    severity,
    contactId: contactId || null,
    dealId: dealId || null,
    apiKeyId: apiKeyId || null,
    title,
    message,
    metadata: JSON.stringify(metadata),
    resolved: false,
    resolvedAt: null,
    createdAt: now,
  };

  db.run(
    `INSERT INTO crmAlerts(id, type, severity, contactId, dealId, apiKeyId, title, message, metadata, resolved, resolvedAt, createdAt)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      alert.id,
      alert.type,
      alert.severity,
      alert.contactId,
      alert.dealId,
      alert.apiKeyId,
      alert.title,
      alert.message,
      alert.metadata,
      0,
      alert.resolvedAt,
      alert.createdAt,
    ]
  );

  return rowToAlert(alert);
}

export async function resolveAlert(id) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  db.run(`UPDATE crmAlerts SET resolved = 1, resolvedAt = ? WHERE id = ?`, [now, id]);
}

export async function getWebhooks() {
  const db = await getAdapter();
  const rows = db.all(`SELECT * FROM crmWebhooks WHERE isActive = 1 ORDER BY createdAt ASC`);
  return rows.map(rowToWebhook);
}

export async function getWebhooksByEvent(event) {
  const db = await getAdapter();
  const rows = db.all(
    `SELECT * FROM crmWebhooks WHERE isActive = 1 AND events LIKE ? ORDER BY createdAt ASC`,
    [`%"${event}"%`]
  );
  return rows.map(rowToWebhook);
}

export async function createWebhook({ url, events, secret }) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  const webhook = {
    id: uuidv4(),
    url,
    events: JSON.stringify(events),
    secret: secret || null,
    isActive: true,
    lastFiredAt: null,
    failCount: 0,
    createdAt: now,
  };

  db.run(
    `INSERT INTO crmWebhooks(id, url, events, secret, isActive, lastFiredAt, failCount, createdAt)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
    [webhook.id, webhook.url, webhook.events, webhook.secret, 1, webhook.lastFiredAt, webhook.failCount, webhook.createdAt]
  );

  return rowToWebhook(webhook);
}

export async function updateWebhookStatus(id, { isActive, failCount, lastFiredAt }) {
  const db = await getAdapter();
  let sql = `UPDATE crmWebhooks SET `;
  const params = [];
  const updates = [];

  if (isActive !== undefined) {
    updates.push(`isActive = ?`);
    params.push(isActive ? 1 : 0);
  }

  if (failCount !== undefined) {
    updates.push(`failCount = ?`);
    params.push(failCount);
  }

  if (lastFiredAt !== undefined) {
    updates.push(`lastFiredAt = ?`);
    params.push(lastFiredAt);
  }

  sql += updates.join(", ");
  sql += ` WHERE id = ?`;
  params.push(id);

  db.run(sql, params);
}

export async function deleteWebhook(id) {
  const db = await getAdapter();
  db.run(`DELETE FROM crmWebhooks WHERE id = ?`, [id]);
}

export async function checkUsageAlerts() {
  const db = await getAdapter();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const results = db.all(
    `SELECT 
      ak.id as keyId,
      ak.contactId,
      ak.name as keyName,
      c.name as contactName,
      c.email as contactEmail,
      SUM(u.cost) as totalCost,
      COUNT(u.id) as totalRequests
    FROM apiKeys ak
    LEFT JOIN crmContacts c ON c.id = ak.contactId
    LEFT JOIN usageHistory u ON u.apiKey = ak.key AND u.timestamp >= ?
    WHERE ak.contactId IS NOT NULL
    GROUP BY ak.id
    HAVING totalCost > 50
    ORDER BY totalCost DESC`,
    [startOfMonth]
  );

  const alerts = [];
  for (const row of results) {
    const existing = db.get(
      `SELECT id FROM crmAlerts WHERE type = 'usage_high' AND apiKeyId = ? AND resolved = 0`,
      [row.keyId]
    );

    if (!existing) {
      const alert = await createAlert({
        type: "usage_high",
        severity: "warning",
        contactId: row.contactId,
        apiKeyId: row.keyId,
        title: "Consumo Alto Detectado",
        message: `A key "${row.keyName}" atingiu $${row.totalCost.toFixed(2)} este mês (${row.totalRequests} requests)`,
        metadata: { cost: row.totalCost, requests: row.totalRequests, keyName: row.keyName },
      });
      alerts.push(alert);
    }
  }

  return alerts;
}

export async function checkBalanceAlerts() {
  const db = await getAdapter();
  const results = db.all(
    `SELECT 
      ak.id as keyId,
      ak.contactId,
      ak.name as keyName,
      ak.balanceCents,
      c.name as contactName
    FROM apiKeys ak
    LEFT JOIN crmContacts c ON c.id = ak.contactId
    WHERE ak.contactId IS NOT NULL AND ak.balanceCents < 1000 AND ak.isActive = 1`
  );

  const alerts = [];
  for (const row of results) {
    const existing = db.get(
      `SELECT id FROM crmAlerts WHERE type = 'balance_low' AND apiKeyId = ? AND resolved = 0`,
      [row.keyId]
    );

    if (!existing) {
      const alert = await createAlert({
        type: "balance_low",
        severity: "critical",
        contactId: row.contactId,
        apiKeyId: row.keyId,
        title: "Balance Baixo",
        message: `A key "${row.keyName}" está com balance de apenas $${(row.balanceCents / 100).toFixed(2)}`,
        metadata: { balanceCents: row.balanceCents, keyName: row.keyName },
      });
      alerts.push(alert);
    }
  }

  return alerts;
}

export async function checkStaledDeals() {
  const db = await getAdapter();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const threshold = sevenDaysAgo.toISOString();

  const results = db.all(
    `SELECT 
      d.id as dealId,
      d.contactId,
      d.title,
      d.stage,
      d.updatedAt,
      c.name as contactName
    FROM crmDeals d
    LEFT JOIN crmContacts c ON c.id = d.contactId
    WHERE d.stage NOT IN ('won', 'lost') AND d.updatedAt < ?`,
    [threshold]
  );

  const alerts = [];
  for (const row of results) {
    const existing = db.get(
      `SELECT id FROM crmAlerts WHERE type = 'deal_staled' AND dealId = ? AND resolved = 0`,
      [row.dealId]
    );

    if (!existing) {
      const daysSince = Math.floor((Date.now() - new Date(row.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
      const alert = await createAlert({
        type: "deal_staled",
        severity: "info",
        contactId: row.contactId,
        dealId: row.dealId,
        title: "Deal Parado",
        message: `O deal "${row.title}" não teve movimento há ${daysSince} dias (stage: ${row.stage})`,
        metadata: { dealTitle: row.title, stage: row.stage, daysSince },
      });
      alerts.push(alert);
    }
  }

  return alerts;
}
