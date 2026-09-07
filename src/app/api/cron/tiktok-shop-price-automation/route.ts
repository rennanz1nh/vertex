import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runTikTokShopPriceUpdate } from "@/lib/tiktok-shop-price-update";
import { notifyTikTokShopPriceAutomationSuccess, notifyTikTokShopPriceAutomationError } from "@/lib/notify";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

function todayBRT(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function currentWeekdayBRT(): number {
  const short = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(new Date());
  return WEEKDAY_SHORT.indexOf(short);
}

/** Invoked once a day by Vercel Cron (see vercel.json) — same guarded-run pattern as
 *  the eBay/Amazon price automation crons. */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = getSupabase();
  const { data: settings, error: fetchError } = await supabase
    .from("tiktok_shop_price_automation")
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
    const summary = await runTikTokShopPriceUpdate({
      adjustment: parseFloat(settings.price_adjustment) || -0.01,
      testMode: false,
    });

    await supabase
      .from("tiktok_shop_price_automation")
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: "success",
        last_run_total: summary.total,
        last_run_updated: summary.updated,
        last_run_error: null,
      })
      .eq("id", settings.id);

    await supabase.from("tiktok_shop_price_automation_logs").insert({
      trigger: "scheduled",
      mode: "full",
      status: "success",
      total: summary.total,
      updated: summary.updated,
      products: summary.products,
    });
    await notifyTikTokShopPriceAutomationSuccess(summary, "scheduled", "full");

    return NextResponse.json({ skipped: false, ...summary });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    await supabase
      .from("tiktok_shop_price_automation")
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: "error",
        last_run_total: null,
        last_run_updated: null,
        last_run_error: message,
      })
      .eq("id", settings.id);

    await supabase.from("tiktok_shop_price_automation_logs").insert({
      trigger: "scheduled",
      mode: "full",
      status: "error",
      error: message,
    });
    await notifyTikTokShopPriceAutomationError(message, "scheduled", "full");

    return NextResponse.json({ skipped: false, error: message }, { status: 502 });
  }
}
