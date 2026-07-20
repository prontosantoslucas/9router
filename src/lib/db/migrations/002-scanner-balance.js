// Add balance tracking to scannedKeys so the notification filter can skip
// keys that are valid but empty ($0 credit = no financial risk to owner).
export default {
  version: 2,
  name: "scanner-balance",
  up(db) {
    const cols = db.all(`PRAGMA table_info(scannedKeys)`) || [];
    const names = new Set(cols.map((c) => c.name));
    if (!names.has("balanceInfo")) {
      db.exec(`ALTER TABLE scannedKeys ADD COLUMN balanceInfo TEXT`);
    }
    if (!names.has("worthNotify")) {
      db.exec(`ALTER TABLE scannedKeys ADD COLUMN worthNotify INTEGER DEFAULT 0`);
    }
    db.exec(`CREATE INDEX IF NOT EXISTS idx_scanned_keys_worth ON scannedKeys(worthNotify, notified)`);
  },
};
