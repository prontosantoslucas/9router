import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/db/driver.js";
import { deleteContact } from "@/lib/db";

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, ids, tag, stage, status, priority, type = "contacts" } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids é obrigatório" }, { status: 400 });
    }

    const db = await getAdapter();

    if (action === "delete" && type === "deals") {
      db.transaction(() => {
        for (const id of ids) {
          db.run("DELETE FROM crmDeals WHERE id = ?", [id]);
        }
      });
      return NextResponse.json({ success: true, deleted: ids.length });
    }

    if (action === "delete") {
      for (const id of ids) {
        await deleteContact(id);
      }
      return NextResponse.json({ success: true, deleted: ids.length });
    }

    if (action === "add-tag" && tag) {
      const affected = [];
      db.transaction(() => {
        for (const id of ids) {
          const row = db.get("SELECT * FROM crmContacts WHERE id = ?", [id]);
          if (!row) continue;
          const tags = JSON.parse(row.tags || "[]");
          if (!tags.includes(tag)) tags.push(tag);
          db.run("UPDATE crmContacts SET tags = ?, updatedAt = ? WHERE id = ?", [
            JSON.stringify(tags),
            new Date().toISOString(),
            id,
          ]);
          affected.push(id);
        }
      });
      return NextResponse.json({ success: true, affected: affected.length });
    }

    if (action === "remove-tag" && tag) {
      const affected = [];
      db.transaction(() => {
        for (const id of ids) {
          const row = db.get("SELECT * FROM crmContacts WHERE id = ?", [id]);
          if (!row) continue;
          const tags = JSON.parse(row.tags || "[]").filter((t) => t !== tag);
          db.run("UPDATE crmContacts SET tags = ?, updatedAt = ? WHERE id = ?", [
            JSON.stringify(tags),
            new Date().toISOString(),
            id,
          ]);
          affected.push(id);
        }
      });
      return NextResponse.json({ success: true, affected: affected.length });
    }

    if (action === "set-status" && status) {
      const affected = [];
      db.transaction(() => {
        for (const id of ids) {
          const row = db.get("SELECT * FROM crmContacts WHERE id = ?", [id]);
          if (!row) continue;
          db.run("UPDATE crmContacts SET status = ?, updatedAt = ? WHERE id = ?", [
            status,
            new Date().toISOString(),
            id,
          ]);
          affected.push(id);
        }
      });
      return NextResponse.json({ success: true, affected: affected.length });
    }

    if (action === "set-priority" && priority) {
      const affected = [];
      db.transaction(() => {
        for (const id of ids) {
          const row = db.get("SELECT * FROM crmDeals WHERE id = ?", [id]);
          if (!row) continue;
          db.run("UPDATE crmDeals SET priority = ?, updatedAt = ? WHERE id = ?", [
            priority,
            new Date().toISOString(),
            id,
          ]);
          affected.push(id);
        }
      });
      return NextResponse.json({ success: true, affected: affected.length });
    }

    if (action === "move-deal" && stage) {
      const affected = [];
      db.transaction(() => {
        for (const id of ids) {
          const row = db.get("SELECT * FROM crmDeals WHERE id = ?", [id]);
          if (!row) continue;
          db.run("UPDATE crmDeals SET stage = ?, updatedAt = ? WHERE id = ?", [
            stage,
            new Date().toISOString(),
            id,
          ]);
          affected.push(id);
        }
      });
      return NextResponse.json({ success: true, affected: affected.length });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/crm/bulk error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}