import { getEbayAccessToken } from "@/lib/ebay-token";

const BASE = "https://api.ebay.com/sell/negotiation/v1";

/**
 * Listings the eBay Negotiation API considers eligible for a seller-initiated offer —
 * i.e. at least one buyer has watched the listing or added-then-abandoned it in their
 * cart. Requires the sell.inventory OAuth scope (added after the account was first
 * connected — an old token without it gets a 403 here and the caller surfaces a
 * "reconnect eBay" message).
 */
export async function fetchEligibleListingIds(): Promise<string[]> {
  const token = await getEbayAccessToken();
  const ids: string[] = [];
  let offset = 0;
  const limit = 200;

  while (true) {
    const res = await fetch(`${BASE}/find_eligible_items?limit=${limit}&offset=${offset}`, {
      headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" },
    });
    const text = await res.text();
    const parsed = (() => {
      try {
        return text ? JSON.parse(text) : {};
      } catch {
        return {};
      }
    })();

    if (!res.ok) {
      const message = parsed?.errors?.[0]?.message || `eBay respondeu ${res.status}`;
      if (res.status === 403) throw new Error(`${message} — pode ser necessário reconectar a conta do eBay (novo escopo sell.inventory).`);
      throw new Error(message);
    }
    // eBay returns an empty body (sometimes even 204/200 with nothing) when there are
    // currently no eligible items at all — not an error, just "nothing to report".
    const items = (parsed.eligibleItems ?? []) as { listingId: string }[];
    ids.push(...items.map((i) => i.listingId));
    if (items.length < limit) break;
    offset += limit;
  }

  return ids;
}

export type SendOfferParams = {
  listingId: string;
  price: number;
  currency: string;
  quantity: number;
  message?: string;
};

/**
 * Sends a discounted offer to every buyer who's shown interest in this one listing.
 * offerDuration is intentionally omitted: eBay's Negotiation API only supports one fixed
 * duration per marketplace (4 days for EBAY_US/EBAY_GB as of the v1.1.2 release) and any
 * other value is rejected — eBay's own docs recommend not sending this field at all and
 * letting the marketplace default apply.
 */
export async function sendOfferToInterestedBuyers(params: SendOfferParams): Promise<void> {
  const token = await getEbayAccessToken();

  const res = await fetch(`${BASE}/send_offer_to_interested_buyers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    },
    body: JSON.stringify({
      message: params.message?.slice(0, 250) || undefined,
      offeredItems: [
        {
          listingId: params.listingId,
          quantity: String(params.quantity),
          price: { value: params.price.toFixed(2), currency: params.currency },
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body?.errors?.[0]?.message || `eBay respondeu ${res.status}`;
    throw new Error(message);
  }
}
