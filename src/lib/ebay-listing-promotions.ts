import { fetchAdCampaigns } from "@/lib/ebay-campaigns";

export type PromotedStatus = {
  isPromoted: boolean;
  campaignName: string | null;
  bidPercentage: string | null;
};

export type VolumeDiscountRule = {
  minQuantity: number;
  percentageOff: string | null;
};

export type VolumeDiscountStatus = {
  hasVolumeDiscount: boolean;
  promotionName: string | null;
  rules: VolumeDiscountRule[];
};

type RawAd = { listingId?: string; bidPercentage?: string };

/** Checks every RUNNING ad campaign for an ad promoting this specific listing. */
export async function checkPromotedListingStatus(token: string, itemId: string): Promise<PromotedStatus> {
  const campaigns = await fetchAdCampaigns(token);
  const runningCampaigns = campaigns.filter((c) => c.status === "RUNNING");

  for (const campaign of runningCampaigns) {
    const res = await fetch(
      `https://api.ebay.com/sell/marketing/v1/ad_campaign/${campaign.campaignId}/ad?listing_ids=${itemId}&limit=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) continue; // a campaign with no matching ad (or a transient error) just isn't a hit
    const data = await res.json();
    const ads = (data.ads ?? []) as RawAd[];
    const match = ads.find((a) => a.listingId === itemId);
    if (match) {
      return { isPromoted: true, campaignName: campaign.name, bidPercentage: match.bidPercentage ?? null };
    }
  }

  return { isPromoted: false, campaignName: null, bidPercentage: null };
}

type RawPromotionSummary = { promotionId: string; promotionType?: string; promotionStatus?: string };
type RawDiscountRule = { discountSpecification?: { minQuantity?: number }; discountBenefit?: { percentageOffOrder?: string } };
type RawPromotionDetail = {
  name?: string;
  promotionType?: string;
  discountRules?: RawDiscountRule[];
  inventoryCriterion?: { listingIds?: string[] | null };
};

// Volume discounts are set up one-per-listing on this account (~80 of them), and eBay's
// list endpoint doesn't return which listings each one covers — only the detail endpoint
// (one call per promotionId) does. Rebuilding that itemId -> discount map on every listing
// selection would mean ~80 API calls per click, so cache it for a few minutes instead.
let volumeDiscountCache: { builtAt: number; map: Map<string, VolumeDiscountStatus> } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function buildVolumeDiscountMap(token: string): Promise<Map<string, VolumeDiscountStatus>> {
  const listRes = await fetch(
    `https://api.ebay.com/sell/marketing/v1/promotion?promotion_status=RUNNING&limit=200&marketplace_id=EBAY_US`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const map = new Map<string, VolumeDiscountStatus>();
  if (!listRes.ok) return map;

  const listData = await listRes.json();
  const summaries = (listData.promotions ?? []) as RawPromotionSummary[];
  const volumePromoIds = summaries
    .filter((p) => p.promotionType === "VOLUME_DISCOUNT" && p.promotionStatus === "RUNNING")
    .map((p) => p.promotionId);

  const details = await Promise.all(
    volumePromoIds.map((id) =>
      fetch(`https://api.ebay.com/sell/marketing/v1/item_promotion/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? (r.json() as Promise<RawPromotionDetail>) : null))
        .catch(() => null)
    )
  );

  for (const detail of details) {
    const listingIds = detail?.inventoryCriterion?.listingIds ?? [];
    if (!detail || listingIds.length === 0) continue;
    const status: VolumeDiscountStatus = {
      hasVolumeDiscount: true,
      promotionName: detail.name ?? null,
      rules: (detail.discountRules ?? [])
        .map((r) => ({
          minQuantity: r.discountSpecification?.minQuantity ?? 0,
          percentageOff: r.discountBenefit?.percentageOffOrder ?? null,
        }))
        .filter((r) => Number(r.percentageOff) > 0)
        .sort((a, b) => a.minQuantity - b.minQuantity),
    };
    for (const listingId of listingIds) map.set(listingId, status);
  }

  return map;
}

/** Checks the seller's active VOLUME_DISCOUNT promotions ("buy more, save more") for this listing. */
export async function checkVolumeDiscount(token: string, itemId: string): Promise<VolumeDiscountStatus> {
  if (!volumeDiscountCache || Date.now() - volumeDiscountCache.builtAt > CACHE_TTL_MS) {
    volumeDiscountCache = { builtAt: Date.now(), map: await buildVolumeDiscountMap(token) };
  }

  return volumeDiscountCache.map.get(itemId) ?? { hasVolumeDiscount: false, promotionName: null, rules: [] };
}
