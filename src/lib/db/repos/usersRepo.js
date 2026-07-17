import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getUserById(id) {
  const db = await getAdapter();
  return rowToUser(db.get(`SELECT * FROM users WHERE id = ?`, [id]));
}

export async function getUserByEmail(email) {
  const db = await getAdapter();
  return rowToUser(db.get(`SELECT * FROM users WHERE email = ?`, [String(email).toLowerCase()]));
}

export async function createUser({ email, passwordHash = null, role = "user" }) {
  if (!email) throw new Error("email is required");
  const db = await getAdapter();
  const now = new Date().toISOString();
  const user = {
    id: uuidv4(),
    email: String(email).toLowerCase(),
    passwordHash,
    role,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  db.run(
    `INSERT INTO users(id, email, passwordHash, role, status, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?, ?)`,
    [user.id, user.email, user.passwordHash, user.role, user.status, user.createdAt, user.updatedAt]
  );
  return user;
}

export async function updateUser(id, data) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get(`SELECT * FROM users WHERE id = ?`, [id]);
    if (!row) return;
    const merged = { ...rowToUser(row), ...data, updatedAt: new Date().toISOString() };
    db.run(
      `UPDATE users SET email = ?, passwordHash = ?, role = ?, status = ?, updatedAt = ? WHERE id = ?`,
      [merged.email, merged.passwordHash, merged.role, merged.status, merged.updatedAt, id]
    );
    result = merged;
  });
  return result;
}

export async function getOrCreateUserByEmail(email, passwordHash = null) {
  const existing = await getUserByEmail(email);
  if (existing) return existing;
  return createUser({ email, passwordHash });
}
