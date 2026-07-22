import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

function rowToPlan(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    priceCents: row.priceCents,
    currency: row.currency,
    durationDays: row.durationDays,
    tokenLimit: row.tokenLimit,
    costLimitCents: row.costLimitCents,
    rpm: row.rpm,
    allowedCombos: parseJson(row.allowedCombos, null),
    isActive: row.isActive === 1 || row.isActive === true,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getPlans() {
  const db = await getAdapter();
  let rows = db.all(`SELECT * FROM plans ORDER BY priceCents ASC`);
  if (rows.length === 0) {
    const defaultPlans = [
      { name: "Starter (Gratuito)", priceCents: 0, currency: "USD", durationDays: 30, tokenLimit: 100000, costLimitCents: 0, rpm: 60, isActive: 1 },
      { name: "Pro Developer", priceCents: 2990, currency: "USD", durationDays: 30, tokenLimit: 5000000, costLimitCents: 5000, rpm: 600, isActive: 1 },
      { name: "Enterprise AI", priceCents: 9990, currency: "USD", durationDays: 30, tokenLimit: 25000000, costLimitCents: 30000, rpm: 3000, isActive: 1 },
      { name: "Pay-As-You-Go", priceCents: 0, currency: "USD", durationDays: 365, tokenLimit: null, costLimitCents: null, rpm: 1200, isActive: 1 }
    ];
    const now = new Date().toISOString();
    for (const p of defaultPlans) {
      const id = uuidv4();
      db.run(
        `INSERT INTO plans(id, name, priceCents, currency, durationDays, tokenLimit, costLimitCents, rpm, allowedCombos, isActive, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, p.name, p.priceCents, p.currency, p.durationDays, p.tokenLimit, p.costLimitCents, p.rpm, null, p.isActive, now, now]
      );
    }
    rows = db.all(`SELECT * FROM plans ORDER BY priceCents ASC`);
  }
  return rows.map(rowToPlan);
}

export async function getPlanById(id) {
  const db = await getAdapter();
  return rowToPlan(db.get(`SELECT * FROM plans WHERE id = ?`, [id]));
}

export async function createPlan(data) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  const plan = {
    id: uuidv4(),
    name: data.name,
    priceCents: data.priceCents ?? 0,
    currency: data.currency || "USD",
    durationDays: data.durationDays,
    tokenLimit: data.tokenLimit ?? null,
    costLimitCents: data.costLimitCents ?? null,
    rpm: data.rpm ?? null,
    allowedCombos: data.allowedCombos ?? null,
    isActive: data.isActive !== false,
    createdAt: now,
    updatedAt: now,
  };
  if (!plan.durationDays) throw new Error("durationDays is required");
  db.run(
    `INSERT INTO plans(id, name, priceCents, currency, durationDays, tokenLimit, costLimitCents, rpm, allowedCombos, isActive, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [plan.id, plan.name, plan.priceCents, plan.currency, plan.durationDays, plan.tokenLimit, plan.costLimitCents, plan.rpm, stringifyJson(plan.allowedCombos), plan.isActive ? 1 : 0, plan.createdAt, plan.updatedAt]
  );
  return plan;
}

export async function updatePlan(id, data) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get(`SELECT * FROM plans WHERE id = ?`, [id]);
    if (!row) return;
    const merged = { ...rowToPlan(row), ...data, updatedAt: new Date().toISOString() };
    db.run(
      `UPDATE plans SET name = ?, priceCents = ?, currency = ?, durationDays = ?, tokenLimit = ?, costLimitCents = ?, rpm = ?, allowedCombos = ?, isActive = ?, updatedAt = ? WHERE id = ?`,
      [merged.name, merged.priceCents, merged.currency, merged.durationDays, merged.tokenLimit, merged.costLimitCents, merged.rpm, stringifyJson(merged.allowedCombos ?? null), merged.isActive ? 1 : 0, merged.updatedAt, id]
    );
    result = merged;
  });
  return result;
}

export async function deletePlan(id) {
  const db = await getAdapter();
  const res = db.run(`DELETE FROM plans WHERE id = ?`, [id]);
  return (res?.changes ?? 0) > 0;
}
