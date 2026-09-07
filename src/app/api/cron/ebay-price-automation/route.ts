import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runEbayPriceUpdate } from "@/lib/ebay-price-update";
import { notifyPriceAutomationSuccess, notifyPriceAutomationError } from "@/lib/notify";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

/** Today's date (YYYY-MM-DD) in America/Sao_Paulo, to compare against last_run_at. */
function todayBRT(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Current day of week in America/Sao_Paulo, as 0=Sunday..6=Saturday (matches JS Date.getDay()). */
function currentWeekdayBRT(): number {
  const short = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(new Date());
  return WEEKDAY_SHORT.indexOf(short);
}

/**
 * Invoked once a day by Vercel Cron (see vercel.json). On the Hobby plan Vercel only
 * allows once-per-day schedules and may fire anytime within the scheduled hour — so
 * this route itself decides whether to actually run (via the `enabled` flag) and
 * guards against double-execution on the same day.
 */
export async function GET(request: NextRequest) {
  // Vercel injects this header automatically when CRON_SECRET is configured on the project.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = getSupabase();
  const { data: settings, error: fetchError } = await supabase
    .from("ebay_price_automation")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (fetchError || !settings) {
    return NextResponse.json({ skipped: true, reason: "no settings row" });
  }

  if (!settings.enabled) {
    return NextResponse.json({ skipped: true, reason: "automation disabled" });
  }

  const activeWeekdays: number[] = settings.active_weekdays ?? [0, 1, 2, 3, 4, 5, 6];
  if (!activeWeekdays.includes(currentWeekdayBRT())) {
    return NextResponse.json({ skipped: true, reason: "not a scheduled weekday" });
  }

  const today = todayBRT();
  const lastRunDate = settings.last_run_at
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(settings.last_run_at))
    : null;
  if (lastRunDate === today) {
    return NextResponse.json({ skipped: true, reason: "already ran today" });
  }

  try {
    const summary = await runEbayPriceUpdate({
      adjustment: parseFloat(settings.price_adjustment) || -0.01,
      testMode: false,
    });

    await supabase
      .from("ebay_price_automation")
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: "success",
        last_run_total: summary.total,
        last_run_updated: summary.updated,
        last_run_error: null,
      })
      .eq("id", settings.id);

    await supabase.from("ebay_price_automation_logs").insert({
      trigger: "scheduled",
      mode: "full",
      status: "success",
      total: summary.total,
      updated: summary.updated,
      products: summary.products,
    });
    await notifyPriceAutomationSuccess(summary, "scheduled", "full");

    return NextResponse.json({ skipped: false, ...summary });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    await supabase
      .from("ebay_price_automation")
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: "error",
        last_run_total: null,
        last_run_updated: null,
        last_run_error: message,
      })
      .eq("id", settings.id);

    await supabase.from("ebay_price_automation_logs").insert({
      trigger: "scheduled",
      mode: "full",
      status: "error",
      error: message,
    });
    await notifyPriceAutomationError(message, "scheduled", "full");

    return NextResponse.json({ skipped: false, error: message }, { status: 502 });
  }
}
