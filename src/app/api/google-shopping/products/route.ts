import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { fetchStoreCatalog, fetchProductStatuses, type ProductStatus } from "@/lib/google-shopping-feed";

/**
 * Merges our own catalog (source of truth for what's for sale) with Google's
 * productStatuses (whether each offerId was actually approved) — the same "our data +
 * their status" shape amazon/listings and ebay/listings return, except here disapproval
 * reasons matter a lot more: Google rejects far more listings up front than eBay/Amazon
 * ever did (missing GTIN, price mismatch, prohibited claims, etc).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  try {
    let statusesError: string | null = null;
    const [catalog, statuses] = await Promise.all([
      fetchStoreCatalog(),
      fetchProductStatuses().catch((e: unknown): ProductStatus[] => {
        statusesError = e instanceof Error ? e.message : String(e);
        return [];
      }),
    ]);
    const statusBySku = new Map(statuses.map((s) => [s.offerId, s]));

    // "not_synced" only means "Google doesn't have this SKU at all" (never submitted, or
    // removed) — a SKU Google DOES have but hasn't evaluated any destination for yet comes
    // back as approval "pending", surfaced here as "under_review" (matches the status union
    // GoogleShoppingProductsPage already filters/badges on) since it genuinely was submitted.
    const products = catalog.map((item) => {
      const status = statusBySku.get(item.sku);
      const uiStatus = !status ? "not_synced" : status.approval === "pending" ? "under_review" : status.approval;
      return {
        id: item.id,
        sku: item.sku,
        title: item.title,
        imageUrl: item.imageLink ?? undefined,
        price: item.price,
        stock: item.stock,
        status: uiStatus, // "approved" | "under_review" | "disapproved" | "not_synced"
        issues: status?.issues ?? [],
      };
    });

    // statusesError set means every "not_synced" below is unknown, not confirmed —
    // the diagnostics call itself failed rather than Google having no data yet.
    return NextResponse.json({ products, statusesError });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("não conectada") || message.includes("not configured") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
