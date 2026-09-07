// Campaign management beyond list + report: single-campaign detail, pause/resume,
// daily budget edits, and the listings ("ads") placed inside a campaign. All calls hit
// the Marketing API's `campaign`/`ad` resources directly (same pattern as
// ebay-campaigns.ts/ebay-listing-promotions.ts — plain fetch, no SDK).

import { marketplaceTimestamp } from "@/lib/ebay-time";

const BASE = "https://api.ebay.com/sell/marketing/v1/ad_campaign";

type RawSelectionRules = {
  categoryIds?: string[];
  brands?: string[];
  minPrice?: string;
  maxPrice?: string;
  listingConditionIds?: string[];
};

type RawCampaignDetail = {
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  campaignTargetingType?: string;
  channels?: string[];
  startDate?: string;
  endDate?: string | null;
  fundingStrategy?: { fundingModel?: string; bidPercentage?: string; biddingStrategy?: string };
  budget?: { daily?: { amount?: { value?: string; currency?: string } } };
  campaignCriterion?: { criterionType?: string; autoSelectFutureInventory?: boolean; selectionRules?: RawSelectionRules };
};

export type SelectionRules = {
  categoryIds: string[];
  brands: string[];
  minPrice: string | null;
  maxPrice: string | null;
  listingConditionIds: string[];
};

export type CampaignDetail = {
  campaignId: string;
  name: string;
  status: string;
  targetingType: string | null;
  channels: string[];
  startDate: string | null;
  endDate: string | null;
  fundingModel: string | null;
  bidPercentage: string | null;
  biddingStrategy: string | null;
  dailyBudget: number | null;
  currency: string | null;
  // Only present for rules-based (COST_PER_SALE) campaigns — eBay auto-selects listings
  // matching these rules rather than the seller picking them one by one.
  selectionRules: SelectionRules | null;
  autoSelectFutureInventory: boolean | null;
};

async function ebayFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
}

async function throwEbayError(res: Response, action: string): Promise<never> {
  const text = await res.text();
  let message = text;
  try {
    const parsed = JSON.parse(text);
    message = parsed?.errors?.[0]?.message ?? text;
  } catch {
    // not JSON (e.g. the XML errorMessageV3 shape) — fall through with the raw text
  }
  throw new Error(`eBay recusou ${action} (status ${res.status}): ${message.slice(0, 300)}`);
}

/** GET a single campaign's full detail — includes budget/bid (CPC) or selection rules
 *  (CPS) that the plain campaign-list endpoint (fetchAdCampaigns) doesn't return. */
export async function getCampaignDetail(token: string, campaignId: string): Promise<CampaignDetail> {
  const res = await ebayFetch(`${BASE}/${campaignId}`, token);
  if (!res.ok) await throwEbayError(res, "buscar detalhe da campanha");
  const data = (await res.json()) as RawCampaignDetail;

  const rules = data.campaignCriterion?.selectionRules;
  return {
    campaignId: data.campaignId,
    name: data.campaignName,
    status: data.campaignStatus,
    targetingType: data.campaignTargetingType ?? null,
    channels: data.channels ?? [],
    startDate: data.startDate ?? null,
    endDate: data.endDate ?? null,
    fundingModel: data.fundingStrategy?.fundingModel ?? null,
    bidPercentage: data.fundingStrategy?.bidPercentage ?? null,
    biddingStrategy: data.fundingStrategy?.biddingStrategy ?? null,
    dailyBudget: data.budget?.daily?.amount?.value ? Number(data.budget.daily.amount.value) : null,
    currency: data.budget?.daily?.amount?.currency ?? null,
    selectionRules: rules
      ? {
          categoryIds: rules.categoryIds ?? [],
          brands: rules.brands ?? [],
          minPrice: rules.minPrice ?? null,
          maxPrice: rules.maxPrice ?? null,
          listingConditionIds: rules.listingConditionIds ?? [],
        }
      : null,
    autoSelectFutureInventory: data.campaignCriterion?.autoSelectFutureInventory ?? null,
  };
}

/** No request/response body per eBay's docs — a 200 with an empty body is success. */
export async function pauseCampaign(token: string, campaignId: string): Promise<void> {
  const res = await ebayFetch(`${BASE}/${campaignId}/pause`, token, { method: "POST" });
  if (!res.ok) await throwEbayError(res, "pausar a campanha");
}

