// Add checkout and integration tables for public billing
export default {
  version: 5,
  name: "crm-billing-external",
  up(db) {
    // Payment integrations (Stripe, PayPal, Mercado Pago)
    db.exec(`
      CREATE TABLE IF NOT EXISTS crmIntegrations (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL, -- stripe, paypal, mercadolivre
        name TEXT,
        config TEXT NOT NULL, -- JSON blob with keys/secrets
        isActive INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    // Public checkout sessions
    db.exec(`
      CREATE TABLE IF NOT EXISTS crmCheckouts (
        id TEXT PRIMARY KEY,
        contactId TEXT NOT NULL,
        dealId TEXT,
        integrationId TEXT NOT NULL,
        amountCents INTEGER NOT NULL,
        currency TEXT DEFAULT 'BRL',
        description TEXT,
        status TEXT DEFAULT 'pending', -- pending, paid, cancelled, expired
        externalRef TEXT, -- Stripe session ID, ML pref ID, etc.
        expiresAt TEXT,
        createdAt TEXT NOT NULL,
        paidAt TEXT,
        metadata TEXT DEFAULT '{}',
        FOREIGN KEY(contactId) REFERENCES crmContacts(id)
      )
    `);
    
    db.exec(`CREATE INDEX IF NOT EXISTS idx_crm_checkouts_status ON crmCheckouts(status)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_crm_checkouts_contact ON crmCheckouts(contactId)`);
  },
};
