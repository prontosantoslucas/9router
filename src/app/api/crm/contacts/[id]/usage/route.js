import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/db/driver.js";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");
    
    const db = await getAdapter();
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startISO = startDate.toISOString();
    
    // Get usage by API keys linked to this contact
    const usage = db.all(
      `SELECT 
        DATE(timestamp) as date,
        provider,
        model,
        SUM(promptTokens) as promptTokens,
        SUM(completionTokens) as completionTokens,
        SUM(cost) as cost,
        COUNT(*) as requests
      FROM usageHistory
      WHERE apiKey IN (SELECT key FROM apiKeys WHERE contactId = ?)
        AND timestamp >= ?
      GROUP BY DATE(timestamp), provider, model
      ORDER BY date DESC`,
      [id, startISO]
    );
    
    // Get total stats
    const totals = db.get(
      `SELECT 
        SUM(promptTokens) as totalPromptTokens,
        SUM(completionTokens) as totalCompletionTokens,
        SUM(cost) as totalCost,
        COUNT(*) as totalRequests
      FROM usageHistory
      WHERE apiKey IN (SELECT key FROM apiKeys WHERE contactId = ?)
        AND timestamp >= ?`,
      [id, startISO]
    );
    
    // Get usage by endpoint
    const byEndpoint = db.all(
      `SELECT 
        endpoint,
        COUNT(*) as requests,
        SUM(cost) as cost
      FROM usageHistory
      WHERE apiKey IN (SELECT key FROM apiKeys WHERE contactId = ?)
        AND timestamp >= ?
      GROUP BY endpoint
      ORDER BY requests DESC
      LIMIT 10`,
      [id, startISO]
    );
    
    // Get usage by day (for chart)
    const byDay = db.all(
      `SELECT 
        DATE(timestamp) as date,
        COUNT(*) as requests,
        SUM(cost) as cost,
        SUM(promptTokens + completionTokens) as tokens
      FROM usageHistory
      WHERE apiKey IN (SELECT key FROM apiKeys WHERE contactId = ?)
        AND timestamp >= ?
      GROUP BY DATE(timestamp)
      ORDER BY date ASC`,
      [id, startISO]
    );

    return NextResponse.json({
      usage,
      totals: totals || {
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalCost: 0,
        totalRequests: 0,
      },
      byEndpoint,
      byDay,
    });
  } catch (error) {
    console.error("GET /api/crm/contacts/[id]/usage error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
