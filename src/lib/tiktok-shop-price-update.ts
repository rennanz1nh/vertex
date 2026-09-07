import { tiktokShopRequest } from "@/lib/tiktok-shop-api";

export type PriceUpdateResult = {
  sku: string;
  title: string;
  oldPrice: number;
  newPrice: number;
  status: "ok" | "error";
  error?: string;
};

export type PriceUpdateSummary = {
  total: number;
  updated: number;
  products: PriceUpdateResult[];
};

export type TikTokShopListing = {
  productId: string;
  skuId: string;
  title: string;
  price: number;
  imageUrl?: string;
};

/** Paginates through /product/202309/products/search for every ACTIVATE product+SKU. */
export async function fetchAllActiveListings(): Promise<TikTokShopListing[]> {
  const listings: TikTokShopListing[] = [];
  let pageToken: string | undefined;

  do {
    const data = await tiktokShopRequest<{
      products: Array<{
        id: string;
        title: string;
        main_images?: Array<{ url_list?: string[] }>;
        skus: Array<{ id: string; price?: { tax_exclusive_price?: string; sale_price?: string } }>;
      }>;
      next_page_token?: string;
    }>({
      path: "/product/202309/products/search",
      method: "POST",
      query: { page_size: "100", ...(pageToken ? { page_token: pageToken } : {}) },
      body: { status: "ACTIVATE" },
    });

    for (const product of data.products ?? []) {
      for (const sku of product.skus ?? []) {
        const priceStr = sku.price?.sale_price ?? sku.price?.tax_exclusive_price;
        if (!priceStr) continue;
        listings.push({
          productId: product.id,
          skuId: sku.id,
          title: product.title,
          price: parseFloat(priceStr),
          imageUrl: product.main_images?.[0]?.url_list?.[0],
        });
      }
    }

    pageToken = data.next_page_token || undefined;
  } while (pageToken);

  return listings;
}

/**
 * Revises the price of active TikTok Shop SKUs by a fixed adjustment (or to a fixed
 * price). Mirrors runEbayPriceUpdate: test mode caps at 1 SKU, full mode covers every
 * active SKU, `skuIds` scopes it to a hand-picked selection.
 */
export async function runTikTokShopPriceUpdate({
  adjustment = -0.01,
  fixedPrice,
  testMode = true,
  skuIds,
  onProgress,
}: {
  adjustment?: number;
  fixedPrice?: number;
  testMode?: boolean;
  skuIds?: string[];
  onProgress?: (completed: number, total: number) => void;
}): Promise<PriceUpdateSummary> {
  const all = await fetchAllActiveListings();

  let items: TikTokShopListing[];
  if (skuIds && skuIds.length > 0) {
    const idSet = new Set(skuIds);
    items = all.filter((i) => idSet.has(i.skuId));
  } else {
    items = testMode ? all.slice(0, 1) : all;
  }

  if (items.length === 0) {
    throw new Error("No active listings found on TikTok Shop");
  }

  const results: PriceUpdateResult[] = [];
  onProgress?.(0, items.length);

  for (const item of items) {
    const newPrice = fixedPrice !== undefined
      ? Math.max(0.01, parseFloat(fixedPrice.toFixed(2)))
      : Math.max(0.01, parseFloat((item.price + adjustment).toFixed(2)));

    try {
      await tiktokShopRequest({
        path: `/product/202309/products/${item.productId}/prices/update`,
        method: "POST",
        body: {
          skus: [
            {
              id: item.skuId,
              price: { amount: newPrice.toFixed(2), currency: "USD" },
            },
          ],
        },
      });
      results.push({ sku: item.skuId, title: item.title, oldPrice: item.price, newPrice, status: "ok" });
    } catch (e: unknown) {
      results.push({
        sku: item.skuId,
        title: item.title,
        oldPrice: item.price,
        newPrice,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
    onProgress?.(results.length, items.length);
  }

  return {
    total: results.length,
    updated: results.filter((r) => r.status === "ok").length,
    products: results,
  };
}

/** Pushes an absolute stock quantity for a single SKU (e.g. after a local inventory change). */
export async function updateTikTokShopInventory(skuId: string, warehouseId: string, quantity: number): Promise<void> {
  await tiktokShopRequest({
    path: "/product/202309/inventory/update",
    method: "POST",
    body: { skus: [{ id: skuId, inventory: [{ warehouse_id: warehouseId, quantity }] }] },
  });
}
