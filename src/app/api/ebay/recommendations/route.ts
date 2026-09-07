import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getEbayAccessToken } from "@/lib/ebay-token";
import { findListingRecommendations } from "@/lib/ebay-campaign-management";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const listingIds = Array.isArray(body.listingIds)
    ? body.listingIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
    : [];
  if (listingIds.length === 0) {
    return NextResponse.json({ error: "listingIds é obrigatório" }, { status: 400 });
  }

  try {
    const token = await getEbayAccessToken();
    const recommendations = await findListingRecommendations(token, listingIds);
    return NextResponse.json({ recommendations });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("eBay token not found") || message.includes("reconnect") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
