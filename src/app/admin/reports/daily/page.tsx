"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Newspaper, RefreshCw, TrendingUp, TrendingDown, Sparkles, ListChecks, DollarSign, Globe, Store, AlertCircle, Eye, Megaphone, Target } from "lucide-react";
import { authedFetch } from "@/lib/admin-fetch";

type SalesByChannel = { canal: string; revenue: number; orders: number };
type CatalogEntry = { channel: string; count: number; error: string | null };
type EbayListingSummary = { itemId: string; title: string | null; imageUrl: string | null; impressions: number; views: number };
type EbayCampaignSummary = {
  campaignId: string; name: string; status: string;
  impressions: number; clicks: number; ctr: number;
  spend: number; sales: number; revenue: number; roas: number; costPerSale: number;
};

type DailyReportData = {
  reportDate: string;
  sales: { revenue: number; orders: number; byChannel: SalesByChannel[]; vsPreviousDayRevenuePct: number | null; cancelledOrders: number; cancelledRevenue: number };
  traffic: { sessions: number; activeUsers: number; topPages: { path: string; views: number }[]; error: string | null };
  catalog: CatalogEntry[];
  ebayTraffic: {
    impressions: number; views: number; stale: boolean; error: string | null;
    topImpressions: EbayListingSummary[]; visited: EbayListingSummary[];
  };
  ebayCampaigns: {
    totals: { impressions: number; clicks: number; ctr: number; spend: number; sales: number; revenue: number; roas: number };
    activeCount: number; pausedCount: number;
    campaigns: EbayCampaignSummary[];
    stale: boolean; error: string | null;
  };
};

type Report = { report_date: string; data: DailyReportData; insights: string[]; insights_source: "ai" | "rules"; generated_at: string };

const fmtUSD = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

function fmtDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function EbayListingRow({ listing, metric }: { listing: EbayListingSummary; metric: "views" | "impressions" }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      {listing.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={listing.imageUrl} alt="" className="w-9 h-9 object-cover rounded border shrink-0" />
      )}
      <span className="flex-1 truncate">{listing.title ?? listing.itemId}</span>
      <span className="font-medium shrink-0">
        {metric === "views" ? listing.views : listing.impressions} {metric === "views" ? "visualizações" : "impressões"}
      </span>
    </div>
  );
}

