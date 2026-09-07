import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { generateDailyReport, saveDailyReport } from "@/lib/daily-report";

export const maxDuration = 60;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Returns the requested day's saved report, or the most recent one if no ?date= is given.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const date = request.nextUrl.searchParams.get("date");
  const supabase = getSupabase();

  let query = supabase.from("daily_reports").select("*").order("report_date", { ascending: false }).limit(1);
  if (date) query = supabase.from("daily_reports").select("*").eq("report_date", date).limit(1);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ report: null });
  return NextResponse.json({ report: data[0] });
}

// Manual "Gerar agora" button on the report page — same generator the daily cron uses,
// just triggered on demand (and without sending a push, to avoid spamming the phone
// every time someone re-runs it for testing).
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  try {
    const result = await generateDailyReport();
    await saveDailyReport(result);
    return NextResponse.json({ ok: true, reportDate: result.data.reportDate });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
