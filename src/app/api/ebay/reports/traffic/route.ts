import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getEbayAccessToken } from "@/lib/ebay-token";
import { getReportDateRange, isReportPeriod } from "@/lib/report-periods";
import { withEbayCache } from "@/lib/ebay-report-cache";

const METRICS = ["LISTING_IMPRESSION_TOTAL", "LISTING_VIEWS_TOTAL", "TRANSACTION", "CLICK_THROUGH_RATE", "SALES_CONVERSION_RATE"];

function toCompactDate(date: string): string {
  return date.replace(/-/g, "");
}

type EbayMetricRecord = {
  dimensionValues: { value: string }[];
  metricValues: { value: number }[];
};

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const periodParam = request.nextUrl.searchParams.get("period");
  if (!isReportPeriod(periodParam)) {
    return NextResponse.json({ error: "period inválido (use today, yesterday, 7d, 30d ou 90d)" }, { status: 400 });
  }
  // eBay's Analytics API rejects date ranges beyond 90 days, so there's no fixed start
  // date to anchor "período todo" to for this report.
  if (periodParam === "all") {
    return NextResponse.json({ error: "Período 'Todo' não é suportado no relatório de tráfego (limite de 90 dias da API do eBay)" }, { status: 400 });
  }

  try {
    const { data, stale, fetchedAt } = await withEbayCache("traffic", { period: periodParam }, async () => {
      const { start, end } = getReportDateRange(periodParam);
      const token = await getEbayAccessToken();

      const filter = `marketplace_ids:{EBAY_US},date_range:[${toCompactDate(start)}..${toCompactDate(end)}]`;
      const url = `https://api.ebay.com/sell/analytics/v1/traffic_report?filter=${encodeURIComponent(filter)}&dimension=DAY&metric=${METRICS.join(",")}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        },
      });
      const body = await res.json();

      if (!res.ok) {
        const message = body?.errors?.[0]?.message || `eBay respondeu ${res.status}`;
        throw new Error(message);
      }

      // metricValues[i] corresponds to header.metrics[i].key — the response does NOT
      // preserve the order the `metric` query param was requested in.
      const metricKeys: string[] = (body.header?.metrics ?? []).map((m: { key: string }) => m.key);
      const records = (body.records ?? []) as EbayMetricRecord[];

      const daily = records
        .map((r) => {
          const raw = r.dimensionValues?.[0]?.value ?? "";
          const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
          const values: Record<string, number> = {};
          (r.metricValues ?? []).forEach((mv, i) => { values[metricKeys[i]] = mv.value; });
          return { date, values };
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      const sumMetric = (key: string) => daily.reduce((s, d) => s + (d.values[key] ?? 0), 0);
      const avgMetric = (key: string) => (daily.length ? daily.reduce((s, d) => s + (d.values[key] ?? 0), 0) / daily.length : 0);

      return {
        period: periodParam,
        range: { start, end },
        impressions: sumMetric("LISTING_IMPRESSION_TOTAL"),
        views: sumMetric("LISTING_VIEWS_TOTAL"),
        transactions: sumMetric("TRANSACTION"),
        clickThroughRate: avgMetric("CLICK_THROUGH_RATE"),
        salesConversionRate: avgMetric("SALES_CONVERSION_RATE"),
        daily: daily.map((d) => ({
          date: d.date,
          impressions: d.values.LISTING_IMPRESSION_TOTAL ?? 0,
          views: d.values.LISTING_VIEWS_TOTAL ?? 0,
        })),
      };
    });

    return NextResponse.json({ ...data, stale, fetchedAt });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("eBay token not found") || message.includes("reconnect") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
