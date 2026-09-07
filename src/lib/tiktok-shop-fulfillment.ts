import { tiktokShopRequest } from "@/lib/tiktok-shop-api";

/**
 * Marks a TikTok Shop order's package as shipped with a tracking number, mirroring
 * what "Enviado" does for eBay orders. TikTok requires shipping by package_id, not
 * order_id directly, so this looks the package up first.
 */
export async function shipTikTokShopOrder({
  orderId,
  trackingNumber,
  shippingProviderId,
}: {
  orderId: string;
  trackingNumber: string;
  shippingProviderId: string;
}): Promise<void> {
  const pkgData = await tiktokShopRequest<{ packages: Array<{ id: string }> }>({
    path: "/fulfillment/202309/packages/search",
    method: "POST",
    body: { order_id: orderId },
  });

  const packageId = pkgData.packages?.[0]?.id;
  if (!packageId) {
    throw new Error(`No shippable package found for TikTok Shop order ${orderId}`);
  }

  await tiktokShopRequest({
    path: `/fulfillment/202309/packages/${packageId}/shipping_documents`,
    method: "POST",
    body: {
      tracking_number: trackingNumber,
      shipping_provider_id: shippingProviderId,
    },
  });
}

/** Lists TikTok's shipping providers so the UI can offer a real carrier dropdown. */
export async function listShippingProviders(): Promise<Array<{ id: string; name: string }>> {
  const data = await tiktokShopRequest<{ shipping_providers: Array<{ id: string; name: string }> }>({
    path: "/logistics/202309/shipping_providers",
  });
  return data.shipping_providers ?? [];
}
