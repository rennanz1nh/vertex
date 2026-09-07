import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getEbayAccessToken } from "@/lib/ebay-token";
import { getCampaignAds, addListingToCampaign } from "@/lib/ebay-campaign-management";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const auth = await requireAdmin(_request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { campaignId } = await params;
  try {
    const token = await getEbayAccessToken();
    const ads = await getCampaignAds(token, campaignId);
    return NextResponse.json({ ads });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("eBay token not found") || message.includes("reconnect") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

/** Adds one more listing to an already-existing CPC campaign. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { campaignId } = await params;
  const body = await request.json().catch(() => ({}));
  const listingId = typeof body.listingId === "string" ? body.listingId : "";
  const bidPercentage = typeof body.bidPercentage === "string" ? body.bidPercentage : "";
  if (!listingId) return NextResponse.json({ error: "listingId é obrigatório" }, { status: 400 });
  if (!bidPercentage) return NextResponse.json({ error: "bidPercentage é obrigatório" }, { status: 400 });

  try {
    const token = await getEbayAccessToken();
    await addListingToCampaign(token, campaignId, listingId, bidPercentage);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("eBay token not found") || message.includes("reconnect") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
