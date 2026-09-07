import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createClient } from "@supabase/supabase-js";
import { runTikTokShopPriceUpdate } from "@/lib/tiktok-shop-price-update";
import { notifyTikTokShopPriceAutomationSuccess, notifyTikTokShopPriceAutomationError } from "@/lib/notify";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

function reportProgress(
  supabase: ReturnType<typeof getSupabase>,
  status: "running" | "done" | "error",
  completed: number,
  total: number
) {
  supabase
    .from("tiktok_shop_price_automation_progress")
    .upsert({ id: 1, status, completed, total, updated_at: new Date().toISOString() })
    .then(() => {}, () => {});
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const body = await request.json();
  const { adjustment = -0.01, fixedPrice, testMode = true, skuIds } = body;
  const hasSelection = Array.isArray(skuIds) && skuIds.length > 0;
  const mode = hasSelection ? "select" : testMode ? "test" : "full";
  const supabase = getSupabase();

  try {
    const summary = await runTikTokShopPriceUpdate({
      adjustment,
      fixedPrice: typeof fixedPrice === "number" ? fixedPrice : undefined,
      testMode,
      skuIds: hasSelection ? skuIds : undefined,
      onProgress: (completed, total) => reportProgress(supabase, "running", completed, total),
    });

    reportProgress(supabase, "done", summary.total, summary.total);

    await supabase.from("tiktok_shop_price_automation_logs").insert({
      trigger: "manual",
      mode,
      status: "success",
      total: summary.total,
      updated: summary.updated,
      products: summary.products,
    });
    await notifyTikTokShopPriceAutomationSuccess(summary, "manual", mode);

    return NextResponse.json(summary);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("not connected") || message.includes("reconnect")
      ? 401
      : message.includes("No active listings")
        ? 404
        : 502;

    reportProgress(supabase, "error", 0, 0);

    await supabase.from("tiktok_shop_price_automation_logs").insert({
      trigger: "manual",
      mode,
      status: "error",
      error: message,
    });
    await notifyTikTokShopPriceAutomationError(message, "manual", mode);

    return NextResponse.json({ error: message }, { status });
  }
}
