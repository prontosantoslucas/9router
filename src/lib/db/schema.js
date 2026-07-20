// Ã¢Å¡Â Ã¯Â¸Â AGENT/DEV: Bump this by +1 EVERY TIME you change the schema below
// (add/remove/alter a table, column, or index in TABLES). It drives the
// pre-change safety backup in migrate.js: when the stored version is lower,
// one lightweight DB backup is taken before applying schema changes. Forgetting
// to bump only skips that backup Ã¢â‚¬â€ it does NOT break the additive auto-sync.
export const SCHEMA_VERSION = 7;

export const PRAGMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 30000000;
PRAGMA cache_size = -64000;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
`;

// Declarative current schema. Used by syncSchemaFromTables() to
// auto-add missing tables/columns/indexes after versioned migrations.
// For destructive changes (drop/rename/type-change), write a migration file.
export const TABLES = {
  _meta: {
    columns: {
      key: "TEXT PRIMARY KEY",
      value: "TEXT NOT NULL",
    },
  },
  settings: {
    columns: {
      id: "INTEGER PRIMARY KEY CHECK (id = 1)",
      data: "TEXT NOT NULL",
    },
  },
  providerConnections: {
    columns: {
      id: "TEXT PRIMARY KEY",
      provider: "TEXT NOT NULL",
      authType: "TEXT NOT NULL",
      name: "TEXT",
      email: "TEXT",
      priority: "INTEGER",
      isActive: "INTEGER DEFAULT 1",
      data: "TEXT NOT NULL",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_pc_provider ON providerConnections(provider)",
      "CREATE INDEX IF NOT EXISTS idx_pc_provider_active ON providerConnections(provider, isActive)",
      "CREATE INDEX IF NOT EXISTS idx_pc_priority ON providerConnections(provider, priority)",
    ],
  },
  providerNodes: {
    columns: {
      id: "TEXT PRIMARY KEY",
      type: "TEXT",
      name: "TEXT",
      data: "TEXT NOT NULL",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: ["CREATE INDEX IF NOT EXISTS idx_pn_type ON providerNodes(type)"],
  },
  proxyPools: {
    columns: {
      id: "TEXT PRIMARY KEY",
      isActive: "INTEGER DEFAULT 1",
      testStatus: "TEXT",
      data: "TEXT NOT NULL",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_pp_active ON proxyPools(isActive)",
      "CREATE INDEX IF NOT EXISTS idx_pp_status ON proxyPools(testStatus)",
    ],
  },
  apiKeys: {
    columns: {
      id: "TEXT PRIMARY KEY",
      key: "TEXT UNIQUE NOT NULL",
      name: "TEXT",
      machineId: "TEXT",
      isActive: "INTEGER DEFAULT 1",
      createdAt: "TEXT NOT NULL",
      userId: "TEXT",
      planId: "TEXT",
      label: "TEXT",
      balanceCents: "INTEGER DEFAULT 0",
      tokenBalance: "INTEGER",
      periodStart: "TEXT",
      periodEnd: "TEXT",
      revokedAt: "TEXT",
      boundIp: "TEXT",
      bannedAt: "TEXT",
      banReason: "TEXT",
      strikeCount: "INTEGER DEFAULT 0",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_ak_key ON apiKeys(key)",
      "CREATE INDEX IF NOT EXISTS idx_ak_user ON apiKeys(userId)",
      "CREATE INDEX IF NOT EXISTS idx_ak_period ON apiKeys(periodEnd)",
    ],
  },
  combos: {
    columns: {
      id: "TEXT PRIMARY KEY",
      name: "TEXT UNIQUE NOT NULL",
      kind: "TEXT",
      models: "TEXT NOT NULL",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: ["CREATE INDEX IF NOT EXISTS idx_combo_name ON combos(name)"],
  },
  kv: {
    columns: {
      scope: "TEXT NOT NULL",
      key: "TEXT NOT NULL",
      value: "TEXT NOT NULL",
    },
    primaryKey: "PRIMARY KEY (scope, key)",
    indexes: ["CREATE INDEX IF NOT EXISTS idx_kv_scope ON kv(scope)"],
  },
  usageHistory: {
    columns: {
      id: "INTEGER PRIMARY KEY AUTOINCREMENT",
      timestamp: "TEXT NOT NULL",
      provider: "TEXT",
      model: "TEXT",
      connectionId: "TEXT",
      apiKey: "TEXT",
      userId: "TEXT",
      endpoint: "TEXT",
      promptTokens: "INTEGER DEFAULT 0",
      completionTokens: "INTEGER DEFAULT 0",
      cost: "REAL DEFAULT 0",
      status: "TEXT",
      tokens: "TEXT",
      meta: "TEXT",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_uh_ts ON usageHistory(timestamp DESC)",
      "CREATE INDEX IF NOT EXISTS idx_uh_provider ON usageHistory(provider)",
      "CREATE INDEX IF NOT EXISTS idx_uh_model ON usageHistory(model)",
      "CREATE INDEX IF NOT EXISTS idx_uh_conn ON usageHistory(connectionId)",
      "CREATE INDEX IF NOT EXISTS idx_uh_user_ts ON usageHistory(userId, timestamp DESC)",
    ],
  },
  usageDaily: {
    columns: {
      dateKey: "TEXT PRIMARY KEY",
      data: "TEXT NOT NULL",
    },
  },
  requestDetails: {
    columns: {
      id: "TEXT PRIMARY KEY",
      timestamp: "TEXT NOT NULL",
      provider: "TEXT",
      model: "TEXT",
      connectionId: "TEXT",
      status: "TEXT",
      data: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_rd_ts ON requestDetails(timestamp DESC)",
      "CREATE INDEX IF NOT EXISTS idx_rd_provider ON requestDetails(provider)",
      "CREATE INDEX IF NOT EXISTS idx_rd_model ON requestDetails(model)",
      "CREATE INDEX IF NOT EXISTS idx_rd_conn ON requestDetails(connectionId)",
    ],
  },
  conversations: {
    columns: {
      id: "TEXT PRIMARY KEY",
      title: "TEXT",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_conv_updated ON conversations(updatedAt DESC)",
    ],
  },
  conversationMessages: {
    columns: {
      id: "INTEGER PRIMARY KEY AUTOINCREMENT",
      conversationId: "TEXT NOT NULL",
      role: "TEXT NOT NULL",
      content: "TEXT NOT NULL",
      createdAt: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_cm_conv ON conversationMessages(conversationId, id ASC)",
    ],
  },
  users: {
    columns: {
      id: "TEXT PRIMARY KEY",
      email: "TEXT UNIQUE NOT NULL",
      passwordHash: "TEXT",
      role: "TEXT DEFAULT 'user'",
      status: "TEXT DEFAULT 'active'",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: ["CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)"],
  },
  plans: {
    columns: {
      id: "TEXT PRIMARY KEY",
      name: "TEXT UNIQUE NOT NULL",
      priceCents: "INTEGER DEFAULT 0",
      currency: "TEXT DEFAULT 'USD'",
      durationDays: "INTEGER NOT NULL",
      tokenLimit: "INTEGER",
      costLimitCents: "INTEGER",
      rpm: "INTEGER",
      allowedCombos: "TEXT",
      isActive: "INTEGER DEFAULT 1",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: ["CREATE INDEX IF NOT EXISTS idx_plans_active ON plans(isActive)"],
  },
  subscriptions: {
    columns: {
      id: "TEXT PRIMARY KEY",
      userId: "TEXT NOT NULL",
      planId: "TEXT NOT NULL",
      gateway: "TEXT NOT NULL",
      externalId: "TEXT",
      status: "TEXT DEFAULT 'active'",
      currentPeriodEnd: "TEXT",
      data: "TEXT",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_sub_user ON subscriptions(userId)",
      "CREATE INDEX IF NOT EXISTS idx_sub_ext ON subscriptions(gateway, externalId)",
    ],
  },
  payments: {
    columns: {
      id: "TEXT PRIMARY KEY",
      userId: "TEXT",
      apiKeyId: "TEXT",
      subscriptionId: "TEXT",
      planId: "TEXT",
      gateway: "TEXT NOT NULL",
      externalId: "TEXT",
      amountCents: "INTEGER DEFAULT 0",
      currency: "TEXT DEFAULT 'USD'",
      status: "TEXT DEFAULT 'pending'",
      createdAt: "TEXT NOT NULL",
      raw: "TEXT",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_pay_user ON payments(userId)",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_pay_ext ON payments(gateway, externalId)",
    ],
  },
  webhookEvents: {
    columns: {
      id: "TEXT PRIMARY KEY",
      gateway: "TEXT NOT NULL",
      externalId: "TEXT NOT NULL",
      type: "TEXT",
      processedAt: "TEXT NOT NULL",
    },
    indexes: ["CREATE UNIQUE INDEX IF NOT EXISTS idx_wh_ext ON webhookEvents(gateway, externalId)"],
  },
  gatewayConfig: {
    columns: {
      gateway: "TEXT PRIMARY KEY",
      enabled: "INTEGER DEFAULT 0",
      data: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
  },
  keyIpLog: {
    columns: {
      id: "TEXT PRIMARY KEY",
      apiKeyId: "TEXT NOT NULL",
      ip: "TEXT NOT NULL",
      firstSeen: "TEXT NOT NULL",
      lastSeen: "TEXT NOT NULL",
      hitCount: "INTEGER DEFAULT 0",
    },
    indexes: ["CREATE UNIQUE INDEX IF NOT EXISTS idx_kip_key_ip ON keyIpLog(apiKeyId, ip)"],
  },
  banEvents: {
    columns: {
      id: "TEXT PRIMARY KEY",
      apiKeyId: "TEXT NOT NULL",
      ip: "TEXT",
      reason: "TEXT",
      createdAt: "TEXT NOT NULL",
    },
    indexes: ["CREATE INDEX IF NOT EXISTS idx_ban_key ON banEvents(apiKeyId)"],
  },
  crmContacts: {
    columns: {
      id: "TEXT PRIMARY KEY",
      userId: "TEXT",
      name: "TEXT NOT NULL",
      email: "TEXT",
      phone: "TEXT",
      company: "TEXT",
      tags: "TEXT DEFAULT '[]'",
      notes: "TEXT",
      source: "TEXT",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: ["CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crmContacts(email)"],
  },
  crmDeals: {
    columns: {
      id: "TEXT PRIMARY KEY",
      contactId: "TEXT NOT NULL",
      title: "TEXT NOT NULL",
      valueCents: "INTEGER DEFAULT 0",
      currency: "TEXT DEFAULT 'USD'",
      stage: "TEXT NOT NULL DEFAULT 'lead'",
      source: "TEXT",
      notes: "TEXT",
      closedAt: "TEXT",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: ["CREATE INDEX IF NOT EXISTS idx_crm_deals_contact ON crmDeals(contactId)", "CREATE INDEX IF NOT EXISTS idx_crm_deals_stage ON crmDeals(stage)"],
  },
  crmActivities: {
    columns: {
      id: "TEXT PRIMARY KEY",
      contactId: "TEXT NOT NULL",
      dealId: "TEXT",
      type: "TEXT NOT NULL",
      description: "TEXT",
      metadata: "TEXT DEFAULT '{}'",
      createdAt: "TEXT NOT NULL",
    },
    indexes: ["CREATE INDEX IF NOT EXISTS idx_crm_activities_contact ON crmActivities(contactId)"],
  },
  scannedKeys: {
    columns: {
      id: "TEXT PRIMARY KEY",
      key: "TEXT NOT NULL UNIQUE",
      provider: "TEXT NOT NULL DEFAULT 'openai'",
      status: "TEXT NOT NULL",
      source: "TEXT",
      repoUrl: "TEXT",
      filePath: "TEXT",
      scanDate: "TEXT NOT NULL",
      rawResponse: "TEXT",
      notified: "INTEGER DEFAULT 0",
    },
    indexes: ["CREATE INDEX IF NOT EXISTS idx_scanned_keys_status ON scannedKeys(status)", "CREATE INDEX IF NOT EXISTS idx_scanned_keys_provider ON scannedKeys(provider)", "CREATE INDEX IF NOT EXISTS idx_scanned_keys_notified ON scannedKeys(notified, status)"],
  },
  invoices: {
    columns: {
      id: "TEXT PRIMARY KEY",
      userId: "TEXT NOT NULL",
      subscriptionId: "TEXT",
      periodStart: "TEXT NOT NULL",
      periodEnd: "TEXT NOT NULL",
      totalCents: "INTEGER DEFAULT 0",
      currency: "TEXT DEFAULT 'USD'",
      status: "TEXT DEFAULT 'pending'",
      description: "TEXT",
      createdAt: "TEXT NOT NULL",
      paidAt: "TEXT",
    },
    indexes: ["CREATE INDEX IF NOT EXISTS idx_inv_user ON invoices(userId)", "CREATE INDEX IF NOT EXISTS idx_inv_status ON invoices(status)", "CREATE INDEX IF NOT EXISTS idx_inv_sub ON invoices(subscriptionId)"],
  },
  invoiceLineItems: {
    columns: {
      id: "TEXT PRIMARY KEY",
      invoiceId: "TEXT NOT NULL",
      description: "TEXT NOT NULL",
      model: "TEXT",
      quantity: "INTEGER DEFAULT 1",
      unitPriceCents: "INTEGER DEFAULT 0",
      amountCents: "INTEGER NOT NULL",
    },
    indexes: ["CREATE INDEX IF NOT EXISTS idx_ili_inv ON invoiceLineItems(invoiceId)"],
  },
};

export function buildCreateTableSql(name, def) {
  const cols = Object.entries(def.columns).map(([k, v]) => `${k} ${v}`);
  if (def.primaryKey) cols.push(def.primaryKey);
  return `CREATE TABLE IF NOT EXISTS ${name} (${cols.join(", ")})`;
}
