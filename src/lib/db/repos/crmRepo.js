import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";

function rowToContact(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    tags: row.tags ? JSON.parse(row.tags) : [],
    notes: row.notes,
    source: row.source,
    status: row.status || "lead",
    customFields: row.customFields ? JSON.parse(row.customFields) : {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToDeal(row) {
  if (!row) return null;
  return {
    id: row.id,
    contactId: row.contactId,
    title: row.title,
    valueCents: row.valueCents,
    currency: row.currency,
    stage: row.stage,
    priority: row.priority || "none",
    expectedCloseAt: row.expectedCloseAt || null,
    source: row.source,
    notes: row.notes,
    closedAt: row.closedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToActivity(row) {
  if (!row) return null;
  return {
    id: row.id,
    contactId: row.contactId,
    dealId: row.dealId,
    type: row.type,
    description: row.description,
    metadata: row.metadata ? JSON.parse(row.metadata) : {},
    createdAt: row.createdAt,
  };
}

export async function getContacts({ search, tags, status, limit = 100, offset = 0 } = {}) {
  const db = await getAdapter();
  let sql = `SELECT * FROM crmContacts WHERE 1=1`;
  const params = [];

  if (search) {
    sql += ` AND (name LIKE ? OR email LIKE ? OR company LIKE ?)`;
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern);
  }

  if (tags && tags.length > 0) {
    sql += ` AND (${tags.map(() => `tags LIKE ?`).join(" OR ")})`;
    tags.forEach((tag) => params.push(`%"${tag}"%`));
  }

  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }

  sql += ` ORDER BY updatedAt DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = db.all(sql, params);
  return rows.map(rowToContact);
}

export async function getContactById(id) {
  const db = await getAdapter();
  return rowToContact(db.get(`SELECT * FROM crmContacts WHERE id = ?`, [id]));
}

export async function getContactByEmail(email) {
  const db = await getAdapter();
  return rowToContact(db.get(`SELECT * FROM crmContacts WHERE email = ?`, [email]));
}

export async function createContact(data) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  const contact = {
    id: uuidv4(),
    userId: data.userId || null,
    name: data.name,
    email: data.email || null,
    phone: data.phone || null,
    company: data.company || null,
    tags: JSON.stringify(data.tags || []),
    notes: data.notes || null,
    source: data.source || null,
    status: data.status || "lead",
    customFields: JSON.stringify(data.customFields || {}),
    createdAt: now,
    updatedAt: now,
  };

  db.run(
    `INSERT INTO crmContacts(id, userId, name, email, phone, company, tags, notes, source, status, customFields, createdAt, updatedAt)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      contact.id,
      contact.userId,
      contact.name,
      contact.email,
      contact.phone,
      contact.company,
      contact.tags,
      contact.notes,
      contact.source,
      contact.status,
      contact.customFields,
      contact.createdAt,
      contact.updatedAt,
    ]
  );

  // Fire webhook
  const { fireWebhook, WEBHOOK_EVENTS } = await import("@/lib/webhooks.js");
  void fireWebhook(WEBHOOK_EVENTS.CONTACT_CREATED, rowToContact(contact));

  return rowToContact(contact);
}

export async function updateContact(id, data) {
  const db = await getAdapter();
  let result = null;

  db.transaction(() => {
    const row = db.get(`SELECT * FROM crmContacts WHERE id = ?`, [id]);
    if (!row) return;

    const merged = {
      ...rowToContact(row),
      ...data,
      tags: data.tags ? JSON.stringify(data.tags) : row.tags,
      updatedAt: new Date().toISOString(),
    };

    db.run(
      `UPDATE crmContacts SET userId = ?, name = ?, email = ?, phone = ?, company = ?, tags = ?, notes = ?, source = ?, status = ?, customFields = ?, updatedAt = ? WHERE id = ?`,
      [
        merged.userId,
        merged.name,
        merged.email,
        merged.phone,
        merged.company,
        merged.tags,
        merged.notes,
        merged.source,
        merged.status,
        merged.customFields ? JSON.stringify(merged.customFields) : row.customFields,
        merged.updatedAt,
        id,
      ]
    );

    result = rowToContact(merged);
  });

  return result;
}

