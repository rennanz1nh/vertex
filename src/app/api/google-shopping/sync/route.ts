import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createClient } from "@supabase/supabase-js";
import { syncCatalogToGoogleShopping } from "@/lib/google-shopping-feed";
import { notifyGoogleShoppingSyncSuccess, notifyGoogleShoppingSyncError } from "@/lib/notify";
import { computeSyncStatus } from "@/lib/sync-status";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

/**
 * Manual trigger for the feed sync — mirrors amazon/update-price's shape (test/full/select
 * modes shared with the cron), minus the price-change guardrails: there's no repricing
 * here, just pushing the store's real price/stock/availability, so there's nothing to
 * confirm before running.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const body = await request.json();
  const { testMode = true, skus } = body;
  const hasSelection = Array.isArray(skus) && skus.length > 0;
  const mode = hasSelection ? "select" : testMode ? "test" : "full";
  const supabase = getSupabase();

  try {
    const result = await syncCatalogToGoogleShopping({ skus: hasSelection ? skus : undefined, testMode });
    const status = computeSyncStatus(result.synced, result.total);

    await supabase.from("google_shopping_sync_logs").insert({
      trigger: "manual",
      mode,
      status,
      total: result.total,
      synced: result.synced,
      products: result.products,
    });
    if (status === "success") {
      await notifyGoogleShoppingSyncSuccess(result, "manual", mode);
    } else {
      const failed = result.total - result.synced;
      await notifyGoogleShoppingSyncError(
        `${failed}/${result.total} produto(s) recusado(s) pelo Google`,
        "manual",
        mode
      );
    }

    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("não conectada") || message.includes("não configurado") ? 401 : 502;

    await supabase.from("google_shopping_sync_logs").insert({
      trigger: "manual",
      mode,
      status: "error",
      error: message,
    });
    await notifyGoogleShoppingSyncError(message, "manual", mode);

    return NextResponse.json({ error: message }, { status });
  }
}
