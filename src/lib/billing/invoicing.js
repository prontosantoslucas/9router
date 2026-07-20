import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "@/lib/db/driver.js";

// Model pricing per 1K tokens (cents). Used when cost is not recorded in usageHistory.
const DEFAULT_RATES = {
  "gpt-4o": { input: 0.25, output: 1.0 },
  "gpt-4o-mini": { input: 0.015, output: 0.06 },
  "gpt-4": { input: 3.0, output: 6.0 },
  "gpt-3.5-turbo": { input: 0.05, output: 0.15 },
  "claude-3-opus": { input: 1.5, output: 7.5 },
  "claude-3-sonnet": { input: 0.3, output: 1.5 },
  "claude-3-haiku": { input: 0.025, output: 0.125 },
  "claude-3.5-sonnet": { input: 0.3, output: 1.5 },
  "deepseek-chat": { input: 0.027, output: 0.11 },
  "gemini-1.5-pro": { input: 0.125, output: 0.5 },
  "gemini-1.5-flash": { input: 0.0075, output: 0.03 },
  "mistral-large": { input: 0.2, output: 0.6 },
  "mistral-small": { input: 0.1, output: 0.3 },
};

function getRate(model) {
  const m = model?.toLowerCase() || "";
  for (const [pattern, rate] of Object.entries(DEFAULT_RATES)) {
    if (m.includes(pattern)) return rate;
  }
  return null;
}

// Aggregate usage for a user/time range and return line items
export function aggregateUsage(adapter, userId, periodStart, periodEnd) {
  const rows = adapter.all(
    `SELECT model, SUM(promptTokens) as pt, SUM(completionTokens) as ct, SUM(cost) as totalCost, COUNT(*) as requests
     FROM usageHistory
     WHERE userId = ? AND timestamp >= ? AND timestamp < ? AND model IS NOT NULL
     GROUP BY model`,
    [userId, periodStart, periodEnd]
  );

  const lines = [];
  let total = 0;
  for (const row of rows) {
    const model = row.model || "unknown";
    const pt = Number(row.pt) || 0;
    const ct = Number(row.ct) || 0;
    const recordedCost = Number(row.totalCost) || 0;
    const requests = Number(row.requests) || 0;

    let costCents;
    if (recordedCost > 0) {
      costCents = Math.round(recordedCost * 100);
    } else {
      const rate = getRate(model);
      costCents = rate
        ? Math.round((pt / 1000) * rate.input * 100 + (ct / 1000) * rate.output * 100)
        : 0;
    }

    if (costCents > 0) {
      const desc = `${model} — ${requests} reqs, ${pt} in / ${ct} out tokens`;
      lines.push({
        id: uuidv4(),
        description: desc,
        model,
        quantity: requests,
        unitPriceCents: Math.round(costCents / requests),
        amountCents: costCents,
      });
      total += costCents;
    }
  }
  return { lines, totalCents: total };
}

// Generate an invoice for a user/time period. Skips if invoice already exists.
export async function generateInvoice(userId, { subscriptionId, periodStart, periodEnd, description }) {
  const db = await getAdapter();
  const start = periodStart || new Date(Date.now() - 30 * 86400000).toISOString();
  const end = periodEnd || new Date().toISOString();

  // Check for duplicates
  const existing = db.get(
    `SELECT id FROM invoices WHERE userId = ? AND periodStart = ? AND periodEnd = ? AND status = 'pending'`,
    [userId, start, end]
  );
  if (existing) return { invoice: db.get("SELECT * FROM invoices WHERE id = ?", [existing.id]), duplicate: true };

  const { lines, totalCents } = aggregateUsage(db, userId, start, end);
  if (lines.length === 0) return { invoice: null, empty: true };

  const id = uuidv4();
  const now = new Date().toISOString();
  const desc = description || `Usage ${start.slice(0, 10)} — ${end.slice(0, 10)}`;

  db.transaction(() => {
    db.run(
      `INSERT INTO invoices(id, userId, subscriptionId, periodStart, periodEnd, totalCents, description, createdAt, status)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, userId, subscriptionId || null, start, end, totalCents, desc, now]
    );
    for (const line of lines) {
      db.run(
        `INSERT INTO invoiceLineItems(id, invoiceId, description, model, quantity, unitPriceCents, amountCents)
         VALUES(?, ?, ?, ?, ?, ?, ?)`,
        [line.id, id, line.description, line.model, line.quantity, line.unitPriceCents, line.amountCents]
      );
    }
  });

  const invoice = db.get("SELECT * FROM invoices WHERE id = ?", [id]);
  return { invoice, duplicate: false, lines };
}

// Mark invoice as paid
export async function markInvoicePaid(invoiceId) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  db.run("UPDATE invoices SET status = 'paid', paidAt = ? WHERE id = ?", [now, invoiceId]);
  return db.get("SELECT * FROM invoices WHERE id = ?", [invoiceId]);
}

// Get invoices with line items
export async function getInvoices(filters = {}) {
  const db = await getAdapter();
  const where = [];
  const params = [];
  if (filters.userId) { where.push("i.userId = ?"); params.push(filters.userId); }
  if (filters.status) { where.push("i.status = ?"); params.push(filters.status); }
  if (filters.subscriptionId) { where.push("i.subscriptionId = ?"); params.push(filters.subscriptionId); }
  const sql = "SELECT i.*, u.email FROM invoices i LEFT JOIN users u ON u.id = i.userId" + (where.length ? " WHERE " + where.join(" AND ") : "") + " ORDER BY i.createdAt DESC LIMIT 100";
  const invoices = db.all(sql, params);
  for (const inv of invoices) {
    inv.lineItems = db.all("SELECT * FROM invoiceLineItems WHERE invoiceId = ?", [inv.id]);
  }
  return invoices;
}

export async function getInvoice(id) {
  const db = await getAdapter();
  const inv = db.get("SELECT i.*, u.email FROM invoices i LEFT JOIN users u ON u.id = i.userId WHERE i.id = ?", [id]);
  if (inv) inv.lineItems = db.all("SELECT * FROM invoiceLineItems WHERE invoiceId = ?", [inv.id]);
  return inv;
}
