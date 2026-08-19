// Add contactId to apiKeys for CRM integration
export default {
  version: 3,
  name: "crm-apikeys-link",
  up(db) {
    const cols = db.all(`PRAGMA table_info(apiKeys)`) || [];
    const names = new Set(cols.map((c) => c.name));
    
    if (!names.has("contactId")) {
      db.exec(`ALTER TABLE apiKeys ADD COLUMN contactId TEXT`);
    }
    
    db.exec(`CREATE INDEX IF NOT EXISTS idx_ak_contact ON apiKeys(contactId)`);
  },
};
