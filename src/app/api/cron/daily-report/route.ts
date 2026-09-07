import { NextRequest, NextResponse } from "next/server";
import { generateDailyReport, saveDailyReport } from "@/lib/daily-report";
import { notifyDailyReport } from "@/lib/notify";

export const maxDuration = 60;

/** Invoked once a day by Vercel Cron (see vercel.json), at 08:00 America/Sao_Paulo. */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  try {
    const result = await generateDailyReport();
    await saveDailyReport(result);

    const fmtUSD = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
    await notifyDailyReport({
      revenue: fmtUSD(result.data.sales.revenue),
      sessions: result.data.traffic.sessions,
      origin,
      reportDate: result.data.reportDate,
    });

    return NextResponse.json({ ok: true, reportDate: result.data.reportDate, insightsSource: result.insightsSource });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
