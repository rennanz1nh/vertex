import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getEbayAccessToken } from "@/lib/ebay-token";
import { checkPromotedListingStatus, checkVolumeDiscount } from "@/lib/ebay-listing-promotions";

// Both checks hit less stable / less core eBay endpoints than the main listing detail.
// Each is isolated so one failing (e.g. seller has no campaigns configured) never
// blocks the other — the route always resolves, just with null for whichever failed.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const itemId = request.nextUrl.searchParams.get("itemId");
  if (!itemId) {
    return NextResponse.json({ error: "itemId é obrigatório" }, { status: 400 });
  }

  let token: string;
  try {
    token = await getEbayAccessToken();
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const [promoted, volumeDiscount] = await Promise.all([
    checkPromotedListingStatus(token, itemId).catch(() => null),
    checkVolumeDiscount(token, itemId).catch(() => null),
  ]);

  return NextResponse.json({ promoted, volumeDiscount });
}
