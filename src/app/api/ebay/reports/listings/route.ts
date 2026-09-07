import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { isReportPeriod } from "@/lib/report-periods";
import { fetchListingTrafficReport } from "@/lib/ebay-listing-traffic";

const TOP_N = 20;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const periodParam = request.nextUrl.searchParams.get("period");
  if (!isReportPeriod(periodParam)) {
    return NextResponse.json({ error: "period inválido (use today, yesterday, 7d, 30d ou 90d)" }, { status: 400 });
  }
  if (periodParam === "all") {
    return NextResponse.json({ error: "Período 'Todo' não é suportado no relatório de tráfego (limite de 90 dias da API do eBay)" }, { status: 400 });
  }

  try {
    const { report, stale, fetchedAt } = await fetchListingTrafficReport(periodParam);
    return NextResponse.json({ period: report.period, range: report.range, listings: report.listings.slice(0, TOP_N), stale, fetchedAt });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("eBay token not found") || message.includes("reconnect") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
