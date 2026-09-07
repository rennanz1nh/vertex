import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { sendOfferToInterestedBuyers } from "@/lib/ebay-negotiation";
import { fetchListingDetail } from "@/lib/ebay-listing-detail";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const listingId = typeof body.listingId === "string" ? body.listingId : "";
  const discountPercentage = Number(body.discountPercentage);
  const quantity = Math.max(1, Math.round(Number(body.quantity)) || 1);
  const message = typeof body.message === "string" ? body.message : undefined;

  if (!listingId) return NextResponse.json({ error: "listingId é obrigatório" }, { status: 400 });
  if (!Number.isFinite(discountPercentage) || discountPercentage <= 0 || discountPercentage >= 100) {
    return NextResponse.json({ error: "discountPercentage precisa ser entre 1 e 99" }, { status: 400 });
  }

  try {
    // Re-fetches the listing's current price rather than trusting whatever the client
    // last loaded — the eligible-items list can sit open in a tab for a while, and the
    // discount must always be computed off the live price, not a stale one.
    const listing = await fetchListingDetail(listingId);
    const price = Math.round(listing.price * (1 - discountPercentage / 100) * 100) / 100;
    const sentQuantity = Math.min(quantity, listing.quantity);

    await sendOfferToInterestedBuyers({
      listingId,
      price,
      currency: listing.currency,
      quantity: sentQuantity,
      message,
    });

    // Best-effort history entry for the "últimas ofertas enviadas" read-only list — a
    // failure here shouldn't fail the request, the offer was already sent to eBay.
    try {
      await supabaseAdmin.from("ebay_offers_sent").insert({
        listing_id: listingId,
        title: listing.title,
        image: listing.images?.[0] ?? null,
        original_price: listing.price,
        discount_percentage: discountPercentage,
        offered_price: price,
        currency: listing.currency,
        quantity: sentQuantity,
        message: message ?? null,
      });
    } catch { /* best-effort */ }

    return NextResponse.json({ ok: true, price, currency: listing.currency });
  } catch (e: unknown) {
    const message2 = e instanceof Error ? e.message : "Unknown error";
    // Matches eligible-items/route.ts's mapping — previously this always returned 502,
    // so a token that broke *after* the page's initial load (which does detect 401)
    // just produced a generic error toast on send with no way to reconnect from there.
    const status = message2.includes("reconnect") || message2.includes("reconectar") || message2.includes("eBay token not found") ? 401 : 502;
    return NextResponse.json({ error: message2 }, { status });
  }
}
