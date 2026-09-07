import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getEbayAccessToken } from "@/lib/ebay-token";
import { fetchAdCampaigns } from "@/lib/ebay-campaigns";
import { withEbayCache } from "@/lib/ebay-report-cache";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  try {
    const { data, stale, fetchedAt } = await withEbayCache("campaigns", null, async () => {
      const token = await getEbayAccessToken();
      const campaigns = await fetchAdCampaigns(token);
      return { campaigns };
    });
    return NextResponse.json({ ...data, stale, fetchedAt });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("eBay token not found") || message.includes("reconnect") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
