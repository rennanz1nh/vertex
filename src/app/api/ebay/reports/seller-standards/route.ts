import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getEbayAccessToken } from "@/lib/ebay-token";
import { withEbayCache } from "@/lib/ebay-report-cache";

type StandardsMetric = {
  metricKey: string;
  name: string;
  level: string;
  value: number | string | { value: string; currencyCodeEnum?: string; numerator?: number; denominator?: number };
};

function formatMetricValue(m: StandardsMetric): string {
  const v = m.value;
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  if (v.currencyCodeEnum) return `$${v.value}`;
  if (v.numerator !== undefined && v.denominator !== undefined) return `${v.value}% (${v.numerator}/${v.denominator})`;
  return v.value;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  try {
    const { data, stale, fetchedAt } = await withEbayCache("seller_standards", null, async () => {
      const token = await getEbayAccessToken();
      const res = await fetch("https://api.ebay.com/sell/analytics/v1/seller_standards_profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();

      if (!res.ok) {
        const message = body?.errors?.[0]?.message || `eBay respondeu ${res.status}`;
        throw new Error(message);
      }

      // eBay returns both CURRENT and PROJECTED cycles per program — PROJECTED is a
      // mid-cycle forecast, not useful for a plain viewing dashboard and would otherwise
      // duplicate `program` as a React key, so only the settled CURRENT cycle is kept.
      const currentOnly = (body.standardsProfiles ?? []).filter(
        (p: { cycle?: { cycleType?: string } }) => p.cycle?.cycleType === "CURRENT"
      );

      const profiles = currentOnly.map((p: {
        standardsLevel: string;
        program: string;
        cycle: { evaluationMonth: string; cycleType: string };
        metrics: StandardsMetric[];
      }) => ({
        standardsLevel: p.standardsLevel,
        program: p.program,
        evaluationMonth: p.cycle?.evaluationMonth ?? null,
        cycleType: p.cycle?.cycleType ?? null,
        metrics: (p.metrics ?? []).map((m) => ({
          key: m.metricKey,
          name: m.name,
          level: m.level,
          displayValue: formatMetricValue(m),
        })),
      }));

      return { profiles };
    });

    return NextResponse.json({ ...data, stale, fetchedAt });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("eBay token not found") || message.includes("reconnect") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
