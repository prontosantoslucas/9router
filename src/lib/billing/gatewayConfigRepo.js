import { getAdapter } from "@/lib/db/driver.js";

export async function getGatewayConfig(gateway) {
  const db = await getAdapter();
  const row = db.get("SELECT * FROM gatewayConfig WHERE gateway = ?", [gateway]);
  if (!row) return null;
  return { gateway: row.gateway, enabled: !!row.enabled, data: JSON.parse(row.data || "{}"), updatedAt: row.updatedAt };
}

export async function getAllGatewayConfigs() {
  const db = await getAdapter();
  const rows = db.all("SELECT * FROM gatewayConfig");
  return rows.map(r => ({ gateway: r.gateway, enabled: !!r.enabled, data: JSON.parse(r.data || "{}"), updatedAt: r.updatedAt }));
}

export async function upsertGatewayConfig(gateway, { enabled, data }) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO gatewayConfig (gateway, enabled, data, updatedAt) VALUES (?, ?, ?, ?)
     ON CONFLICT(gateway) DO UPDATE SET enabled = excluded.enabled, data = excluded.data, updatedAt = excluded.updatedAt`,
    [gateway, enabled ? 1 : 0, JSON.stringify(data || {}), now]
  );
  return { gateway, enabled, data, updatedAt: now };
}

export async function deleteGatewayConfig(gateway) {
  const db = await getAdapter();
  db.run("DELETE FROM gatewayConfig WHERE gateway = ?", [gateway]);
}
