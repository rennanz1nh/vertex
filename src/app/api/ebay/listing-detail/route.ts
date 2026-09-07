import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { fetchListingDetail } from "@/lib/ebay-listing-detail";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const itemId = request.nextUrl.searchParams.get("itemId");
  if (!itemId) {
    return NextResponse.json({ error: "itemId é obrigatório" }, { status: 400 });
  }

  try {
    const listing = await fetchListingDetail(itemId);
    return NextResponse.json({ listing });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("eBay token not found") || message.includes("reconnect") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
