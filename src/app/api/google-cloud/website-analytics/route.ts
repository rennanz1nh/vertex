import { NextRequest, NextResponse } from "next/server";
import {
  runTrafficReport,
  runTrafficSourcesReport,
  runTopPagesReport,
  runGeographyReport,
  runEngagementReport,
  runButtonClicksReport,
  runPreviousPeriodTotals,
} from "@/lib/google-analytics-data-api";
import { requireAdmin } from "@/lib/admin-auth";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Não autorizado" }, { status: auth.status });

  const daysParam = request.nextUrl.searchParams.get("days");
  const days = daysParam === "1" || daysParam === "7" || daysParam === "30" ? Number(daysParam) : 30;

  try {
    const [traffic, sources, pages, geography, engagement, buttonClicksResult, previous] = await Promise.all([
      runTrafficReport(days),
      runTrafficSourcesReport(days),
      runTopPagesReport(days),
      runGeographyReport(days),
      runEngagementReport(days),
      // Doesn't fail the whole page if the custom dimension isn't registered yet — just
      // comes back empty with a note so the UI can prompt for setup instead of erroring out.
      runButtonClicksReport(days).catch((e: unknown) => ({ error: e instanceof Error ? e.message : String(e) })),
      // Same story: the %-change stat is a nice-to-have, never worth failing the whole report over.
      runPreviousPeriodTotals(days).catch(() => null),
    ]);

    const buttonClicks = Array.isArray(buttonClicksResult) ? buttonClicksResult : [];
    const buttonClicksError = Array.isArray(buttonClicksResult) ? null : buttonClicksResult.error;

    return NextResponse.json({
      sessions: traffic.totals.sessions,
      activeUsers: traffic.totals.activeUsers,
      daily: traffic.daily.map((d) => ({ date: d.date, sessions: d.sessions, activeUsers: d.activeUsers })),
      engagement,
      sources,
      pages,
      geography,
      buttonClicks,
      buttonClicksError,
      previous: previous ? { sessions: previous.sessions, activeUsers: previous.activeUsers } : null,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("não configurado") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