/** eBay only allows this while the campaign's end date is still in the future (or unset). */
export async function resumeCampaign(token: string, campaignId: string): Promise<void> {
  const res = await ebayFetch(`${BASE}/${campaignId}/resume`, token, { method: "POST" });
  if (!res.ok) await throwEbayError(res, "retomar a campanha");
}

/** Ends a RUNNING or PAUSED campaign for good — unlike pause, this can't be undone with
 *  resumeCampaign. No request/response payload per eBay's docs. */
export async function endCampaign(token: string, campaignId: string): Promise<void> {
  const res = await ebayFetch(`${BASE}/${campaignId}/end`, token, { method: "POST" });
  if (!res.ok) await throwEbayError(res, "encerrar a campanha");
}

/** eBay only allows deleting a campaign that has already ENDED. */
export async function deleteCampaign(token: string, campaignId: string): Promise<void> {
  const res = await ebayFetch(`${BASE}/${campaignId}`, token, { method: "DELETE" });
  if (!res.ok) await throwEbayError(res, "excluir a campanha");
}

/**
 * Only valid for CPC (Cost Per Click) campaigns — CPS (Cost Per Sale) campaigns have no
 * daily budget concept (they only cost money when a sale actually happens). eBay also
 * enforces its own limits here: max 15 budget updates per campaign per day, and each
 * change must move the value by at least $0.50, or the call is rejected — those are
 * eBay-side rules this function doesn't pre-validate, so a rejection surfaces as-is.
 */
export async function updateCampaignBudget(token: string, campaignId: string, dailyBudget: number, currency = "USD"): Promise<void> {
  const res = await ebayFetch(`${BASE}/${campaignId}/update_campaign_budget`, token, {
    method: "POST",
    body: JSON.stringify({ budget: { daily: { amount: { value: dailyBudget.toFixed(2), currency } } } }),
  });
  if (!res.ok) await throwEbayError(res, "atualizar o orçamento da campanha");
}

export type CampaignAd = { adId: string; listingId: string; bidPercentage: string | null; adStatus: string | null };

/** Listings actually placed in a campaign — only meaningful for CPC campaigns (CPS
 *  campaigns select listings dynamically via selectionRules, not individual ads). */
export async function getCampaignAds(token: string, campaignId: string): Promise<CampaignAd[]> {
  const res = await ebayFetch(`${BASE}/${campaignId}/ad?limit=200`, token);
  if (!res.ok) await throwEbayError(res, "buscar os anúncios da campanha");
  const data = await res.json();
  const ads = (data.ads ?? []) as { adId: string; listingId: string; bidPercentage?: string; adStatus?: string }[];
  return ads.map((a) => ({ adId: a.adId, listingId: a.listingId, bidPercentage: a.bidPercentage ?? null, adStatus: a.adStatus ?? null }));
}

/** Adds one more listing to an already-existing CPC campaign (setupQuickCampaign / the
 *  create-campaign flow only covers listings picked at creation time). eBay's docs say
 *  a successful call returns 201 with no body of interest, so this only surfaces errors. */
export async function addListingToCampaign(token: string, campaignId: string, listingId: string, bidPercentage: string): Promise<void> {
  const res = await ebayFetch(`${BASE}/${campaignId}/ad`, token, {
    method: "POST",
    body: JSON.stringify({ listingId, bidPercentage }),
  });
  if (!res.ok) await throwEbayError(res, "adicionar o produto à campanha");
}

/** Each CPC campaign has exactly one ad group (confirmed against this account's real
 *  data) — needed as a parameter for bulkUpdateAdsStatusByListingId, which otherwise has
 *  no way to know which group an ad's listing belongs to. */
async function getCampaignAdGroupId(token: string, campaignId: string): Promise<string> {
  const res = await ebayFetch(`${BASE}/${campaignId}/ad_group?limit=10`, token);
  if (!res.ok) await throwEbayError(res, "buscar o grupo de anúncios da campanha");
  const data = await res.json();
  const adGroupId = data.adGroups?.[0]?.adGroupId;
  if (!adGroupId) throw new Error("Não foi possível encontrar o grupo de anúncios desta campanha");
  return adGroupId;
}

/** Changes the bid % for one or more listings already in a CPC campaign, without
 *  touching the others. */
