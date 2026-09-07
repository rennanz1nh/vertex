import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runAmazonPriceUpdate } from "@/lib/amazon-price-update";
import { notifyAmazonPriceAutomationSuccess, notifyAmazonPriceAutomationError } from "@/lib/notify";
import { requireAdmin } from "@/lib/admin-auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const body = await request.json();
  const { adjustment = -0.01, fixedPrice, testMode = true, itemIds, confirmed = false } = body;
  const hasSelection = Array.isArray(itemIds) && itemIds.length > 0;
  const mode = hasSelection ? "select" : testMode ? "test" : "full";
  const supabase = getSupabase();

  try {
    const result = await runAmazonPriceUpdate({
      adjustment,
      fixedPrice: typeof fixedPrice === "number" ? fixedPrice : undefined,
      testMode,
      itemIds: hasSelection ? itemIds : undefined,
      confirmed,
    });

    if ("blocked" in result) {
      await supabase.from("amazon_price_automation_logs").insert({
        trigger: "manual",
        mode,
        status: "blocked",
        total: result.preview.length,
        updated: 0,
        guardrail_flags: result.flags,
      });
      return NextResponse.json(result, { status: 409 });
    }

    await supabase.from("amazon_price_automation_logs").insert({
      trigger: "manual",
      mode,
      status: "success",
      total: result.total,
      updated: result.updated,
      products: result.products,
    });
    await notifyAmazonPriceAutomationSuccess(result, "manual", mode);

    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("token not found") || message.includes("reconnect")
      ? 401
      : message.includes("No active listings")
        ? 404
        : 502;

    await supabase.from("amazon_price_automation_logs").insert({
      trigger: "manual",
      mode,
      status: "error",
      error: message,
    });
    await notifyAmazonPriceAutomationError(message, "manual", mode);

    return NextResponse.json({ error: message }, { status });
  }
}
