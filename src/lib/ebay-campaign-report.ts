import { gunzipSync } from "node:zlib";
import { getEbayAccessToken } from "@/lib/ebay-token";
import { getReportDateRange, type ReportPeriod } from "@/lib/report-periods";
import { fetchAdCampaigns } from "@/lib/ebay-campaigns";
import { withEbayCache } from "@/lib/ebay-report-cache";
import { marketplaceTimestamp } from "@/lib/ebay-time";

// eBay uses different metric key names per funding model for the same underlying
// numbers (e.g. "sale_amount" vs "cpc_sale_amount_listingsite_currency") — this maps
// each model's raw report columns onto the normalized fields our page renders.
const FUNDING_METRICS: Record<
  string,
  { metricKeys: string[]; map: Record<string, "impressions" | "clicks" | "spend" | "sales" | "revenue">; channels?: string[]; extraDimensions?: string[] }
> = {
  COST_PER_SALE: {
    metricKeys: ["impressions", "clicks", "ad_fees", "sales", "sale_amount"],
    map: { impressions: "impressions", clicks: "clicks", ad_fees: "spend", sales: "sales", sale_amount: "revenue" },
  },
  COST_PER_CLICK: {
    metricKeys: ["cpc_impressions", "cpc_clicks", "cpc_ad_fees_listingsite_currency", "cpc_attributed_sales", "cpc_sale_amount_listingsite_currency"],
    map: {
      cpc_impressions: "impressions",
      cpc_clicks: "clicks",
      cpc_ad_fees_listingsite_currency: "spend",
      cpc_attributed_sales: "sales",
      cpc_sale_amount_listingsite_currency: "revenue",
    },
    channels: ["ON_SITE"],
    extraDimensions: ["ad_group_id"],
  },
};

type CampaignTotals = { impressions: number; clicks: number; spend: number; sales: number; revenue: number };

function emptyTotals(): CampaignTotals {
  return { impressions: 0, clicks: 0, spend: 0, sales: 0, revenue: 0 };
}

async function createReportTask(token: string, fundingModel: string, campaignIds: string[], dateFrom: string, dateTo: string): Promise<string> {
  const config = FUNDING_METRICS[fundingModel];
  const body: Record<string, unknown> = {
    reportType: "CAMPAIGN_PERFORMANCE_SUMMARY_REPORT",
    fundingModels: [fundingModel],
    marketplaceId: "EBAY_US",
    campaignIds,
    dateFrom,
    dateTo,
    dimensions: [
      { dimensionKey: "day" },
      // "campaign_status" is not a documented annotation key for this report type (only
      // campaign_name/campaign_start_date/campaign_end_date are) — invalid regardless of
      // the dateFrom/dateTo format bug below, so left out rather than re-added.
      { dimensionKey: "campaign_id", annotationKeys: ["campaign_name"] },
      ...(config.extraDimensions ?? []).map((dimensionKey) => ({ dimensionKey })),
    ],
    metricKeys: config.metricKeys,
    reportFormat: "TSV_GZIP",
  };
  if (config.channels) body.channels = config.channels;

  const res = await fetch("https://api.ebay.com/sell/marketing/v1/ad_report_task", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status !== 202 && !res.ok) {
    const text = await res.text();
    // X-EBAY-C-REQUEST-ID is the correlation id eBay Developer Support asks for when a
    // request fails with a generic/internal error like 35001 — worth surfacing since the
    // XML errorMessageV3 shape this comes back in is itself unusual for a REST Sell API
    // (which normally errors as JSON), suggesting this may need their side to investigate.
    const requestId = res.headers.get("x-ebay-c-request-id") ?? res.headers.get("x-ebay-request-id");
    const suffix = requestId ? ` [status ${res.status}, X-EBAY-C-REQUEST-ID: ${requestId}]` : ` [status ${res.status}]`;
    throw new Error(`eBay recusou a tarefa de relatório (${fundingModel}): ${text.slice(0, 300)}${suffix}`);
  }

  const location = res.headers.get("location");
  const reportTaskId = location?.split("/").filter(Boolean).pop();
  if (!reportTaskId) throw new Error("eBay não retornou o ID da tarefa de relatório");
  return reportTaskId;
}

