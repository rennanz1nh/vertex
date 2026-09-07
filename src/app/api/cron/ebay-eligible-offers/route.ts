import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchEligibleListingIds } from "@/lib/ebay-negotiation";
import { notifyEbayOffersEligible } from "@/lib/notify";

export const maxDuration = 30;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Polls eBay's Negotiation API for listings that became eligible for a "send offer to
 * watchers" (see vercel.json — runs every few hours) and pushes a notification only for
 * NEWLY eligible listings, tracked in ebay_eligible_offers_seen, so the same listing
 * doesn't re-notify every run while it's still sitting there eligible.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const listingIds = await fetchEligibleListingIds();
    const supabase = getSupabase();

    const { data: seenRows } = await supabase.from("ebay_eligible_offers_seen").select("listing_id");
    const seen = new Set((seenRows ?? []).map((r) => r.listing_id));
    const newIds = listingIds.filter((id) => !seen.has(id));

    if (newIds.length > 0) {
      await supabase.from("ebay_eligible_offers_seen").upsert(
        newIds.map((listing_id) => ({ listing_id })),
        { onConflict: "listing_id" }
      );
      await notifyEbayOffersEligible(newIds.length);
      // Feeds the in-app notification bell (separate from the ntfy.sh push above).
      await supabase.from("admin_notifications").insert({
        type: "ebay_offer_eligible",
        title: newIds.length === 1 ? "1 anúncio elegível para oferta" : `${newIds.length} anúncios elegíveis para oferta`,
        message: "Compradores do eBay observando esses anúncios podem receber um desconto.",
        link: "/admin/automations/ebay/send-offer",
      });
    }

    // Listings that stopped being eligible (offer sent, watcher left, listing ended)
    // are dropped from the tracking table so they can notify again if they later
    // become eligible a second time.
    const stillEligible = new Set(listingIds);
    const stale = [...seen].filter((id) => !stillEligible.has(id));
    if (stale.length > 0) {
      await supabase.from("ebay_eligible_offers_seen").delete().in("listing_id", stale);
    }

    return NextResponse.json({ ok: true, total: listingIds.length, new: newIds.length, cleared: stale.length });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
