import { NextResponse } from "next/server";
import {
  getPipelineStats,
  getConversionFunnel,
  getDealsTrend,
  getRevenueTrend,
  getStageVelocity,
  getTopContactsByRevenue,
  getTopContactsByUsage,
  getROIAnalysis,
  getForecast,
  getMonthComparison,
} from "@/lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const days = parseInt(searchParams.get("days") || "30");

    if (type === "pipeline") {
      const stats = await getPipelineStats();
      return NextResponse.json(stats);
    }

    if (type === "funnel") {
      const funnel = await getConversionFunnel();
      return NextResponse.json({ funnel });
    }

    if (type === "deals-trend") {
      const trend = await getDealsTrend(days);
      return NextResponse.json({ trend });
    }

    if (type === "revenue-trend") {
      const trend = await getRevenueTrend(days);
      return NextResponse.json({ trend });
    }

    if (type === "velocity") {
      const velocity = await getStageVelocity();
      return NextResponse.json({ velocity });
    }

    if (type === "top-revenue") {
      const limit = parseInt(searchParams.get("limit") || "10");
      const top = await getTopContactsByRevenue(limit);
      return NextResponse.json({ top });
    }

    if (type === "top-usage") {
      const limit = parseInt(searchParams.get("limit") || "10");
      const top = await getTopContactsByUsage(limit);
      return NextResponse.json({ top });
    }

    if (type === "roi") {
      const analysis = await getROIAnalysis();
      return NextResponse.json({ analysis });
    }

    if (type === "forecast") {
      const forecast = await getForecast();
      return NextResponse.json(forecast);
    }

    if (type === "comparison") {
      const comparison = await getMonthComparison();
      return NextResponse.json(comparison);
    }

    // Default: return all
    const [
      pipelineStats,
      funnel,
      forecast,
      comparison,
    ] = await Promise.all([
      getPipelineStats(),
      getConversionFunnel(),
      getForecast(),
      getMonthComparison(),
    ]);

    return NextResponse.json({
      pipeline: pipelineStats,
      funnel,
      forecast,
      comparison,
    });
  } catch (error) {
    console.error("GET /api/crm/analytics error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