async function pollReportTask(token: string, reportTaskId: string): Promise<string> {
  const maxAttempts = 10;
  const delayMs = 2000;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`https://api.ebay.com/sell/marketing/v1/ad_report_task/${reportTaskId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.errors?.[0]?.message || `eBay respondeu ${res.status} ao checar o relatório`);
    if (data.reportTaskStatus === "SUCCESS") return data.reportHref as string;
    if (data.reportTaskStatus === "FAILED") throw new Error("A geração do relatório falhou no eBay");
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error("O relatório demorou demais para ficar pronto");
}

// eBay returns the "day" dimension as a human-readable string ("Aug 01, 2026"), not the
// "YYYY-MM-DD" format dateFrom/dateTo/start/end use — comparing them as plain strings is
// wrong (e.g. "Aug 01, 2026" > "2026-08-01" lexicographically, since 'A' > '2'), which was
// silently filtering out every single row below and made every campaign's totals show as
// zero even though eBay's report actually had real, non-zero numbers in it.
function normalizeReportDay(day: string): string {
  const parsed = new Date(day);
  if (Number.isNaN(parsed.getTime())) return day;
  return parsed.toISOString().slice(0, 10);
}

// Money metrics (ad_fees, sale_amount, and their cpc_* equivalents) come back
// currency-prefixed, e.g. "USD 12.34" — Number() on that is NaN, which silently kept
// spend/revenue at zero even on days with real money involved. Count metrics
// (impressions, clicks, sales) are already plain numbers and pass through unaffected.
function parseMetricValue(raw: string | undefined): number {
  if (raw === undefined) return NaN;
  return Number(raw.replace(/[^0-9.-]/g, ""));
}

type FundingModelResult =
  | { fundingModel: string; totals: Map<string, CampaignTotals> }
  | { fundingModel: string; error: string };

/**
 * One funding model's full submit-poll-download-parse round trip, isolated so it can
 * run concurrently with the other funding model's without either one's failure (or one
 * running long) blocking or corrupting the other's result. Returns its own totals map
 * rather than mutating a shared one, so the caller can merge results only after every
 * model has settled.
 */
async function fetchFundingModelTotals(
  token: string,
  fundingModel: string,
  campaignIds: string[],
  dateFromTs: string,
  dateToTs: string,
  start: string,
  end: string
): Promise<FundingModelResult> {
  try {
    const reportTaskId = await createReportTask(token, fundingModel, campaignIds, dateFromTs, dateToTs);
    const reportHref = await pollReportTask(token, reportTaskId);

    const fileRes = await fetch(reportHref, { headers: { Authorization: `Bearer ${token}` } });
    if (!fileRes.ok) throw new Error(`Falha ao baixar o relatório (${fundingModel}): eBay respondeu ${fileRes.status}`);
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const rows = parseTsvGz(buffer);

    const { map } = FUNDING_METRICS[fundingModel];
    const totals = new Map<string, CampaignTotals>();
    for (const row of rows) {
      const campaignId = row["campaign_id"];
      if (!campaignId) continue;
      // Defensive: dateFrom/dateTo above should already bound the response to
      // exactly [start, end], but this guards against any boundary rounding on
      // eBay's side (e.g. its own day-bucketing vs. the Pacific offset used here).
      // Must normalize first — eBay sends "day" as "Aug 01, 2026", not "YYYY-MM-DD".
      const normalizedDay = row["day"] ? normalizeReportDay(row["day"]) : "";
      if (normalizedDay && (normalizedDay < start || normalizedDay > end)) continue;
      const t = totals.get(campaignId) ?? emptyTotals();
      for (const [rawKey, field] of Object.entries(map)) {
        const value = parseMetricValue(row[rawKey]);
        if (!Number.isNaN(value)) t[field] += value;
      }
      totals.set(campaignId, t);
    }
    return { fundingModel, totals };
  } catch (e) {
    return { fundingModel, error: e instanceof Error ? e.message : String(e) };
  }
}

function parseTsvGz(buffer: Buffer): Record<string, string>[] {
  // The file uses \r\n line endings; splitting on "\n" alone leaves a trailing "\r" stuck
  // to the last column of the header (and of every row), which corrupted its key/value
  // (e.g. a "channels\r" header instead of "channels"). Strip \r everywhere first.
  const text = gunzipSync(buffer).toString("utf-8").replace(/\r/g, "");
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split("\t");
  return lines.slice(1).map((line) => {
    const cells = line.split("\t");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i]; });
    return row;
  });
}

export type CampaignMetrics = {
  campaignId: string;
  name: string;
  status: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  sales: number;
  revenue: number;
  roas: number;
  costPerSale: number;
};

export type CampaignReportPeriod = Exclude<ReportPeriod, "90d" | "all">;

export type CampaignReport = {
  period: CampaignReportPeriod;
  range: { start: string; end: string };
  totals: { impressions: number; clicks: number; ctr: number; spend: number; sales: number; revenue: number; roas: number };
  campaigns: CampaignMetrics[];
  metricsWarnings?: { fundingModel: string; error: string }[];
};

/**
 * eBay Promoted Listings campaign performance (spend/ROAS/clicks/etc per campaign).
 * Shared by the eBay Campaigns page and the Daily Report's eBay Campanhas card — same
 * cache key ("campaigns_report" + period) via withEbayCache, so a report generated by
 * one is reused by the other instead of re-running eBay's report-task/poll/download
 * round trip twice for the same window.
 */
export async function fetchCampaignReport(
  period: CampaignReportPeriod
): Promise<{ report: CampaignReport; stale: boolean; fetchedAt: string | null }> {
  const { data, stale, fetchedAt } = await withEbayCache("campaigns_report", { period }, async () => {
    const { start, end } = getReportDateRange(period);
    // "now" rather than end-of-day when the range runs through today — 23:59:59 today
    // hasn't happened yet, and eBay rejects a future dateTo.
    const isEndToday = end === getReportDateRange("today").end;
    const dateFromTs = marketplaceTimestamp(start, false);
    const dateToTs = isEndToday ? new Date().toISOString() : marketplaceTimestamp(end, true);
    const token = await getEbayAccessToken();
    const campaigns = await fetchAdCampaigns(token);

    // Only RUNNING/PAUSED campaigns can possibly have data for a "today"/"yesterday"/
    // recent-days window — an ENDED campaign (some of this account's are a year old)
    // has none, so asking for one is pointless regardless of the dateFrom/dateTo bug
    // below. Every COST_PER_CLICK campaign here is currently ENDED, so that model is
    // skipped entirely rather than sent and left with an empty/zero report.
    const campaignIdsByFundingModel = new Map<string, string[]>();
    for (const c of campaigns) {
      if (!c.fundingModel || !FUNDING_METRICS[c.fundingModel]) continue;
      if (c.status !== "RUNNING" && c.status !== "PAUSED") continue;
      const list = campaignIdsByFundingModel.get(c.fundingModel) ?? [];
      list.push(c.campaignId);
      campaignIdsByFundingModel.set(c.fundingModel, list);
    }

    const totalsByCampaignId = new Map<string, CampaignTotals>();

    // Each funding model's report is an independent submit-poll-download round trip —
    // run concurrently rather than one after another, since neither depends on the
    // other's result and eBay's own 35001 errors turned out to be a dateFrom/dateTo
    // format bug, not a concurrency issue. This roughly halves worst-case wall time
    // (bounded by the slower of the two instead of their sum) and gives more margin
    // under the 60s ceiling below. Failures stay isolated per model: one funding model
    // erroring shouldn't blank out real numbers for the other one.
    const results = await Promise.all(
      [...campaignIdsByFundingModel.entries()].map(([fundingModel, campaignIds]) =>
        fetchFundingModelTotals(token, fundingModel, campaignIds, dateFromTs, dateToTs, start, end)
      )
    );

    const modelWarnings: { fundingModel: string; error: string }[] = [];
    for (const result of results) {
      if ("error" in result) {
        modelWarnings.push({ fundingModel: result.fundingModel, error: result.error });
      } else {
        for (const [campaignId, totals] of result.totals) {
          totalsByCampaignId.set(campaignId, totals);
        }
      }
    }

    // Only bail out entirely (falling back to the last stale cache, if any) when every
    // model failed — a partial result with some real numbers is still more useful than
    // an all-or-nothing error, especially since eBay is the one erroring, not us.
    if (modelWarnings.length > 0 && modelWarnings.length === campaignIdsByFundingModel.size) {
      throw new Error(modelWarnings.map((w) => `${w.fundingModel}: ${w.error}`).join(" | "));
    }

    const campaignRows: CampaignMetrics[] = campaigns.map((c) => {
      const t = totalsByCampaignId.get(c.campaignId) ?? emptyTotals();
      return {
        campaignId: c.campaignId,
        name: c.name,
        status: c.status,
        impressions: t.impressions,
        clicks: t.clicks,
        ctr: t.impressions > 0 ? t.clicks / t.impressions : 0,
        spend: t.spend,
        sales: t.sales,
        revenue: t.revenue,
        roas: t.spend > 0 ? t.revenue / t.spend : 0,
        costPerSale: t.sales > 0 ? t.spend / t.sales : 0,
      };
    });

    const totals = campaignRows.reduce(
      (acc, r) => ({
        impressions: acc.impressions + r.impressions,
        clicks: acc.clicks + r.clicks,
        spend: acc.spend + r.spend,
        sales: acc.sales + r.sales,
        revenue: acc.revenue + r.revenue,
      }),
      emptyTotals()
    );

    const report: CampaignReport = {
      period,
      range: { start, end },
      totals: {
        ...totals,
        ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
        roas: totals.spend > 0 ? totals.revenue / totals.spend : 0,
      },
      campaigns: campaignRows,
      // Present only when some (not all) funding models failed — the numbers above are
      // real for whichever models succeeded, just incomplete for the ones listed here.
      metricsWarnings: modelWarnings.length > 0 ? modelWarnings : undefined,
    };
    return report;
  });

  return { report: data, stale, fetchedAt };
}
