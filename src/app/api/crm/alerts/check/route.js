import { NextResponse } from "next/server";
import {
  checkUsageAlerts, checkBalanceAlerts, checkStaledDeals, checkCloseApproachingDeals,
} from "@/lib/db";

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    let results = [];

    if (!type || type === "usage") {
      const usageAlerts = await checkUsageAlerts();
      results.push(...usageAlerts);
    }

    if (!type || type === "balance") {
      const balanceAlerts = await checkBalanceAlerts();
      results.push(...balanceAlerts);
    }

    if (!type || type === "deals") {
      const dealAlerts = await checkStaledDeals();
      results.push(...dealAlerts);
    }

    if (!type || type === "closing") {
      const closingAlerts = await checkCloseApproachingDeals();
      results.push(...closingAlerts);
    }

    return NextResponse.json({
      success: true,
      alertsCreated: results.length,
      alerts: results,
    });
  } catch (error) {
    console.error("POST /api/crm/alerts/check error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
