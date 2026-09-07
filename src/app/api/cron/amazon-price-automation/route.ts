import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runAmazonPriceUpdate } from "@/lib/amazon-price-update";
import { notifyAmazonPriceAutomationSuccess, notifyAmazonPriceAutomationError } from "@/lib/notify";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function todayBRT(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function currentWeekdayBRT(): number {
  const short = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(new Date());
  return WEEKDAY_SHORT.indexOf(short);
}

/**
 * Invoked once a day by Vercel Cron (see vercel.json). Same guard structure as the
 * eBay cron. Unlike eBay, a scheduled run that trips a guardrail (>20%/24h or
 * >=500 listings) is NOT auto-confirmed — an unattended cron run has nobody to click
 * "confirm", so it's recorded as blocked and left for a human to review and run
 * manually with explicit confirmation.
 */
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
    .from("amazon_price_automation")
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
    const result = await runAmazonPriceUpdate({
      adjustment: parseFloat(settings.price_adjustment) || -0.01,
      testMode: false,
      confirmed: false,
    });

    if ("blocked" in result) {
      await supabase
        .from("amazon_price_automation")
        .update({
          last_run_at: new Date().toISOString(),
          last_run_status: "error",
          last_run_total: result.preview.length,
          last_run_updated: 0,
          last_run_error: "Bloqueado por guardrail — requer confirmação manual.",
        })
        .eq("id", settings.id);

      await supabase.from("amazon_price_automation_logs").insert({
        trigger: "scheduled",
        mode: "full",
        status: "blocked",
        total: result.preview.length,
        updated: 0,
        guardrail_flags: result.flags,
      });
      await notifyAmazonPriceAutomationError(
        "Execução automática bloqueada por guardrail (variação >20%/24h ou lote >=500). Revise manualmente.",
        "scheduled",
        "full"
      );

      return NextResponse.json({ skipped: false, blocked: true, flags: result.flags });
    }

    await supabase
      .from("amazon_price_automation")
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: "success",
        last_run_total: result.total,
        last_run_updated: result.updated,
        last_run_error: null,
      })
      .eq("id", settings.id);

    await supabase.from("amazon_price_automation_logs").insert({
      trigger: "scheduled",
      mode: "full",
      status: "success",
      total: result.total,
      updated: result.updated,
      products: result.products,
    });
    await notifyAmazonPriceAutomationSuccess(result, "scheduled", "full");

    return NextResponse.json({ skipped: false, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    await supabase
      .from("amazon_price_automation")
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: "error",
        last_run_total: null,
        last_run_updated: null,
        last_run_error: message,
      })
      .eq("id", settings.id);

    await supabase.from("amazon_price_automation_logs").insert({
      trigger: "scheduled",
      mode: "full",
      status: "error",
      error: message,
    });
    await notifyAmazonPriceAutomationError(message, "scheduled", "full");

    return NextResponse.json({ skipped: false, error: message }, { status: 502 });
  }
}
