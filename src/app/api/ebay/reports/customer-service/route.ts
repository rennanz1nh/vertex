import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getEbayAccessToken } from "@/lib/ebay-token";
import { withEbayCache } from "@/lib/ebay-report-cache";

type MetricType = "ITEM_NOT_AS_DESCRIBED" | "ITEM_NOT_RECEIVED";

type DimensionMetric = {
  dimension: { dimensionKey: string; value: string; name: string };
  metrics: { metricKey: string; value: string }[];
};

async function fetchMetric(token: string, type: MetricType) {
  const res = await fetch(
    `https://api.ebay.com/sell/analytics/v1/customer_service_metric/${type}/CURRENT?evaluation_marketplace_id=EBAY_US`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (!res.ok) {
    const message = data?.errors?.[0]?.message || `eBay respondeu ${res.status}`;
    throw new Error(message);
  }

  const rows = (data.dimensionMetrics ?? []) as DimensionMetric[];
  return {
    type,
    evaluationDate: data.evaluationCycle?.evaluationDate ?? null,
    breakdown: rows.map((r) => {
      const byKey = Object.fromEntries((r.metrics ?? []).map((m) => [m.metricKey, m.value]));
      return {
        dimension: r.dimension?.name ?? r.dimension?.value ?? "",
        rate: byKey.RATE ? Number(byKey.RATE) : null,
        count: byKey.COUNT ? Number(byKey.COUNT) : null,
        transactionCount: byKey.TRANSACTION_COUNT ? Number(byKey.TRANSACTION_COUNT) : null,
      };
    }),
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  try {
    const { data, stale, fetchedAt } = await withEbayCache("customer_service", null, async () => {
      const token = await getEbayAccessToken();
      const [inad, inr] = await Promise.all([
        fetchMetric(token, "ITEM_NOT_AS_DESCRIBED"),
        fetchMetric(token, "ITEM_NOT_RECEIVED"),
      ]);
      return { inad, inr };
    });
    return NextResponse.json({ ...data, stale, fetchedAt });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("eBay token not found") || message.includes("reconnect") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
