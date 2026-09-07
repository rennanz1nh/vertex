import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getEbayAccessToken } from "@/lib/ebay-token";
import { getCampaignDetail, deleteCampaign } from "@/lib/ebay-campaign-management";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const auth = await requireAdmin(_request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { campaignId } = await params;
  try {
    const token = await getEbayAccessToken();
    const detail = await getCampaignDetail(token, campaignId);
    return NextResponse.json({ detail });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("eBay token not found") || message.includes("reconnect") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

// eBay only allows this for campaigns that have already ENDED.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const auth = await requireAdmin(_request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { campaignId } = await params;
  try {
    const token = await getEbayAccessToken();
    await deleteCampaign(token, campaignId);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("eBay token not found") || message.includes("reconnect") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