export async function deleteContact(id) {
  const db = await getAdapter();
  db.transaction(() => {
    db.run(`DELETE FROM crmDeals WHERE contactId = ?`, [id]);
    db.run(`DELETE FROM crmActivities WHERE contactId = ?`, [id]);
    db.run(`DELETE FROM crmCheckouts WHERE contactId = ?`, [id]);
    db.run(`DELETE FROM crmAlerts WHERE contactId = ?`, [id]);
    db.run(`DELETE FROM apiKeys WHERE contactId = ?`, [id]);
    db.run(`DELETE FROM crmContacts WHERE id = ?`, [id]);
  });
}

export async function getDeals({ contactId, stage, priority, limit = 100, offset = 0 } = {}) {
  const db = await getAdapter();
  let sql = `SELECT * FROM crmDeals WHERE 1=1`;
  const params = [];

  if (contactId) {
    sql += ` AND contactId = ?`;
    params.push(contactId);
  }

  if (stage) {
    sql += ` AND stage = ?`;
    params.push(stage);
  }

  if (priority) {
    sql += ` AND priority = ?`;
    params.push(priority);
  }

  sql += ` ORDER BY updatedAt DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = db.all(sql, params);
  return rows.map(rowToDeal);
}

export async function getDealById(id) {
  const db = await getAdapter();
  return rowToDeal(db.get(`SELECT * FROM crmDeals WHERE id = ?`, [id]));
}

export async function createDeal(data) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  const deal = {
    id: uuidv4(),
    contactId: data.contactId,
    title: data.title,
    valueCents: data.valueCents || 0,
    currency: data.currency || "USD",
    stage: data.stage || "lead",
    priority: data.priority || "none",
    expectedCloseAt: data.expectedCloseAt || null,
    source: data.source || null,
    notes: data.notes || null,
    closedAt: data.closedAt || null,
    createdAt: now,
    updatedAt: now,
  };

  db.run(
    `INSERT INTO crmDeals(id, contactId, title, valueCents, currency, stage, priority, expectedCloseAt, source, notes, closedAt, createdAt, updatedAt)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      deal.id,
      deal.contactId,
      deal.title,
      deal.valueCents,
      deal.currency,
      deal.stage,
      deal.priority,
      deal.expectedCloseAt,
      deal.source,
      deal.notes,
      deal.closedAt,
      deal.createdAt,
      deal.updatedAt,
    ]
  );

  await createActivity({
    contactId: deal.contactId,
    dealId: deal.id,
    type: "deal_created",
    description: `Deal criado: ${deal.title}`,
  });

  return rowToDeal(deal);
}

