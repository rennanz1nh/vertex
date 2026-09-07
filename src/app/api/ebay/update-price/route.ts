import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createClient } from "@supabase/supabase-js";
import { runEbayPriceUpdate } from "@/lib/ebay-price-update";
import { notifyPriceAutomationSuccess, notifyPriceAutomationError } from "@/lib/notify";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

// Best-effort — a progress-bar write failing should never interrupt the actual
// price update loop, so callers fire this without awaiting it.
function reportProgress(
  supabase: ReturnType<typeof getSupabase>,
  status: "running" | "done" | "error",
  completed: number,
  total: number
) {
  supabase
    .from("ebay_price_automation_progress")
    .upsert({ id: 1, status, completed, total, updated_at: new Date().toISOString() })
    .then(() => {}, () => {});
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const body = await request.json();
  const { adjustment = -0.01, fixedPrice, testMode = true, itemIds } = body;
  const hasSelection = Array.isArray(itemIds) && itemIds.length > 0;
  const mode = hasSelection ? "select" : testMode ? "test" : "full";
  const supabase = getSupabase();

  try {
    const summary = await runEbayPriceUpdate({
      adjustment,
      fixedPrice: typeof fixedPrice === "number" ? fixedPrice : undefined,
      testMode,
      itemIds: hasSelection ? itemIds : undefined,
      onProgress: (completed, total) => reportProgress(supabase, "running", completed, total),
    });

    reportProgress(supabase, "done", summary.total, summary.total);

    await supabase.from("ebay_price_automation_logs").insert({
      trigger: "manual",
      mode,
      status: "success",
      total: summary.total,
      updated: summary.updated,
      products: summary.products,
    });
    await notifyPriceAutomationSuccess(summary, "manual", mode);

    return NextResponse.json(summary);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("eBay token not found") || message.includes("reconnect")
      ? 401
      : message.includes("No active listings")
        ? 404
        : 502;

    reportProgress(supabase, "error", 0, 0);

    await supabase.from("ebay_price_automation_logs").insert({
      trigger: "manual",
      mode,
      status: "error",
      error: message,
    });
    await notifyPriceAutomationError(message, "manual", mode);

    return NextResponse.json({ error: message }, { status });
  }
}
