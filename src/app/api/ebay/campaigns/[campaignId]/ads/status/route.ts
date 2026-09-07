import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getEbayAccessToken } from "@/lib/ebay-token";
import { updateAdsStatusByListingId } from "@/lib/ebay-campaign-management";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { campaignId } = await params;
  const body = await request.json().catch(() => ({}));
  const listingId = typeof body.listingId === "string" ? body.listingId : "";
  const adStatus = body.adStatus === "ACTIVE" || body.adStatus === "PAUSED" ? body.adStatus : "";
  if (!listingId) return NextResponse.json({ error: "listingId é obrigatório" }, { status: 400 });
  if (!adStatus) return NextResponse.json({ error: "adStatus deve ser ACTIVE ou PAUSED" }, { status: 400 });

  try {
    const token = await getEbayAccessToken();
    await updateAdsStatusByListingId(token, campaignId, listingId, adStatus);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("eBay token not found") || message.includes("reconnect") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