export async function updateDeal(id, data) {
  const db = await getAdapter();
  let result = null;

  db.transaction(() => {
    const row = db.get(`SELECT * FROM crmDeals WHERE id = ?`, [id]);
    if (!row) return;

    const old = rowToDeal(row);
    const merged = {
      ...old,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    db.run(
      `UPDATE crmDeals SET contactId = ?, title = ?, valueCents = ?, currency = ?, stage = ?, priority = ?, expectedCloseAt = ?, source = ?, notes = ?, closedAt = ?, updatedAt = ? WHERE id = ?`,
      [
        merged.contactId,
        merged.title,
        merged.valueCents,
        merged.currency,
        merged.stage,
        merged.priority,
        merged.expectedCloseAt || null,
        merged.source,
        merged.notes,
        merged.closedAt,
        merged.updatedAt,
        id,
      ]
    );

    if (old.stage !== merged.stage) {
      createActivity({
        contactId: merged.contactId,
        dealId: id,
        type: "stage_changed",
        description: `Stage alterado: ${old.stage} → ${merged.stage}`,
      });
      
      // Fire webhook for stage change
      (async () => {
        const { fireWebhook, WEBHOOK_EVENTS } = await import("@/lib/webhooks.js");
        await fireWebhook(WEBHOOK_EVENTS.DEAL_STAGE_CHANGED, {
          deal: merged,
          oldStage: old.stage,
          newStage: merged.stage,
        });
      })();
    }

    // Fire webhook for any deal update (outcome, value, close date, etc.)
    (async () => {
      const { fireWebhook, WEBHOOK_EVENTS } = await import("@/lib/webhooks.js");
      await fireWebhook(WEBHOOK_EVENTS.DEAL_UPDATED, {
        deal: merged,
        changedFields: Object.keys(data),
      });
    })();

    result = rowToDeal(merged);
  });

  return result;
}

export async function deleteDeal(id) {
  const db = await getAdapter();
  db.run(`DELETE FROM crmDeals WHERE id = ?`, [id]);
  db.run(`DELETE FROM crmActivities WHERE dealId = ?`, [id]);
  db.run(`DELETE FROM crmAlerts WHERE dealId = ?`, [id]);
}

export async function getActivities({ contactId, dealId, limit = 100, offset = 0 } = {}) {
  const db = await getAdapter();
  let sql = `SELECT * FROM crmActivities WHERE 1=1`;
  const params = [];

  if (contactId) {
    sql += ` AND contactId = ?`;
    params.push(contactId);
  }

  if (dealId) {
    sql += ` AND dealId = ?`;
    params.push(dealId);
  }

  sql += ` ORDER BY createdAt DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = db.all(sql, params);
  return rows.map(rowToActivity);
}

export async function createActivity(data) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  const activity = {
    id: uuidv4(),
    contactId: data.contactId,
    dealId: data.dealId || null,
    type: data.type,
    description: data.description || null,
    metadata: JSON.stringify(data.metadata || {}),
    createdAt: now,
  };

  db.run(
    `INSERT INTO crmActivities(id, contactId, dealId, type, description, metadata, createdAt)
     VALUES(?, ?, ?, ?, ?, ?, ?)`,
    [
      activity.id,
      activity.contactId,
      activity.dealId,
      activity.type,
      activity.description,
      activity.metadata,
      activity.createdAt,
    ]
  );

  return rowToActivity(activity);
}

export async function getContactStats(contactId) {
  const db = await getAdapter();
  
  const dealsCount = db.get(`SELECT COUNT(*) as count FROM crmDeals WHERE contactId = ?`, [contactId])?.count || 0;
  
  const dealsValue = db.get(
    `SELECT SUM(valueCents) as total FROM crmDeals WHERE contactId = ? AND stage NOT IN ('lost', 'cancelled')`,
    [contactId]
  )?.total || 0;
  
  const wonDeals = db.get(
    `SELECT COUNT(*) as count FROM crmDeals WHERE contactId = ? AND stage = 'won'`,
    [contactId]
  )?.count || 0;

  const apiKeys = db.all(
    `SELECT * FROM apiKeys WHERE contactId = ?`,
    [contactId]
  );

  return {
    dealsCount,
    dealsValue,
    wonDeals,
    apiKeysCount: apiKeys.length,
    apiKeys,
  };
}

export async function getCrmDashboardStats() {
  const db = await getAdapter();

  const contactCounts = db.all(
    `SELECT status, COUNT(*) as count FROM crmContacts GROUP BY status`
  );
  const byStatus = {};
  let totalContacts = 0;
  contactCounts.forEach((row) => {
    byStatus[row.status || "lead"] = row.count;
    totalContacts += row.count;
  });

  const dealRows = db.all(`SELECT stage, priority, COUNT(*) as count, SUM(valueCents) as total FROM crmDeals GROUP BY stage`);
  const stages = {};
  let openValue = 0;
  dealRows.forEach((row) => {
    stages[row.stage] = { count: row.count, total: row.total || 0 };
    if (!["won", "lost", "cancelled"].includes(row.stage)) openValue += row.total || 0;
  });

  const wonTotal = db.get(`SELECT SUM(valueCents) as total FROM crmDeals WHERE stage = 'won'`)?.total || 0;
  const paidCheckouts = db.get(`SELECT COUNT(*) as count FROM crmCheckouts WHERE status = 'paid'`)?.count || 0;
  const revenueCents = db.get(`SELECT SUM(amountCents) as total FROM crmCheckouts WHERE status = 'paid'`)?.total || 0;

  return {
    contacts: totalContacts,
    byStatus,
    stages,
    openValue,
    wonTotal,
    paidCheckouts,
    revenueCents,
  };
}