export async function updateAdsBidByListingId(token: string, campaignId: string, updates: { listingId: string; bidPercentage: string }[]): Promise<void> {
  const res = await ebayFetch(`${BASE}/${campaignId}/bulk_update_ads_bid_by_listing_id`, token, {
    method: "POST",
    body: JSON.stringify({ requests: updates }),
  });
  if (!res.ok) await throwEbayError(res, "atualizar o lance do produto");
}

/** Pauses/resumes one listing's ad within a campaign without pausing the whole campaign.
 *  adStatus is "ACTIVE" or "PAUSED" (ARCHIVED also exists per eBay's docs but isn't
 *  exposed here — that's a one-way removal, closer to deleting the ad). */
export async function updateAdsStatusByListingId(token: string, campaignId: string, listingId: string, adStatus: "ACTIVE" | "PAUSED"): Promise<void> {
  const adGroupId = await getCampaignAdGroupId(token, campaignId);
  const res = await ebayFetch(`${BASE}/${campaignId}/bulk_update_ads_status_by_listing_id`, token, {
    method: "POST",
    body: JSON.stringify({ requests: [{ listingId, adGroupId, adStatus }] }),
  });
  if (!res.ok) await throwEbayError(res, "atualizar o status do produto");
}

export type ListingRecommendation = { listingId: string; bidPercentage: string | null; promoteWithAd: string | null };

/** Suggested "ad rate" (bid %) per listing, based on recently-sold similarly-promoted
 *  items in the same category — from the separate Recommendation API (a different base
 *  URL from the rest of this file), so a seller isn't guessing a bid cold. */
export async function findListingRecommendations(token: string, listingIds: string[]): Promise<ListingRecommendation[]> {
  const res = await fetch("https://api.ebay.com/sell/recommendation/v1/listing_recommendation/find", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ listingIds }),
  });
  if (!res.ok) await throwEbayError(res, "buscar recomendações de lance");
  const data = await res.json();
  const items = (data.listingRecommendations ?? []) as {
    listingId: string;
    marketing?: { ad?: { bidPercentage?: { value?: string; basis?: string }[]; promoteWithAd?: string } };
  }[];
  return items.map((item) => ({
    listingId: item.listingId,
    bidPercentage: item.marketing?.ad?.bidPercentage?.[0]?.value ?? null,
    promoteWithAd: item.marketing?.ad?.promoteWithAd ?? null,
  }));
}

export type QuickCampaignInput = {
  name: string;
  startDate: string; // YYYY-MM-DD (converted to a full marketplace timestamp below)
  dailyBudget: number;
  listingIds: string[];
  marketplaceId?: string;
};

/**
 * Creates a new Cost-Per-Click campaign from a plain list of listing IDs — eBay builds
 * the ad group(s) and suggested keyword bids automatically (FIXED bidding strategy by
 * default). This is the least-verified function in this file: eBay's docs page for this
 * method returned only a summary via search (developer.ebay.com blocks direct fetches
 * from this environment), not the full field-by-field schema, so the exact request shape
 * below should be treated as reasoned-from-available-docs rather than confirmed against
 * a real response — verify the first real campaign created this way in Seller Hub before
 * trusting this in a hands-off flow. startDate is sent as a full marketplace-offset
 * timestamp rather than a bare date, matching the format the campaign resource's own
 * startDate/endDate fields come back in (e.g. "2025-08-09T01:40:30.000Z" on a real
 * campaign) and the same bare-date bug already confirmed on ad_report_task.
 */
export async function setupQuickCampaign(token: string, input: QuickCampaignInput): Promise<string> {
  const body = {
    campaignName: input.name,
    marketplaceId: input.marketplaceId ?? "EBAY_US",
    startDate: marketplaceTimestamp(input.startDate, false),
    fundingStrategy: { fundingModel: "COST_PER_CLICK" },
    budget: { daily: { amount: { value: input.dailyBudget.toFixed(2), currency: "USD" } } },
    listingIds: input.listingIds,
  };
  const res = await ebayFetch(`${BASE}/setup_quick_campaign`, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) await throwEbayError(res, "criar a campanha");

  const location = res.headers.get("location");
  const campaignId = location?.split("/").filter(Boolean).pop();
  if (!campaignId) throw new Error("eBay não retornou o ID da campanha criada");
  return campaignId;
}
