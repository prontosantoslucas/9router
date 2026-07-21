const db = require("./db");

function save(text, tags = [], source = "agent") {
  db.prepare("INSERT INTO memories (text, tags, source) VALUES (?, ?, ?)").run(
    text, JSON.stringify(tags), source
  );
}

function search(query, limit = 10) {
  const rows = db.prepare(
    "SELECT * FROM memories WHERE text LIKE ? ORDER BY created_at DESC LIMIT ?"
  ).all(`%${query}%`, limit);
  return rows.map(r => ({ ...r, tags: JSON.parse(r.tags || "[]") }));
}

function recent(limit = 10) {
  const rows = db.prepare("SELECT * FROM memories ORDER BY created_at DESC LIMIT ?").all(limit);
  return rows.map(r => ({ ...r, tags: JSON.parse(r.tags || "[]") }));
}

function remove(id) {
  db.prepare("DELETE FROM memories WHERE id = ?").run(id);
}

module.exports = { save, search, recent, remove };
