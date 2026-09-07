import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { querySearchAnalytics, searchConsoleErrorStatus } from "@/lib/search-console-api";
import { getReportDateRange, isReportPeriod } from "@/lib/report-periods";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const periodParam = request.nextUrl.searchParams.get("period");
  const dimensionParam = request.nextUrl.searchParams.get("dimension") ?? "query";

  if (!isReportPeriod(periodParam) || periodParam === "all") {
    return NextResponse.json({ error: "period inválido (use today, yesterday, 7d ou 30d)" }, { status: 400 });
  }
  if (dimensionParam !== "query" && dimensionParam !== "page") {
    return NextResponse.json({ error: "dimension inválida (use query ou page)" }, { status: 400 });
  }

  try {
    const { start, end } = getReportDateRange(periodParam);

    const [totalsRows, breakdownRows] = await Promise.all([
      querySearchAnalytics(start, end, [], 1),
      querySearchAnalytics(start, end, [dimensionParam], 25),
    ]);

    const totals = totalsRows[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 };

    return NextResponse.json({
      period: periodParam,
      range: { start, end },
      clicks: totals.clicks,
      impressions: totals.impressions,
      ctr: totals.ctr * 100,
      position: totals.position,
      dimension: dimensionParam,
      rows: breakdownRows
        .map((r) => ({ key: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr * 100, position: r.position }))
        .sort((a, b) => b.clicks - a.clicks),
    });
  } catch (e: unknown) {
    const { status, message } = searchConsoleErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }
}
