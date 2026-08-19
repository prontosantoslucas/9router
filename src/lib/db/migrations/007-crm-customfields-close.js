// Contact custom fields (JSON object) + deal expected close date for calendar view
export default {
  version: 7,
  name: "crm-customfields-close-date",
  up(db) {
    const contactCols = db
      .all(`PRAGMA table_info(crmContacts)`)
      .map((c) => c.name);
    if (!contactCols.includes("customFields")) {
      db.exec(`ALTER TABLE crmContacts ADD COLUMN customFields TEXT DEFAULT '{}'`);
    }

    const dealCols = db.all(`PRAGMA table_info(crmDeals)`).map((c) => c.name);
    if (!dealCols.includes("expectedCloseAt")) {
      db.exec(`ALTER TABLE crmDeals ADD COLUMN expectedCloseAt TEXT`);
    }
    db.exec(`CREATE INDEX IF NOT EXISTS idx_crm_deals_close ON crmDeals(expectedCloseAt)`);
  },
};