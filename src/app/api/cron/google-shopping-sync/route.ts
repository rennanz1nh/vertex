import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncCatalogToGoogleShopping } from "@/lib/google-shopping-feed";
import { notifyGoogleShoppingSyncSuccess, notifyGoogleShoppingSyncError } from "@/lib/notify";
import { computeSyncStatus } from "@/lib/sync-status";

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

/**
 * Invoked once a day by Vercel Cron (see vercel.json), same guard structure as the
 * eBay/Amazon crons (enabled flag + one run per day). This once-a-day cadence isn't just
 * a Vercel Hobby-plan limitation here — the Merchant API's product update quota is
 * capped at roughly 2x the account's offer count per day (a hard limit Google does not
 * raise on request), so this route MUST NOT be wired to run more than once daily, and a
 * manual "Executar Agora" click on top of it can push a small catalog over that cap.
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
    .from("google_shopping_sync_automation")
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
    const result = await syncCatalogToGoogleShopping({ testMode: false });
    const status = computeSyncStatus(result.synced, result.total);

    await supabase
      .from("google_shopping_sync_automation")
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: status,
        last_run_total: result.total,
        last_run_synced: result.synced,
        last_run_error: null,
      })
      .eq("id", settings.id);

    await supabase.from("google_shopping_sync_logs").insert({
      trigger: "scheduled",
      mode: "full",
      status,
      total: result.total,
      synced: result.synced,
      products: result.products,
    });
    if (status === "success") {
      await notifyGoogleShoppingSyncSuccess(result, "scheduled", "full");
    } else {
      const failed = result.total - result.synced;
      await notifyGoogleShoppingSyncError(
        `${failed}/${result.total} produto(s) recusado(s) pelo Google`,
        "scheduled",
        "full"
      );
    }

    return NextResponse.json({ skipped: false, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    await supabase
      .from("google_shopping_sync_automation")
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: "error",
        last_run_total: null,
        last_run_synced: null,
        last_run_error: message,
      })
      .eq("id", settings.id);

    await supabase.from("google_shopping_sync_logs").insert({
      trigger: "scheduled",
      mode: "full",
      status: "error",
      error: message,
    });
    await notifyGoogleShoppingSyncError(message, "scheduled", "full");

    return NextResponse.json({ skipped: false, error: message }, { status: 502 });
  }
}
