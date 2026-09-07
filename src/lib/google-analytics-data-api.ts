import { getAnalyticsAccessToken, getGa4PropertyId } from "@/lib/google-cloud-auth";

// The GA4 Data API (analyticsdata.googleapis.com) — actual traffic/conversion numbers,
// distinct from google-analytics-admin-api.ts (analyticsadmin.googleapis.com), which only
// reads property metadata and BigQuery link status, never real report data. Both share the
// same cached analytics.readonly token and GA4 Property ID — this needed no new scope and
// no new GCP-side setup, since the Data API is covered by the same OAuth scope already
// minted for the Admin API.
const ANALYTICS_DATA_BASE = "https://analyticsdata.googleapis.com/v1beta";

export type Ga4Totals = {
  sessions: number;
  activeUsers: number;
  conversions: number;
  totalRevenue: number;
  currency: string;
};

export type Ga4DailyRow = { date: string; sessions: number; activeUsers: number; conversions: number; totalRevenue: number };

export type Ga4Report = { totals: Ga4Totals; daily: Ga4DailyRow[] };

function toIsoDate(d: string): string {
  // GA4's own "yesterday"/"NdaysAgo" relative-date syntax is simpler and avoids a
  // timezone mismatch with the property's own reporting timezone — no need to compute
  // absolute dates here the way report-periods.ts does for eBay/Google Shopping.
  return d;
}

// "1daysAgo" to "today" would span 2 calendar days (yesterday + today) — for the
// dedicated "Hoje" period we want just today, so that one case uses "today" as both ends.
function startDateFor(days: number): string {
  return days <= 1 ? "today" : `${days}daysAgo`;
}

const METRICS = [{ name: "sessions" }, { name: "activeUsers" }, { name: "conversions" }, { name: "totalRevenue" }];

async function runReport(accessToken: string, propertyId: string, body: Record<string, unknown>) {
  const res = await fetch(`${ANALYTICS_DATA_BASE}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Analytics Data API error (${res.status}): ${text.slice(0, 500)}`);
  }
  return res.json();
}

/**
 * Sessions, active users, conversions and revenue for the last N days, both as a totals
 * summary and a day-by-day breakdown (for a simple trend chart). Runs two report calls
 * rather than summing the daily rows for the totals: activeUsers is a distinct-user count,
 * so adding each day's activeUsers together double-counts anyone active on more than one
 * day in the window — GA4's own dateRange-only aggregate query (no date dimension)
 * de-duplicates correctly, sessions/conversions/revenue don't have this problem but are
 * pulled from the same aggregate call for consistency.
 */
