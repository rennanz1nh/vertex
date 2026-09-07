import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { shipTikTokShopOrder } from "@/lib/tiktok-shop-fulfillment";

/** Marks a TikTok Shop order as shipped with a tracking number — the equivalent of
 *  eBay's shipping_fulfillment update, but pushed from our side instead of read-only. */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const body = await request.json();
  const { orderId, trackingNumber, shippingProviderId } = body;

  if (!orderId || !trackingNumber || !shippingProviderId) {
    return NextResponse.json({ error: "orderId, trackingNumber and shippingProviderId are required" }, { status: 400 });
  }

  try {
    await shipTikTokShopOrder({ orderId, trackingNumber, shippingProviderId });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("not connected") || message.includes("reconnect") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
