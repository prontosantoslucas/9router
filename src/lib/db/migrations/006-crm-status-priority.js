// Add contact status (Monday-style lifecycle) and deal priority (Plane-style)
export default {
  version: 6,
  name: "crm-status-priority",
  up(db) {
    // Contact lifecycle: lead, prospect, customer, inactive
    const contactCols = db
      .all(`PRAGMA table_info(crmContacts)`)
      .map((c) => c.name);
    if (!contactCols.includes("status")) {
      db.exec(`ALTER TABLE crmContacts ADD COLUMN status TEXT DEFAULT 'lead'`);
    }
    db.exec(`CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON crmContacts(status)`);

    // Deal priority: none, low, medium, high, urgent
    const dealCols = db.all(`PRAGMA table_info(crmDeals)`).map((c) => c.name);
    if (!dealCols.includes("priority")) {
      db.exec(`ALTER TABLE crmDeals ADD COLUMN priority TEXT DEFAULT 'none'`);
    }
    db.exec(`CREATE INDEX IF NOT EXISTS idx_crm_deals_priority ON crmDeals(priority)`);
  },
};