export async function runTrafficReport(days: number): Promise<Ga4Report> {
  const propertyId = await getGa4PropertyId();
  if (!propertyId) {
    throw new Error("GA4 Property ID não configurado. Defina o Property ID numérico nas configurações.");
  }
  const accessToken = await getAnalyticsAccessToken();
  const dateRanges = [{ startDate: toIsoDate(startDateFor(days)), endDate: toIsoDate("today") }];

  const [totalsData, dailyData] = await Promise.all([
    runReport(accessToken, propertyId, { dateRanges, metrics: METRICS }),
    runReport(accessToken, propertyId, { dateRanges, dimensions: [{ name: "date" }], metrics: METRICS, orderBys: [{ dimension: { dimensionName: "date" } }] }),
  ]);

  const totalsRow = totalsData.rows?.[0]?.metricValues as { value: string }[] | undefined;
  const totals: Ga4Totals = {
    sessions: Number(totalsRow?.[0]?.value ?? 0),
    activeUsers: Number(totalsRow?.[1]?.value ?? 0),
    conversions: Number(totalsRow?.[2]?.value ?? 0),
    totalRevenue: Number(totalsRow?.[3]?.value ?? 0),
    currency: "",
  };

  const daily: Ga4DailyRow[] = (dailyData.rows ?? []).map((row: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => {
    const raw = row.dimensionValues[0].value; // YYYYMMDD
    const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    return {
      date,
      sessions: Number(row.metricValues[0].value || 0),
      activeUsers: Number(row.metricValues[1].value || 0),
      conversions: Number(row.metricValues[2].value || 0),
      totalRevenue: Number(row.metricValues[3].value || 0),
    };
  });

  return { totals, daily };
}

/**
 * Sessions/activeUsers totals for the N-day window immediately before the current one —
 * e.g. days=30 compares "last 30 days" against the 30 days before that. Used only for the
 * top stat cards' %-change indicators, so it skips the daily breakdown the main report needs.
 */
export async function runPreviousPeriodTotals(days: number): Promise<Ga4Totals> {
  const propertyId = await getGa4PropertyId();
  if (!propertyId) throw new Error("GA4 Property ID não configurado.");
  const accessToken = await getAnalyticsAccessToken();
  const dateRanges =
    days <= 1
      ? [{ startDate: "yesterday", endDate: "yesterday" }]
      : [{ startDate: `${days * 2}daysAgo`, endDate: `${days + 1}daysAgo` }];

  const data = await runReport(accessToken, propertyId, { dateRanges, metrics: METRICS });
  const row = data.rows?.[0]?.metricValues as { value: string }[] | undefined;
  return {
    sessions: Number(row?.[0]?.value ?? 0),
    activeUsers: Number(row?.[1]?.value ?? 0),
    conversions: Number(row?.[2]?.value ?? 0),
    totalRevenue: Number(row?.[3]?.value ?? 0),
    currency: "",
  };
}

export type TrafficSourceRow = { source: string; sessions: number };
export type TopPageRow = { path: string; views: number };
export type GeographyRow = { country: string; sessions: number };
export type EngagementTotals = { avgSessionDuration: number; bounceRate: number; pagesPerSession: number };
export type ButtonClickRow = { label: string; clicks: number };

export async function runTrafficSourcesReport(days: number): Promise<TrafficSourceRow[]> {
  const propertyId = await getGa4PropertyId();
  if (!propertyId) throw new Error("GA4 Property ID não configurado.");
  const accessToken = await getAnalyticsAccessToken();

  const data = await runReport(accessToken, propertyId, {
    dateRanges: [{ startDate: startDateFor(days), endDate: "today" }],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 10,
  });

  return (data.rows ?? []).map((row: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
    source: row.dimensionValues[0].value || "(direto)",
    sessions: Number(row.metricValues[0].value || 0),
  }));
}

export async function runTopPagesReport(days: number): Promise<TopPageRow[]> {
  const propertyId = await getGa4PropertyId();
  if (!propertyId) throw new Error("GA4 Property ID não configurado.");
  const accessToken = await getAnalyticsAccessToken();

  const data = await runReport(accessToken, propertyId, {
    dateRanges: [{ startDate: startDateFor(days), endDate: "today" }],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 10,
  });

  return (data.rows ?? []).map((row: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
    path: row.dimensionValues[0].value,
    views: Number(row.metricValues[0].value || 0),
  }));
}

