export type AdCampaign = {
  campaignId: string;
  name: string;
  status: string;
  fundingModel: string | null;
  dailyBudget: number | null;
  currency: string | null;
  startDate: string | null;
  endDate: string | null;
};

type RawCampaign = {
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  startDate?: string;
  endDate?: string | null;
  fundingStrategy?: { fundingModel?: string };
  budget?: { daily?: { amount?: { value?: string; currency?: string } } };
};

/** All Promoted Listings campaigns (any status) for the connected eBay account. */
export async function fetchAdCampaigns(token: string): Promise<AdCampaign[]> {
  const res = await fetch("https://api.ebay.com/sell/marketing/v1/ad_campaign?limit=200", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();

  if (!res.ok) {
    const message = data?.errors?.[0]?.message || `eBay respondeu ${res.status}`;
    throw new Error(message);
  }

  const campaigns = (data.campaigns ?? []) as RawCampaign[];
  return campaigns.map((c) => ({
    campaignId: c.campaignId,
    name: c.campaignName,
    status: c.campaignStatus,
    fundingModel: c.fundingStrategy?.fundingModel ?? null,
    dailyBudget: c.budget?.daily?.amount?.value ? Number(c.budget.daily.amount.value) : null,
    currency: c.budget?.daily?.amount?.currency ?? null,
    startDate: c.startDate ?? null,
    endDate: c.endDate ?? null,
  }));
}
