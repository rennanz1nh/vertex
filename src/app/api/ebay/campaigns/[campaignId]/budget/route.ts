import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getEbayAccessToken } from "@/lib/ebay-token";
import { updateCampaignBudget } from "@/lib/ebay-campaign-management";

// eBay itself caps this at 15 updates per campaign per day, and rejects a change smaller
// than $0.50 — both surface as eBay's own error text via updateCampaignBudget, not
// pre-validated here (the caller would need this campaign's current budget to check that,
// which the client already has from the detail view).
export async function PUT(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { campaignId } = await params;
  const body = await request.json().catch(() => ({}));
  const dailyBudget = Number(body.dailyBudget);
  if (!Number.isFinite(dailyBudget) || dailyBudget <= 0) {
    return NextResponse.json({ error: "dailyBudget precisa ser um número maior que zero" }, { status: 400 });
  }

  try {
    const token = await getEbayAccessToken();
    await updateCampaignBudget(token, campaignId, dailyBudget, typeof body.currency === "string" ? body.currency : "USD");
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("eBay token not found") || message.includes("reconnect") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
