export type ReportPeriod = "today" | "yesterday" | "7d" | "30d" | "90d" | "all";

export const REPORT_PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
];

// eBay's Analytics API (traffic_report) rejects date ranges beyond 90 days, so this is
// the widest window the Traffic report can offer.
export const REPORT_PERIODS_90D: { value: ReportPeriod; label: string }[] = [
  ...REPORT_PERIODS,
  { value: "90d", label: "90 dias" },
];

// Sales figures come from our own Supabase orders table (not an eBay report API), so
// there's no external lookback limit — "Período Todo" is safe to offer here only.
export const SALES_REPORT_PERIODS: { value: ReportPeriod; label: string }[] = [
  ...REPORT_PERIODS_90D,
  { value: "all", label: "Período Todo" },
];

export function isReportPeriod(value: string | null): value is ReportPeriod {
  return (
    value === "today" ||
    value === "yesterday" ||
    value === "7d" ||
    value === "30d" ||
    value === "90d" ||
    value === "all"
  );
}

// eBay's reporting APIs reject date ranges that are "in the future" using the US
// marketplace's own day boundary (Pacific Time), not the seller's local time zone.
// Brazil (UTC-3) runs 4-5h ahead of Pacific, so anchoring "today" to America/Sao_Paulo
// meant every request between ~20:00-23:59 BRT got rejected as a future date. Anchoring
// to the marketplace's time zone instead keeps "Hoje" aligned with what eBay itself
// considers today.
function todayMarketplaceDate(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
}

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Inclusive [start, end] date range (YYYY-MM-DD, US marketplace calendar days) for a
 * report period. "7d"/"30d"/"90d" are rolling windows that include today, matching how
 * most seller dashboards (including eBay's) present "last N days".
 *
 * "all" has no fixed start date (it depends on the data source's own history), so it is
 * excluded here — callers that support it (currently only the eBay sales report) must
 * branch on `period === "all"` before calling this function.
 */
export function getReportDateRange(period: Exclude<ReportPeriod, "all">): { start: string; end: string } {
  const today = todayMarketplaceDate();
  switch (period) {
    case "today":
      return { start: today, end: today };
    case "yesterday": {
      const yesterday = shiftDate(today, -1);
      return { start: yesterday, end: yesterday };
    }
    case "7d":
      return { start: shiftDate(today, -6), end: today };
    case "30d":
      return { start: shiftDate(today, -29), end: today };
    case "90d":
      return { start: shiftDate(today, -89), end: today };
  }
}
