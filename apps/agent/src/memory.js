const db = require("./db");

function addCorrection(text) {
  db.prepare("INSERT INTO corrections (text) VALUES (?)").run(text.slice(0, 200));
}

function getRecentCorrections(n = 5) {
  const rows = db.prepare("SELECT text FROM corrections ORDER BY id DESC LIMIT ?").all(n);
  return rows.map((r) => r.text).reverse();
}

function getState() {
  return { corrections: getRecentCorrections(20) };
}

module.exports = { getState, addCorrection, getRecentCorrections };
