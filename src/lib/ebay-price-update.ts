import { getEbayAccessToken } from "@/lib/ebay-token";
import { decodeXmlEntities } from "@/lib/xml-entities";

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

export type EbayListing = { itemId: string; title: string; price: number; imageUrl?: string; quantitySold?: number };

/**
 * Fetches ALL active listings, paginating through eBay's GetMyeBaySelling until
 * HasMoreItems is false. Used by the listing picker (needs the full catalog to
 * search/select from) — NOT used by the normal test/full price-update flow below,
 * which intentionally keeps its original single-page fetch behavior unchanged.
 */
export async function fetchAllActiveListings(): Promise<EbayListing[]> {
  const token = await getEbayAccessToken();
  // Keyed by itemId so a page-overlap quirk from eBay's pagination (observed in practice:
  // the same ItemID can come back on more than one page) can never produce duplicate
  // entries — which would otherwise break React's key-based list rendering downstream.
  const byId = new Map<string, EbayListing>();
  let page = 1;
  let totalPages: number | null = null;

  while (true) {
    const res = await fetch("https://api.ebay.com/ws/api.dll", {
      method: "POST",
      headers: {
        "X-EBAY-API-SITEID": "0",
        "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
        "X-EBAY-API-CALL-NAME": "GetMyeBaySelling",
        "X-EBAY-API-IAF-TOKEN": token,
        "Content-Type": "text/xml",
      },
      body: `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <ActiveList>
    <Include>true</Include>
    <Pagination>
      <EntriesPerPage>200</EntriesPerPage>
      <PageNumber>${page}</PageNumber>
    </Pagination>
  </ActiveList>
  <DetailLevel>ReturnAll</DetailLevel>
</GetMyeBaySellingRequest>`,
    });

    const text = await res.text();
    const ackMatch = text.match(/<Ack>(.*?)<\/Ack>/);
    if (ackMatch && ackMatch[1] === "Failure") {
      const errMsg = text.match(/<ShortMessage>(.*?)<\/ShortMessage>/)?.[1] ?? "eBay API error";
      throw new Error(errMsg);
    }

    for (const match of text.matchAll(/<Item>([\s\S]*?)<\/Item>/g)) {
      const block = match[1];
      const itemId = block.match(/<ItemID>(.*?)<\/ItemID>/)?.[1];
      const title = block.match(/<Title>(.*?)<\/Title>/)?.[1];
      const priceStr = block.match(/<CurrentPrice[^>]*>(.*?)<\/CurrentPrice>/)?.[1];
      const imageUrl = block.match(/<GalleryURL>(.*?)<\/GalleryURL>/)?.[1];
      const quantitySoldStr = block.match(/<QuantitySold>(.*?)<\/QuantitySold>/)?.[1];
      if (itemId && title && priceStr) {
        byId.set(itemId, {
          itemId,
          title: decodeXmlEntities(title),
          price: parseFloat(priceStr),
          imageUrl,
          quantitySold: quantitySoldStr ? parseInt(quantitySoldStr, 10) : undefined,
        });
      }
    }

    const totalPagesStr = text.match(/<TotalNumberOfPages>(\d+)<\/TotalNumberOfPages>/)?.[1];
    if (totalPagesStr) totalPages = parseInt(totalPagesStr, 10);
    const hasMore = /<HasMoreItems>true<\/HasMoreItems>/.test(text);
    const reachedKnownLastPage = totalPages !== null && page >= totalPages;

    if (!hasMore || reachedKnownLastPage || page > 20) break; // safety cap: 20 pages × 200 = 4000 listings
    page++;
  }

  return [...byId.values()];
}

/**
 * Revises the price of active eBay listings by a fixed adjustment.
 * Shared by the manual "Executar Agora" button and the daily cron job so both
 * paths run through the exact same logic (including the test-mode safety cap).
 *
 * Pass `itemIds` to scope the update to a specific hand-picked set of listings
 * instead of the test (1 listing) / full (all listings) behavior.
 */
