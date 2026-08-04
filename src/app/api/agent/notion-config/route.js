import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/localDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Caminho do SQLite do AGENTE (mesma lógica de apps/agent/src/db.js).
// O dashboard escreve direto nele porque o push HTTP pode falhar
// silenciosamente (agente em boot/restart) — assim o token SEMPRE
// chega no banco que o agente lê no boot via loadPersisted().
function agentDbPath() {
  const path = require("node:path");
  const os = require("node:os");
  const dataDir = process.env.DATA_DIR || path.join(os.homedir(), ".9router");
  return path.join(dataDir, "agent", "app.db");
}

function writeToAgentDb(token, databaseId) {
  try {
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(agentDbPath());
    db.exec(`
      CREATE TABLE IF NOT EXISTS notion_config (
        id INTEGER PRIMARY KEY,
        token TEXT NOT NULL DEFAULT '',
        database_id TEXT NOT NULL DEFAULT ''
      )
    `);
    db.prepare(
      "INSERT INTO notion_config (id, token, database_id) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET token = excluded.token, database_id = excluded.database_id"
    ).run(token || "", databaseId || "");
    db.close();
    return true;
  } catch (err) {
    console.error("[notion-config] falha ao escrever no DB do agente:", err.message);
    return false;
  }
}

// Lê a config direto do banco do agente — que é a fonte da verdade do que o
// agente realmente usa em runtime. As settings do dashboard podem estar
// dessincronizadas (ex.: instalação fresca, config feita antes desse endpoint
// espelhar no dashboard, DB do dashboard nem criado ainda).
function readFromAgentDb() {
  try {
    const fs = require("node:fs");
    const p = agentDbPath();
    if (!fs.existsSync(p)) return null;
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(p);
    let row = null;
    try {
      row = db.prepare("SELECT token, database_id FROM notion_config WHERE id = 1").get();
    } catch {}
    db.close();
    return row || null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const settings = await getSettings();
    let notionToken = settings?.notionToken || "";
    let notionDatabaseId = settings?.notionDatabaseId || "";
    let source = "dashboard";
    if (!notionToken || !notionDatabaseId) {
      const agentRow = readFromAgentDb();
      if (agentRow?.token) notionToken = notionToken || agentRow.token;
      if (agentRow?.database_id) notionDatabaseId = notionDatabaseId || agentRow.database_id;
      if (agentRow) source = "agent-db";
    }
    return NextResponse.json({
      configured: !!(notionToken && notionDatabaseId),
      hasToken: !!notionToken,
      hasDatabaseId: !!notionDatabaseId,
      source,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { token, databaseId } = await request.json();
    const settings = await getSettings();
    await updateSettings({
      ...settings,
      notionToken: token || "",
      notionDatabaseId: databaseId || "",
    });

    // 1) Escreve direto no SQLite do agente (sobrevive a restart).
    const persisted = writeToAgentDb(token, databaseId);

    // 2) Push HTTP pro agente em runtime (se estiver de pé).
    const agentUrl = process.env.AGENT_LOOPBACK_URL || "http://127.0.0.1:3717";
    fetch(`${agentUrl}/api/notion/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, databaseId }),
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      persistedToAgent: persisted,
      note: persisted
        ? "Config salva no dashboard e no banco do agente."
        : "Config salva no dashboard, mas não foi possível escrever no banco do agente.",
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}