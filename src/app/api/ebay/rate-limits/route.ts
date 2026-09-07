import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getEbayAccessToken } from "@/lib/ebay-token";

type EbayRate = { count: number; limit: number; remaining: number; reset: string; timeWindow: number };
type EbayResource = { name: string; rates: EbayRate[] };
type EbayApiBlock = { apiContext: string; apiName: string; resources: EbayResource[] };

// Only the resources our own features actually call — the account has ~90 Trading API
// resources most of which are unused and would just be noise here.
const TRACKED = [
  { match: "sell.analytics.traffic_report", label: "Relatório de Tráfego" },
  { match: "sell.analytics.seller_standards_profile", label: "Nível de Vendedor" },
  { match: "sell.analytics.customer_service_metric", label: "Atendimento ao Cliente" },
  { match: "GetMyeBaySelling", label: "Listagem de Anúncios" },
  { match: "ReviseItem", label: "Atualização de Preço" },
  { match: "sell.marketing.ads.campaign", label: "Campanhas de Anúncios" },
  { match: "sell.marketing", label: "Relatório de Campanhas" },
];

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  try {
    const token = await getEbayAccessToken();
    const res = await fetch("https://api.ebay.com/developer/analytics/v1_beta/rate_limit/", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const message = data?.errors?.[0]?.message || `eBay respondeu ${res.status}`;
      return NextResponse.json({ error: message }, { status: res.status === 401 ? 401 : 502 });
    }

    const data = await res.json();
    const blocks = (data.rateLimits ?? []) as EbayApiBlock[];
    const allResources = blocks.flatMap((b) => b.resources ?? []);

    const limits = TRACKED.map((t) => {
      const resource = allResources.find((r) => r.name === t.match);
      const rate = resource?.rates?.[0];
      if (!rate) return null;
      return {
        key: t.match,
        label: t.label,
        limit: rate.limit,
        used: rate.count,
        remaining: rate.remaining,
        resetAt: rate.reset,
      };
    }).filter(Boolean);

    return NextResponse.json({ limits });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("eBay token not found") || message.includes("reconnect") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
