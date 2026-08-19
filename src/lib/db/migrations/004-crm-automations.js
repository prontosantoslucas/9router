// Add automation tables for alerts and webhooks
export default {
  version: 4,
  name: "crm-automations",
  up(db) {
    // Alerts table
    db.exec(`
      CREATE TABLE IF NOT EXISTS crmAlerts (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        contactId TEXT,
        dealId TEXT,
        apiKeyId TEXT,
        title TEXT NOT NULL,
        message TEXT,
        metadata TEXT DEFAULT '{}',
        resolved INTEGER DEFAULT 0,
        resolvedAt TEXT,
        createdAt TEXT NOT NULL
      )
    `);
    
    db.exec(`CREATE INDEX IF NOT EXISTS idx_crm_alerts_contact ON crmAlerts(contactId)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_crm_alerts_type ON crmAlerts(type, resolved)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_crm_alerts_created ON crmAlerts(createdAt DESC)`);
    
    // Webhooks table
    db.exec(`
      CREATE TABLE IF NOT EXISTS crmWebhooks (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        events TEXT NOT NULL,
        secret TEXT,
        isActive INTEGER DEFAULT 1,
        lastFiredAt TEXT,
        failCount INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL
      )
    `);
    
    db.exec(`CREATE INDEX IF NOT EXISTS idx_crm_webhooks_active ON crmWebhooks(isActive)`);
  },
};
