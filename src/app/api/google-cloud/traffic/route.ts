import { NextRequest, NextResponse } from "next/server";
import { runTrafficReport } from "@/lib/google-analytics-data-api";
import { getPropertyInfo } from "@/lib/google-analytics-admin-api";
import { requireAdmin } from "@/lib/admin-auth";

export const maxDuration = 30;

// Real traffic/revenue numbers — sensitive business data, checked server-side (see
// admin-auth.ts's own doc comment on why most admin routes don't).
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Não autorizado" }, { status: auth.status });

  const daysParam = request.nextUrl.searchParams.get("days");
  const days = daysParam === "7" || daysParam === "30" ? Number(daysParam) : 30;

  try {
    const [report, property] = await Promise.all([runTrafficReport(days), getPropertyInfo().catch(() => null)]);
    return NextResponse.json({
      ...report,
      totals: { ...report.totals, currency: property?.currencyCode ?? "" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("não configurado") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
