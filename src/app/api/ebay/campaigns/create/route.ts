import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getEbayAccessToken } from "@/lib/ebay-token";
import { setupQuickCampaign } from "@/lib/ebay-campaign-management";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const startDate = typeof body.startDate === "string" ? body.startDate : "";
  const dailyBudget = Number(body.dailyBudget);
  const listingIds = Array.isArray(body.listingIds) ? body.listingIds.filter((id: unknown) => typeof id === "string") : [];

  if (!name) return NextResponse.json({ error: "Nome da campanha é obrigatório" }, { status: 400 });
  if (!startDate) return NextResponse.json({ error: "Data de início é obrigatória" }, { status: 400 });
  if (!Number.isFinite(dailyBudget) || dailyBudget <= 0) {
    return NextResponse.json({ error: "Orçamento diário precisa ser um número maior que zero" }, { status: 400 });
  }
  if (listingIds.length === 0) {
    return NextResponse.json({ error: "Selecione pelo menos um anúncio para a campanha" }, { status: 400 });
  }

  try {
    const token = await getEbayAccessToken();
    const campaignId = await setupQuickCampaign(token, { name, startDate, dailyBudget, listingIds });
    return NextResponse.json({ campaignId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("eBay token not found") || message.includes("reconnect") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