export async function runEbayPriceUpdate({
  adjustment = -0.01,
  fixedPrice,
  testMode = true,
  itemIds,
  onProgress,
}: {
  adjustment?: number;
  /** When set, every item is revised to this exact price instead of item.price + adjustment. */
  fixedPrice?: number;
  testMode?: boolean;
  itemIds?: string[];
  /** Called once with the final item count before the loop starts, then again after each item. */
  onProgress?: (completed: number, total: number) => void;
}): Promise<PriceUpdateSummary> {
  const token = await getEbayAccessToken();

  let items: { itemId: string; title: string; price: number }[];

  if (itemIds && itemIds.length > 0) {
    // Selection mode: fetch the whole catalog (paginated) and filter down to the chosen IDs.
    const all = await fetchAllActiveListings();
    const idSet = new Set(itemIds);
    items = all.filter((i) => idSet.has(i.itemId));
  } else {
    // Original test/full behavior — single-page fetch, unchanged from before.
    const entriesPerPage = testMode ? 1 : 200;
    const tradingRes = await fetch("https://api.ebay.com/ws/api.dll", {
      method: "POST",
      headers: {
        "X-EBAY-API-SITEID": "0",
        "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
        "X-EBAY-API-CALL-NAME": "GetMyeBaySelling",
        "X-EBAY-API-IAF-TOKEN": token,
        "Content-Type": "text/xml",
      },
      body: `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <ActiveList>
    <Include>true</Include>
    <Pagination>
      <EntriesPerPage>${entriesPerPage}</EntriesPerPage>
      <PageNumber>1</PageNumber>
    </Pagination>
  </ActiveList>
  <DetailLevel>ReturnAll</DetailLevel>
</GetMyeBaySellingRequest>`,
    });

    const tradingText = await tradingRes.text();

    const ackMatch = tradingText.match(/<Ack>(.*?)<\/Ack>/);
    if (ackMatch && ackMatch[1] === "Failure") {
      const errMsg = tradingText.match(/<ShortMessage>(.*?)<\/ShortMessage>/)?.[1] ?? "eBay API error";
      throw new Error(errMsg);
    }

    items = [];
    for (const match of tradingText.matchAll(/<Item>([\s\S]*?)<\/Item>/g)) {
      const block = match[1];
      const itemId = block.match(/<ItemID>(.*?)<\/ItemID>/)?.[1];
      const title = block.match(/<Title>(.*?)<\/Title>/)?.[1];
      const priceStr = block.match(/<CurrentPrice[^>]*>(.*?)<\/CurrentPrice>/)?.[1];
      if (itemId && title && priceStr) {
        items.push({ itemId, title: decodeXmlEntities(title), price: parseFloat(priceStr) });
      }
    }
  }

  if (items.length === 0) {
    throw new Error("No active listings found on eBay");
  }

  // Safety net: never trust eBay's EntriesPerPage pagination alone to scope test mode —
  // the legacy Trading API doesn't always honor it reliably. Enforce the 1-listing cap
  // ourselves so a pagination quirk can never revise more than one item in test mode.
  const scopedItems = itemIds && itemIds.length > 0
    ? items
    : testMode ? items.slice(0, 1) : items;

  // Atualiza preço de cada item
  const results: PriceUpdateResult[] = [];
  onProgress?.(0, scopedItems.length);
  for (const item of scopedItems) {
    const newPrice = fixedPrice !== undefined
      ? Math.max(0.01, parseFloat(fixedPrice.toFixed(2)))
      : Math.max(0.01, parseFloat((item.price + adjustment).toFixed(2)));

    const reviseRes = await fetch("https://api.ebay.com/ws/api.dll", {
      method: "POST",
      headers: {
        "X-EBAY-API-SITEID": "0",
        "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
        "X-EBAY-API-CALL-NAME": "ReviseItem",
        "X-EBAY-API-IAF-TOKEN": token,
        "Content-Type": "text/xml",
      },
      body: `<?xml version="1.0" encoding="utf-8"?>
<ReviseItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <ItemID>${item.itemId}</ItemID>
    <StartPrice>${newPrice}</StartPrice>
  </Item>
</ReviseItemRequest>`,
    });

    const reviseText = await reviseRes.text();
    const reviseAck = reviseText.match(/<Ack>(.*?)<\/Ack>/)?.[1];
    const isOk = reviseAck === "Success" || reviseAck === "Warning";

    results.push({
      sku: item.itemId,
      title: item.title,
      oldPrice: item.price,
      newPrice,
      status: isOk ? "ok" : "error",
      error: !isOk ? (reviseText.match(/<ShortMessage>(.*?)<\/ShortMessage>/)?.[1] ?? "Unknown error") : undefined,
    });
    onProgress?.(results.length, scopedItems.length);
  }

  return {
    total: results.length,
    updated: results.filter((r) => r.status === "ok").length,
    products: results,
  };
}
