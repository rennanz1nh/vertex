import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { fetchAllActiveListings as fetchEbayListings } from "@/lib/ebay-price-update";
import { fetchAllActiveListings as fetchAmazonListings } from "@/lib/amazon-price-update";
import { fetchAllActiveListings as fetchTikTokListings } from "@/lib/tiktok-shop-price-update";
import { fetchListingTrafficReport, type ListingTrafficRecord } from "@/lib/ebay-listing-traffic";
import { fetchCampaignReport, type CampaignMetrics } from "@/lib/ebay-campaign-report";
import { runYesterdaySummary } from "@/lib/google-analytics-data-api";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

/** Yesterday's date (YYYY-MM-DD) in America/Sao_Paulo — the report always covers the
 *  full day before the morning it's generated. */
function yesterdayBRT(): string {
  const todayParts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).formatToParts(new Date());
  const y = Number(todayParts.find((p) => p.type === "year")!.value);
  const m = Number(todayParts.find((p) => p.type === "month")!.value);
  const d = Number(todayParts.find((p) => p.type === "day")!.value);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function dayBefore(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

type SalesByChannel = { canal: string; revenue: number; orders: number };

async function loadSales(reportDate: string) {
  const supabase = getSupabase();
  const prevDate = dayBefore(reportDate);

  // Cancelled orders are excluded from revenue/order-count — same rule as the admin
  // dashboards (Reports.tsx), so this report's numbers stay consistent with those.
  const [{ data: rows }, { data: prevRows }, { data: cancelledRows }] = await Promise.all([
    supabase.from("orders").select("total, canal").eq("data_pedido", reportDate).neq("status", "Cancelado"),
    supabase.from("orders").select("total").eq("data_pedido", prevDate).neq("status", "Cancelado"),
    supabase.from("orders").select("total").eq("data_pedido", reportDate).eq("status", "Cancelado"),
  ]);

  const byChannel = new Map<string, SalesByChannel>();
  let revenue = 0;
  for (const r of rows ?? []) {
    const canal = r.canal || "Outro";
    const entry = byChannel.get(canal) ?? { canal, revenue: 0, orders: 0 };
    entry.revenue += Number(r.total) || 0;
    entry.orders += 1;
    byChannel.set(canal, entry);
    revenue += Number(r.total) || 0;
  }
  const prevRevenue = (prevRows ?? []).reduce((s, r) => s + (Number(r.total) || 0), 0);
  const cancelledRevenue = (cancelledRows ?? []).reduce((s, r) => s + (Number(r.total) || 0), 0);

  return {
    revenue,
    orders: (rows ?? []).length,
    byChannel: [...byChannel.values()].sort((a, b) => b.revenue - a.revenue),
    vsPreviousDayRevenuePct: prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null,
    cancelledOrders: (cancelledRows ?? []).length,
    cancelledRevenue,
  };
}

async function loadTraffic() {
  try {
    const [today, prevDate] = [yesterdayBRT(), dayBefore(yesterdayBRT())];
    void prevDate; // reserved for a future vs-previous-day traffic comparison
    const summary = await runYesterdaySummary();
    return { ...summary, error: null as string | null, date: today };
  } catch (e: unknown) {
    return { sessions: 0, activeUsers: 0, topPages: [], error: e instanceof Error ? e.message : "Falha ao carregar GA4", date: null };
  }
}

type CatalogEntry = { channel: string; count: number; error: string | null };

async function loadCatalog(): Promise<CatalogEntry[]> {
  const supabase = getSupabase();
  const results = await Promise.all([
    fetchEbayListings().then((l) => ({ channel: "eBay", count: l.length, error: null })).catch((e) => ({ channel: "eBay", count: 0, error: e instanceof Error ? e.message : "Falha" })),
    fetchAmazonListings().then((l) => ({ channel: "Amazon", count: l.length, error: null })).catch((e) => ({ channel: "Amazon", count: 0, error: e instanceof Error ? e.message : "Falha" })),
    fetchTikTokListings().then((l) => ({ channel: "TikTok Shop", count: l.length, error: null })).catch((e) => ({ channel: "TikTok Shop", count: 0, error: e instanceof Error ? e.message : "Falha" })),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_visible", true)
      .then(({ count, error }) => ({ channel: "Website", count: count ?? 0, error: error ? error.message : null })),
  ]);
  return results;
}

type EbayListingSummary = Pick<ListingTrafficRecord, "itemId" | "title" | "imageUrl" | "impressions" | "views">;

/**
 * Aggregate impressions/views for yesterday plus two derived lists — reuses the same
 * per-listing traffic fetch (and its cache) as the eBay Traffic Report → Listings tab,
 * instead of a second, separate eBay Analytics API call just for the daily totals.
 */
async function loadEbayTraffic() {
  try {
    const { report, stale } = await fetchListingTrafficReport("yesterday");
    const impressions = report.listings.reduce((s, l) => s + l.impressions, 0);
    const views = report.listings.reduce((s, l) => s + l.views, 0);

    const pick = (l: ListingTrafficRecord): EbayListingSummary => ({
      itemId: l.itemId, title: l.title, imageUrl: l.imageUrl, impressions: l.impressions, views: l.views,
    });

    // eBay already returns records sorted by impressions desc, so this is just a slice.
    const topImpressions = report.listings.slice(0, 10).map(pick);
    // Views need their own sort — impression-desc order doesn't imply view-desc order.
    const visited = [...report.listings].filter((l) => l.views > 0).sort((a, b) => b.views - a.views).map(pick);

    return { impressions, views, stale, error: null as string | null, topImpressions, visited };
  } catch (e: unknown) {
    return {
      impressions: 0, views: 0, stale: false,
      error: e instanceof Error ? e.message : "Falha ao carregar tráfego do eBay",
      topImpressions: [] as EbayListingSummary[], visited: [] as EbayListingSummary[],
    };
  }
}

/**
 * Yesterday's ad-campaign spend/ROAS/clicks, reusing the same report (and cache) the
 * eBay Campaigns page requests with period=yesterday — instead of a second, separate
 * report-task/poll/download round trip just for the daily totals. Only RUNNING/PAUSED
 * campaigns are kept (ENDED/CANCELED ones report zero for any recent window anyway),
 * sorted by spend so the card highlights where the money actually went.
 */
async function loadEbayCampaigns() {
  try {
    const { report, stale } = await fetchCampaignReport("yesterday");
    const active = report.campaigns.filter((c) => c.status === "RUNNING" || c.status === "PAUSED");
    const campaigns = [...active].sort((a, b) => b.spend - a.spend).slice(0, 8);

    return {
      totals: report.totals,
      activeCount: active.filter((c) => c.status === "RUNNING").length,
      pausedCount: active.filter((c) => c.status === "PAUSED").length,
      campaigns,
      stale,
      error: null as string | null,
    };
  } catch (e: unknown) {
    return {
      totals: { impressions: 0, clicks: 0, ctr: 0, spend: 0, sales: 0, revenue: 0, roas: 0 },
      activeCount: 0,
      pausedCount: 0,
      campaigns: [] as CampaignMetrics[],
      stale: false,
      error: e instanceof Error ? e.message : "Falha ao carregar campanhas do eBay",
    };
  }
}

export type DailyReportData = {
  reportDate: string;
  sales: Awaited<ReturnType<typeof loadSales>>;
  traffic: Awaited<ReturnType<typeof loadTraffic>>;
  catalog: CatalogEntry[];
  ebayTraffic: Awaited<ReturnType<typeof loadEbayTraffic>>;
  ebayCampaigns: Awaited<ReturnType<typeof loadEbayCampaigns>>;
};

const fmtUSD = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

/** Deterministic, free fallback — always available, no external API calls beyond what
 *  was already fetched for the report itself. */
function buildRuleBasedInsights(data: DailyReportData): string[] {
  const insights: string[] = [];

  if (data.sales.vsPreviousDayRevenuePct !== null) {
    const pct = data.sales.vsPreviousDayRevenuePct;
    insights.push(
      pct >= 0
        ? `Vendas ${pct.toFixed(0)}% acima do dia anterior.`
        : `Vendas ${Math.abs(pct).toFixed(0)}% abaixo do dia anterior.`
    );
  }

  if (data.sales.byChannel.length > 0) {
    const top = data.sales.byChannel[0];
    insights.push(`Canal com mais vendas: ${top.canal} (${fmtUSD(top.revenue)}, ${top.orders} pedido(s)).`);
  }

  const catalogOk = data.catalog.filter((c) => !c.error);
  if (catalogOk.length >= 2) {
    const sorted = [...catalogOk].sort((a, b) => b.count - a.count);
    const [most, least] = [sorted[0], sorted[sorted.length - 1]];
    if (most.channel !== least.channel && most.count > least.count) {
      insights.push(`${least.channel} tem ${most.count - least.count} produto(s) ativo(s) a menos que ${most.channel} (${least.count} vs ${most.count}).`);
    }
  }

  if (data.traffic.topPages.length > 0) {
    insights.push(`Página mais visitada ontem: ${data.traffic.topPages[0].path} (${data.traffic.topPages[0].views} visualizações).`);
  }

  if (!data.ebayTraffic.error && data.ebayTraffic.impressions > 0) {
    insights.push(`eBay: ${data.ebayTraffic.impressions} impressões e ${data.ebayTraffic.views} visualizações de anúncio ontem.`);
  }
  if (data.ebayTraffic.topImpressions.length > 0) {
    const top = data.ebayTraffic.topImpressions[0];
    insights.push(`Anúncio do eBay com mais impressões ontem: ${top.title ?? top.itemId} (${top.impressions} impressões).`);
  }

  if (!data.ebayCampaigns.error && data.ebayCampaigns.totals.spend > 0) {
    insights.push(
      `eBay Ads: ${fmtUSD(data.ebayCampaigns.totals.spend)} gastos ontem em ${data.ebayCampaigns.activeCount} campanha(s) ativa(s), ROAS de ${data.ebayCampaigns.totals.roas.toFixed(2)}x.`
    );
  }

  if (insights.length === 0) insights.push("Sem dados suficientes ontem para gerar observações.");
  return insights;
}

const InsightsSchema = z.object({ insights: z.array(z.string()).min(1).max(5) });

const AI_SYSTEM_PROMPT = `Você analisa o resumo diário de um pequeno marketplace de cosméticos (vende no site próprio, eBay, Amazon e TikTok Shop) e escreve de 3 a 5 observações curtas e úteis em português do Brasil, para o dono do negócio ler em segundos no celular.

Regras:
- Cada observação é 1 frase, direta, sem enrolação.
- Use SOMENTE os números fornecidos — nunca invente dado que não está nos dados recebidos.
- Priorize: comparações entre canais (eBay vs Amazon vs TikTok vs site), variação de vendas/acessos vs o dia anterior, produtos/páginas em destaque, desempenho das campanhas de anúncio do eBay (gasto e ROAS), e qualquer coisa que pareça um problema (ex: catálogo muito menor num canal, queda de acesso, ROAS baixo).
- Se algum dado vier com erro (ex: "eBay indisponível"), pode mencionar rapidamente mas não é o foco.
- Não repita o mesmo número em duas observações diferentes.`;

async function buildAiInsights(data: DailyReportData): Promise<string[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.parse({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: AI_SYSTEM_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(data) }],
      output_config: { format: zodOutputFormat(InsightsSchema) },
    });
    return response.parsed_output?.insights ?? null;
  } catch {
    return null;
  }
}

export async function generateDailyReport(): Promise<{ data: DailyReportData; insights: string[]; insightsSource: "ai" | "rules" }> {
  const reportDate = yesterdayBRT();

  const [sales, traffic, catalog, ebayTraffic, ebayCampaigns] = await Promise.all([
    loadSales(reportDate),
    loadTraffic(),
    loadCatalog(),
    loadEbayTraffic(),
    loadEbayCampaigns(),
  ]);

  const data: DailyReportData = { reportDate, sales, traffic, catalog, ebayTraffic, ebayCampaigns };

  const aiInsights = await buildAiInsights(data);
  const insights = aiInsights ?? buildRuleBasedInsights(data);
  const insightsSource: "ai" | "rules" = aiInsights ? "ai" : "rules";

  return { data, insights, insightsSource };
}

export async function saveDailyReport(result: Awaited<ReturnType<typeof generateDailyReport>>) {
  const supabase = getSupabase();
  await supabase.from("daily_reports").upsert(
    {
      report_date: result.data.reportDate,
      data: result.data,
      insights: result.insights,
      insights_source: result.insightsSource,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "report_date" }
  );
}