export default function DailyReportPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  const load = useCallback((date?: string) => {
    const url = date ? `/api/reports/daily?date=${date}` : "/api/reports/daily";
    authedFetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setReport(d.report);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Falha ao carregar relatório"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    load(params.get("date") || undefined);
  }, [load]);

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    try {
      const res = await authedFetch("/api/reports/daily", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      load(data.reportDate);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar relatório");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Newspaper className="h-7 w-7" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Resumo Diário</h1>
            <p className="text-muted-foreground text-sm">Vendas, acessos e catálogo consolidados — gerado toda manhã às 08:00.</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleGenerate} disabled={generating}>
          {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Gerar agora
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando...</span>
        </div>
      ) : !report ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum relatório gerado ainda. Clique em &quot;Gerar agora&quot; para criar o primeiro.
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground capitalize">Referente a {fmtDate(report.report_date)}</p>

          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4.5 w-4.5" />
                Observações
                <Badge variant="secondary" className="text-[10px]">{report.insights_source === "ai" ? "IA" : "regras"}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {report.insights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <ListChecks className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Vendas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{fmtUSD(report.data.sales.revenue)}</span>
                  {report.data.sales.vsPreviousDayRevenuePct !== null && (
                    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${report.data.sales.vsPreviousDayRevenuePct >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {report.data.sales.vsPreviousDayRevenuePct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {Math.abs(report.data.sales.vsPreviousDayRevenuePct).toFixed(0)}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {report.data.sales.orders} pedido(s)
                  {report.data.sales.cancelledOrders > 0 && (
                    <span className="text-destructive">{" "}({report.data.sales.cancelledOrders} cancelado(s), {fmtUSD(report.data.sales.cancelledRevenue)})</span>
                  )}
                </p>
                <div className="space-y-1.5">
                  {report.data.sales.byChannel.map((c) => (
                    <div key={c.canal} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{c.canal}</span>
                      <span className="font-medium">{fmtUSD(c.revenue)} · {c.orders}</span>
                    </div>
                  ))}
                  {report.data.sales.byChannel.length === 0 && <p className="text-xs text-muted-foreground">Sem vendas nesse dia.</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Acessos do Site</CardTitle>
              </CardHeader>
              <CardContent>
                {report.data.traffic.error ? (
                  <p className="text-xs text-muted-foreground">{report.data.traffic.error}</p>
                ) : (
                  <>
                    <div className="flex gap-4">
                      <div>
                        <p className="text-2xl font-bold">{report.data.traffic.sessions}</p>
                        <p className="text-xs text-muted-foreground">sessões</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{report.data.traffic.activeUsers}</p>
                        <p className="text-xs text-muted-foreground">visitantes</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 mt-3">
                      {report.data.traffic.topPages.map((p) => (
                        <div key={p.path} className="flex justify-between text-sm gap-2">
                          <span className="truncate text-muted-foreground">{p.path}</span>
                          <span className="font-medium shrink-0">{p.views}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Store className="h-4 w-4" /> Catálogo por Canal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {report.data.catalog.map((c) => (
                  <div key={c.channel}>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{c.channel}</span>
                      {c.error ? (
                        <span className="text-xs text-amber-600">indisponível</span>
                      ) : (
                        <span className="font-medium">{c.count} produto(s)</span>
                      )}
                    </div>
                    {c.error && <p className="text-[11px] text-muted-foreground mt-0.5">{c.error}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">eBay — Tráfego</CardTitle>
              {report.data.ebayTraffic.stale && (
                <CardDescription className="text-xs">Dados em cache (última atualização disponível) — a conexão pode precisar ser reconectada.</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {report.data.ebayTraffic.error ? (
                <p className="text-xs text-muted-foreground">{report.data.ebayTraffic.error}</p>
              ) : (
                <>
                  <div className="flex gap-6 mb-4">
                    <div>
                      <p className="text-2xl font-bold">{report.data.ebayTraffic.impressions}</p>
                      <p className="text-xs text-muted-foreground">impressões</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{report.data.ebayTraffic.views}</p>
                      <p className="text-xs text-muted-foreground">visualizações</p>
                    </div>
                  </div>

                  <Tabs defaultValue="visited">
                    <TabsList>
                      <TabsTrigger value="visited"><Eye className="h-3.5 w-3.5 mr-1.5" />Visitados Ontem</TabsTrigger>
                      <TabsTrigger value="impressions"><Megaphone className="h-3.5 w-3.5 mr-1.5" />Top Impressões</TabsTrigger>
                    </TabsList>
                    <TabsContent value="visited">
                      {(report.data.ebayTraffic.visited ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">Nenhum anúncio visitado ontem.</p>
                      ) : (
                        <div className="space-y-2">
                          {report.data.ebayTraffic.visited.map((l) => (
                            <EbayListingRow key={l.itemId} listing={l} metric="views" />
                          ))}
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="impressions">
                      {(report.data.ebayTraffic.topImpressions ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">Sem impressões registradas ontem.</p>
                      ) : (
                        <div className="space-y-2">
                          {report.data.ebayTraffic.topImpressions.map((l) => (
                            <EbayListingRow key={l.itemId} listing={l} metric="impressions" />
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" /> eBay — Campanhas</CardTitle>
              {report.data.ebayCampaigns.stale && (
                <CardDescription className="text-xs">Dados em cache (última atualização disponível) — a conexão pode precisar ser reconectada.</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {report.data.ebayCampaigns.error ? (
                <p className="text-xs text-muted-foreground">{report.data.ebayCampaigns.error}</p>
              ) : report.data.ebayCampaigns.campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nenhuma campanha ativa ontem.</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-6 mb-4">
                    <div>
                      <p className="text-2xl font-bold">{fmtUSD(report.data.ebayCampaigns.totals.spend)}</p>
                      <p className="text-xs text-muted-foreground">gasto</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{report.data.ebayCampaigns.totals.roas.toFixed(2)}x</p>
                      <p className="text-xs text-muted-foreground">ROAS</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{report.data.ebayCampaigns.totals.clicks}</p>
                      <p className="text-xs text-muted-foreground">cliques</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{report.data.ebayCampaigns.activeCount}</p>
                      <p className="text-xs text-muted-foreground">
                        campanha(s) rodando{report.data.ebayCampaigns.pausedCount > 0 ? ` · ${report.data.ebayCampaigns.pausedCount} pausada(s)` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {report.data.ebayCampaigns.campaigns.map((c) => (
                      <div key={c.campaignId} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate flex-1">{c.name}</span>
                        <span className="text-muted-foreground shrink-0">{c.clicks} cliques</span>
                        <span className="font-medium shrink-0 w-20 text-right">{fmtUSD(c.spend)}</span>
                        <span className="font-medium shrink-0 w-16 text-right">{c.roas.toFixed(2)}x</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">Gerado em {new Date(report.generated_at).toLocaleString("pt-BR")}</p>
        </>
      )}
    </div>
  );
}
