import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { isReportPeriod } from "@/lib/report-periods";
import { fetchCampaignReport } from "@/lib/ebay-campaign-report";

// Generating one funding model's report can take up to ~20s of polling (10 attempts x
// 2s) on top of the create/download calls. The two funding models (COST_PER_SALE and
// COST_PER_CLICK) now run concurrently (see ebay-campaign-report.ts), so total time is
// bounded by the slower one rather than their sum — still kept at the full 60s ceiling
// Hobby allows as a safety margin against a genuinely slow eBay report queue.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const periodParam = request.nextUrl.searchParams.get("period");
  if (!isReportPeriod(periodParam)) {
    return NextResponse.json({ error: "period inválido (use today, yesterday, 7d ou 30d)" }, { status: 400 });
  }
  if (periodParam === "90d" || periodParam === "all") {
    return NextResponse.json({ error: "Período não suportado no relatório de campanhas" }, { status: 400 });
  }

  try {
    const { report, stale, fetchedAt } = await fetchCampaignReport(periodParam);
    return NextResponse.json({ ...report, stale, fetchedAt });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("eBay token not found") || message.includes("reconnect") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
