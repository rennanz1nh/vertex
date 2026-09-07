import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getEbayAppToken } from "@/lib/ebay-app-token";

export interface EbaySimilarItem {
  itemId: string;
  title: string;
  price: number | null;
  currency: string | null;
  imageUrl: string | null;
  itemWebUrl: string | null;
  condition: string | null;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const q = request.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json({ error: "q é obrigatório" }, { status: 400 });

  try {
    const token = await getEbayAppToken();
    const res = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?${new URLSearchParams({
        q,
        limit: "12",
        sort: "BEST_MATCH",
      })}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `eBay Browse API: ${err}` }, { status: 502 });
    }

    const data = await res.json();
    const items: EbaySimilarItem[] = (data.itemSummaries ?? []).map((i: any) => ({
      itemId: i.itemId,
      title: i.title,
      price: i.price?.value ? Number(i.price.value) : null,
      currency: i.price?.currency ?? null,
      imageUrl: i.image?.imageUrl ?? i.thumbnailImages?.[0]?.imageUrl ?? null,
      itemWebUrl: i.itemWebUrl ?? null,
      condition: i.condition ?? null,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