export async function runGeographyReport(days: number): Promise<GeographyRow[]> {
  const propertyId = await getGa4PropertyId();
  if (!propertyId) throw new Error("GA4 Property ID não configurado.");
  const accessToken = await getAnalyticsAccessToken();

  const data = await runReport(accessToken, propertyId, {
    dateRanges: [{ startDate: startDateFor(days), endDate: "today" }],
    dimensions: [{ name: "country" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 10,
  });

  return (data.rows ?? []).map((row: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
    country: row.dimensionValues[0].value || "(desconhecido)",
    sessions: Number(row.metricValues[0].value || 0),
  }));
}

export async function runEngagementReport(days: number): Promise<EngagementTotals> {
  const propertyId = await getGa4PropertyId();
  if (!propertyId) throw new Error("GA4 Property ID não configurado.");
  const accessToken = await getAnalyticsAccessToken();

  const data = await runReport(accessToken, propertyId, {
    dateRanges: [{ startDate: startDateFor(days), endDate: "today" }],
    metrics: [{ name: "averageSessionDuration" }, { name: "bounceRate" }, { name: "screenPageViewsPerSession" }],
  });

  const row = data.rows?.[0]?.metricValues as { value: string }[] | undefined;
  return {
    avgSessionDuration: Number(row?.[0]?.value ?? 0),
    bounceRate: Number(row?.[1]?.value ?? 0),
    pagesPerSession: Number(row?.[2]?.value ?? 0),
  };
}

/**
 * Custom event fired by the site's own click tracker (see ButtonClickTracker). Only
 * returns data once the `button_label` custom dimension has been registered in GA4 —
 * see ensureButtonClickCustomDimension in google-analytics-admin-api.ts — and only for
 * clicks that happened after that registration (GA4 doesn't back-fill custom dimensions
 * onto events collected before the dimension existed).
 */
export async function runButtonClicksReport(days: number): Promise<ButtonClickRow[]> {
  const propertyId = await getGa4PropertyId();
  if (!propertyId) throw new Error("GA4 Property ID não configurado.");
  const accessToken = await getAnalyticsAccessToken();

  const data = await runReport(accessToken, propertyId, {
    dateRanges: [{ startDate: startDateFor(days), endDate: "today" }],
    dimensions: [{ name: "customEvent:button_label" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: { fieldName: "eventName", stringFilter: { value: "button_click" } },
    },
    orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    limit: 15,
  });

  return (data.rows ?? [])
    .map((row: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
      label: row.dimensionValues[0].value,
      clicks: Number(row.metricValues[0].value || 0),
    }))
    .filter((r: ButtonClickRow) => r.label && r.label !== "(not set)");
}

export type YesterdaySummary = {
  sessions: number;
  activeUsers: number;
  topPages: TopPageRow[];
};

/**
 * Sessions/users/top-pages for exactly yesterday (GA4's own reporting timezone) — used
 * by the daily report generator, which always runs the morning after. A dedicated
 * function rather than reusing the days-based reports above, since those anchor to
 * "today" and have no way to express "yesterday only".
 */
export async function runYesterdaySummary(): Promise<YesterdaySummary> {
  const propertyId = await getGa4PropertyId();
  if (!propertyId) throw new Error("GA4 Property ID não configurado.");
  const accessToken = await getAnalyticsAccessToken();
  const dateRanges = [{ startDate: "yesterday", endDate: "yesterday" }];

  const [totalsData, pagesData] = await Promise.all([
    runReport(accessToken, propertyId, { dateRanges, metrics: [{ name: "sessions" }, { name: "activeUsers" }] }),
    runReport(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 5,
    }),
  ]);

  const totalsRow = totalsData.rows?.[0]?.metricValues as { value: string }[] | undefined;
  return {
    sessions: Number(totalsRow?.[0]?.value ?? 0),
    activeUsers: Number(totalsRow?.[1]?.value ?? 0),
    topPages: (pagesData.rows ?? []).map((row: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
      path: row.dimensionValues[0].value,
      views: Number(row.metricValues[0].value || 0),
    })),
  };
}

export type RealtimeSnapshot = {
  activeUsers: number;
  byPage: { page: string; users: number }[];
  byCountry: { country: string; users: number }[];
};

/**
 * "Right now" active users (GA4's own rolling ~30-minute window) via the separate
 * Realtime Data API — a different endpoint from :runReport, with its own smaller set of
 * supported dimensions/metrics. Used for the live "Agora no site" widget; polled from the
 * client, not stored anywhere.
 */
export async function runRealtimeActiveUsers(): Promise<RealtimeSnapshot> {
  const propertyId = await getGa4PropertyId();
  if (!propertyId) throw new Error("GA4 Property ID não configurado.");
  const accessToken = await getAnalyticsAccessToken();

  const [totalData, pageData, countryData] = await Promise.all([
    fetch(`${ANALYTICS_DATA_BASE}/properties/${propertyId}:runRealtimeReport`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ metrics: [{ name: "activeUsers" }] }),
    }).then((r) => r.json()),
    fetch(`${ANALYTICS_DATA_BASE}/properties/${propertyId}:runRealtimeReport`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dimensions: [{ name: "unifiedScreenName" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        limit: 10,
      }),
    }).then((r) => r.json()),
    fetch(`${ANALYTICS_DATA_BASE}/properties/${propertyId}:runRealtimeReport`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dimensions: [{ name: "country" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        limit: 10,
      }),
    }).then((r) => r.json()),
  ]);

  const totalRow = totalData.rows?.[0]?.metricValues as { value: string }[] | undefined;
  return {
    activeUsers: Number(totalRow?.[0]?.value ?? 0),
    byPage: (pageData.rows ?? []).map((row: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
      page: row.dimensionValues[0].value || "(desconhecida)",
      users: Number(row.metricValues[0].value || 0),
    })),
    byCountry: (countryData.rows ?? []).map((row: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
      country: row.dimensionValues[0].value || "(desconhecido)",
      users: Number(row.metricValues[0].value || 0),
    })),
  };
}
