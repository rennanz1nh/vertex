import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { fetchPerformanceReport } from "@/lib/google-shopping-feed";
import { getReportDateRange, isReportPeriod } from "@/lib/report-periods";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const periodParam = request.nextUrl.searchParams.get("period");
  if (!isReportPeriod(periodParam) || periodParam === "all") {
    return NextResponse.json({ error: "period inválido (use today, yesterday, 7d, 30d ou 90d)" }, { status: 400 });
  }

  try {
    const { start, end } = getReportDateRange(periodParam);
    const rows = await fetchPerformanceReport(start, end);

    const totals = rows.reduce(
      (acc, r) => ({ clicks: acc.clicks + r.clicks, impressions: acc.impressions + r.impressions }),
      { clicks: 0, impressions: 0 }
    );

    return NextResponse.json({
      period: periodParam,
      range: { start, end },
      clicks: totals.clicks,
      impressions: totals.impressions,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      products: rows.sort((a, b) => b.clicks - a.clicks),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("não conectada") || message.includes("não configurado") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
