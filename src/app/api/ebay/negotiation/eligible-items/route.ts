import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { fetchEligibleListingIds } from "@/lib/ebay-negotiation";
import { fetchListingDetail } from "@/lib/ebay-listing-detail";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  try {
    const listingIds = await fetchEligibleListingIds();

    // Each listing needs its own GetItem call for title/price/image — fine at the scale
    // of "listings with an interested buyer right now", which in practice is a small
    // fraction of the whole catalog.
    const items = await Promise.all(
      listingIds.map((id) =>
        fetchListingDetail(id)
          .then((d) => ({
            listingId: id,
            title: d.title,
            price: d.price,
            currency: d.currency,
            quantity: d.quantity,
            image: d.images[0] ?? null,
            error: null as string | null,
          }))
          .catch((e) => ({
            listingId: id,
            title: null,
            price: null,
            currency: null,
            quantity: null,
            image: null,
            error: e instanceof Error ? e.message : "Falha ao carregar",
          }))
      )
    );

    return NextResponse.json({ items });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("reconnect") || message.includes("reconectar") || message.includes("eBay token not found") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
