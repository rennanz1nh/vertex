"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, Cell, XAxis, YAxis, ResponsiveContainer } from "recharts";
import {
  AlertCircle, Loader2, Eye, MousePointerClick, TrendingUp, ShoppingCart, Link2, Award, Headset,
  ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
import { REPORT_PERIODS_90D, type ReportPeriod } from "@/lib/report-periods";
import { EbayRateLimitsButton } from "@/components/ebay/EbayRateLimitsButton";
import { EbayAutomationTabs } from "@/components/ebay/EbayAutomationTabs";
import { StaleDataBanner } from "@/components/ebay/StaleDataBanner";
import { EbayReconnectBanner } from "@/components/ebay/EbayReconnectBanner";
import { DateAxisTick, getMonthOpacity, spansMultipleYears } from "@/components/charts/daily-bar-chart-utils";
import { authedFetch } from "@/lib/admin-fetch";

type TrafficReport = {
  period: ReportPeriod;
  range: { start: string; end: string };
  impressions: number;
  views: number;
  transactions: number;
  clickThroughRate: number;
  salesConversionRate: number;
  daily: { date: string; impressions: number; views: number }[];
};

type ListingRow = {
  itemId: string;
  title: string | null;
  imageUrl: string | null;
  impressions: number;
  views: number;
  salesConversionRate: number;
  soldInPeriod: number;
  totalQuantitySold: number | null;
};

type ListingSortKey = "impressions" | "views" | "salesConversionRate" | "soldInPeriod" | "totalQuantitySold";
type SortDir = "asc" | "desc";

type StandardsMetric = { key: string; name: string; level: string; displayValue: string };
type StandardsProfile = { standardsLevel: string; program: string; evaluationMonth: string | null; metrics: StandardsMetric[] };

type ServiceMetricBreakdown = { dimension: string; rate: number | null; count: number | null; transactionCount: number | null };
type ServiceMetric = { type: string; evaluationDate: string | null; breakdown: ServiceMetricBreakdown[] };

const chartConfig = {
  impressions: { label: "Impressões", color: "hsl(var(--primary))" },
  views: { label: "Visualizações", color: "hsl(var(--muted-foreground))" },
};

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

const STANDARDS_LEVEL_LABEL: Record<string, string> = {
  TOP_RATED: "Top Rated",
  ABOVE_STANDARD: "Acima do Padrão",
  BELOW_STANDARD: "Abaixo do Padrão",
};

const STANDARDS_LEVEL_CLASS: Record<string, string> = {
  TOP_RATED: "bg-green-100 text-green-700 border-green-300",
  ABOVE_STANDARD: "bg-blue-100 text-blue-700 border-blue-300",
  BELOW_STANDARD: "bg-red-100 text-red-700 border-red-300",
};

function StandardsBadge({ level }: { level: string }) {
  return (
    <Badge variant="outline" className={STANDARDS_LEVEL_CLASS[level] ?? ""}>
      {STANDARDS_LEVEL_LABEL[level] ?? level}
    </Badge>
  );
}

// One-line explanations for eBay's own metric names (returned as-is by their API) —
// keyed case-insensitively since eBay's casing has been observed to vary by program.
const STANDARDS_METRIC_DESCRIPTIONS: Record<string, string> = {
  "minimum days on site": "Dias mínimos que a conta precisa estar ativa no eBay para entrar na avaliação",
  "transactions": "Total de transações consideradas no ciclo de avaliação atual",
  "sales amount": "Valor total vendido no ciclo de avaliação atual",
  "transaction defect rate": "% de transações com problema — cancelamento pelo vendedor, caso de INAD/INR não resolvido ou avaliação negativa",
  "cases closed without seller resolution": "% de casos (INAD/INR) que o eBay ou PayPal encerrou sem o vendedor resolver diretamente com o comprador",
  "late shipment rate": "% de envios despachados após o prazo prometido ao comprador",
  "tracking uploaded on time and validated": "% de envios com código de rastreio válido enviado dentro do prazo de despacho",
};

function standardsMetricDescription(name: string): string | null {
  return STANDARDS_METRIC_DESCRIPTIONS[name.trim().toLowerCase()] ?? null;
}

const CUSTOMER_SERVICE_DESCRIPTIONS: Record<string, string> = {
  "Item Não Conforme (INAD)": "Casos abertos pelo comprador alegando que o item recebido não corresponde ao anunciado",
  "Item Não Recebido (INR)": "Casos abertos pelo comprador alegando que o pedido não chegou dentro do prazo",
};

function SortableListingHead({
  label, sortKey, activeKey, dir, onSort,
}: {
  label: string;
  sortKey: ListingSortKey;
  activeKey: ListingSortKey;
  dir: SortDir;
  onSort: (key: ListingSortKey) => void;
}) {
  const isActive = sortKey === activeKey;
  const Icon = isActive ? (dir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <TableHead className="text-right">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${isActive ? "text-foreground font-semibold" : ""}`}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </TableHead>
  );
}

export default function EbayTrafficReport() {
  const [period, setPeriod] = useState<ReportPeriod>("today");
  const [report, setReport] = useState<TrafficReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stale, setStale] = useState<string | null>(null);

  const [listings, setListings] = useState<ListingRow[] | null>(null);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState("");
  const [listingsStale, setListingsStale] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<ListingSortKey>("impressions");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [standards, setStandards] = useState<StandardsProfile[] | null>(null);
  const [standardsLoading, setStandardsLoading] = useState(true);
  const [standardsError, setStandardsError] = useState("");
  const [standardsStale, setStandardsStale] = useState<string | null>(null);

  const [service, setService] = useState<{ inad: ServiceMetric; inr: ServiceMetric } | null>(null);
  const [serviceLoading, setServiceLoading] = useState(true);
  const [serviceError, setServiceError] = useState("");
  const [serviceStale, setServiceStale] = useState<string | null>(null);

  const fetchReport = useCallback(async (p: ReportPeriod) => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch(`/api/ebay/reports/traffic?period=${p}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao carregar relatório de tráfego");
        return;
      }
      setReport(data);
      setStale(data.stale ? data.fetchedAt : null);
    } catch {
      setError("Falha na conexão ao carregar relatório");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchListings = useCallback(async (p: ReportPeriod) => {
    setListingsLoading(true);
    setListingsError("");
    try {
      const res = await authedFetch(`/api/ebay/reports/listings?period=${p}`);
      const data = await res.json();
      if (!res.ok) {
        setListingsError(data.error || "Erro ao carregar top anúncios");
        return;
      }
      setListings(data.listings);
      setListingsStale(data.stale ? data.fetchedAt : null);
    } catch {
      setListingsError("Falha na conexão ao carregar top anúncios");
    } finally {
      setListingsLoading(false);
    }
  }, []);

  useEffect(() => { fetchReport(period); }, [period, fetchReport]);
  useEffect(() => { fetchListings(period); }, [period, fetchListings]);

  // Seller standards and customer-service metrics follow eBay's own evaluation cycle
  // (not our Hoje/Ontem/7d/30d filter), so these load once and don't depend on `period`.
  useEffect(() => {
    authedFetch("/api/ebay/reports/seller-standards")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setStandardsError(d.error); return; }
        setStandards(d.profiles);
        setStandardsStale(d.stale ? d.fetchedAt : null);
      })
      .catch(() => setStandardsError("Falha na conexão ao carregar nível de vendedor"))
      .finally(() => setStandardsLoading(false));

    authedFetch("/api/ebay/reports/customer-service")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setServiceError(d.error); return; }
        setService(d);
        setServiceStale(d.stale ? d.fetchedAt : null);
      })
      .catch(() => setServiceError("Falha na conexão ao carregar métricas de atendimento"))
      .finally(() => setServiceLoading(false));
  }, []);

  function handleSort(key: ListingSortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sortedListings = useMemo(() => {
    if (!listings) return listings;
    const rows = [...listings];
    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // Listings that never sold (totalQuantitySold = null) always sink to the bottom,
      // regardless of sort direction — "no data" isn't meaningfully highest or lowest.
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return rows;
  }, [listings, sortKey, sortDir]);

  const chartDates = useMemo(() => (report?.daily ?? []).map((d) => d.date), [report]);
  const monthOpacity = useMemo(() => getMonthOpacity(chartDates), [chartDates]);
  const chartShowYear = useMemo(() => spansMultipleYears(chartDates), [chartDates]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/EBay_logo.svg.png" alt="eBay" className="h-10 w-auto" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Relatório de Tráfego</h1>
            <p className="text-muted-foreground text-sm">Impressões, visualizações e conversão dos seus anúncios — dados do Seller Hub</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap ml-auto">
          <div className="flex gap-1.5">
            {REPORT_PERIODS_90D.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className={`h-9 px-3 rounded-md text-sm font-medium border transition-colors ${
                  period === p.value
                    ? "bg-black text-white border-black"
                    : "bg-background text-muted-foreground border-input hover:bg-muted"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <EbayRateLimitsButton />
        </div>
      </div>

      <EbayAutomationTabs />

      <EbayReconnectBanner />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            {error.toLowerCase().includes("token") || error.toLowerCase().includes("scope") || error.toLowerCase().includes("invalid_grant") ? (
              <> — clique em <strong>Sincronizar</strong> no topo da página para renovar as permissões.</>
            ) : null}
          </AlertDescription>
        </Alert>
      )}

      {stale && <StaleDataBanner fetchedAt={stale} />}

      {loading ? (
        <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando relatório...</span>
        </div>
      ) : report ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Impressões</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{report.impressions.toLocaleString("pt-BR")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Visualizações</CardTitle>
                <MousePointerClick className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{report.views.toLocaleString("pt-BR")}</p>
                <p className="text-xs text-muted-foreground">CTR médio: {pct(report.clickThroughRate)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Vendas Atribuídas</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{report.transactions.toLocaleString("pt-BR")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Conversão</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{pct(report.salesConversionRate)}</p>
              </CardContent>
            </Card>
          </div>

          {report.daily.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Impressões e Visualizações por Dia</CardTitle>
                <CardDescription>
                  {report.range.start} a {report.range.end} — dias sem tráfego não aparecem no gráfico;
                  meses mais recentes em tom mais forte, meses mais antigos mais claros
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.daily}>
                      <XAxis dataKey="date" height={40} tick={(props) => <DateAxisTick {...props} showYear={chartShowYear} />} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="impressions" radius={[4, 4, 0, 0]}>
                        {report.daily.map((d) => (
                          <Cell key={d.date} fill="var(--color-impressions)" fillOpacity={monthOpacity(d.date)} />
                        ))}
                      </Bar>
                      <Bar dataKey="views" radius={[4, 4, 0, 0]}>
                        {report.daily.map((d) => (
                          <Cell key={d.date} fill="var(--color-views)" fillOpacity={monthOpacity(d.date)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Top Anúncios</CardTitle>
          <CardDescription>Anúncios com mais impressões no período selecionado acima</CardDescription>
        </CardHeader>
        <CardContent>
          {listingsStale && <StaleDataBanner fetchedAt={listingsStale} />}
          {listingsError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{listingsError}</AlertDescription>
            </Alert>
          ) : listingsLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Carregando...</span>
            </div>
          ) : sortedListings && sortedListings.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Anúncio</TableHead>
                    <SortableListingHead label="Impressões" sortKey="impressions" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortableListingHead label="Visualizações" sortKey="views" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortableListingHead label="Conversão" sortKey="salesConversionRate" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortableListingHead label="Vendido no Período" sortKey="soldInPeriod" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortableListingHead label="Total de Vendas Histórico" sortKey="totalQuantitySold" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedListings.map((l) => (
                    <TableRow key={l.itemId}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          {l.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={l.imageUrl} alt="" className="h-10 w-10 rounded object-cover shrink-0 bg-muted" />
                          ) : (
                            <div className="h-10 w-10 rounded shrink-0 bg-muted" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate max-w-[280px]">{l.title ?? l.itemId}</p>
                            <p className="text-xs text-muted-foreground">ID: {l.itemId}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{l.impressions.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">{l.views.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">{pct(l.salesConversionRate)}</TableCell>
                      <TableCell className="text-right">{l.soldInPeriod.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">{l.totalQuantitySold !== null ? l.totalQuantitySold.toLocaleString("pt-BR") : "-"}</TableCell>
                      <TableCell>
                        <a
                          href={`https://www.ebay.com/itm/${l.itemId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir listing no eBay"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Link2 className="h-4 w-4" />
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhum tráfego registrado no período</p>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            &quot;Vendido no Período&quot; é o nº de vendas registradas pelo eBay no período selecionado acima. &quot;Total de Vendas Histórico&quot; é o total de unidades vendidas desde a criação do anúncio (não muda com o filtro de período).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Nível de Vendedor
          </CardTitle>
          <CardDescription>Avaliação do ciclo atual do eBay — não muda com o filtro de período acima</CardDescription>
        </CardHeader>
        <CardContent>
          {standardsStale && <StaleDataBanner fetchedAt={standardsStale} />}
          {standardsError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{standardsError}</AlertDescription>
            </Alert>
          ) : standardsLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Carregando...</span>
            </div>
          ) : standards && standards.length > 0 ? (
            <div className="space-y-5">
              {standards.map((p) => (
                <div key={p.program} className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StandardsBadge level={p.standardsLevel} />
                    <span className="text-xs text-muted-foreground">{p.program} · ciclo {p.evaluationMonth}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {p.metrics.map((m) => (
                      <div key={m.key} className="p-3 border rounded-lg">
                        <p className="text-xs text-muted-foreground">{m.name}</p>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p className="text-lg font-semibold">{m.displayValue}</p>
                          <Badge variant="outline" className={`${STANDARDS_LEVEL_CLASS[m.level] ?? ""} text-[10px]`}>
                            {STANDARDS_LEVEL_LABEL[m.level] ?? m.level}
                          </Badge>
                        </div>
                        {standardsMetricDescription(m.name) && (
                          <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{standardsMetricDescription(m.name)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">Sem avaliação de nível de vendedor disponível ainda</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headset className="h-5 w-5" />
            Métricas de Atendimento ao Cliente
          </CardTitle>
          <CardDescription>Taxa de &quot;Item Não Conforme&quot; e &quot;Item Não Recebido&quot; — ciclo atual do eBay</CardDescription>
        </CardHeader>
        <CardContent>
          {serviceStale && <StaleDataBanner fetchedAt={serviceStale} />}
          {serviceError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{serviceError}</AlertDescription>
            </Alert>
          ) : serviceLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Carregando...</span>
            </div>
          ) : service ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[{ label: "Item Não Conforme (INAD)", data: service.inad }, { label: "Item Não Recebido (INR)", data: service.inr }].map(({ label, data }) => {
                const totalCount = data.breakdown.reduce((s, b) => s + (b.count ?? 0), 0);
                const txnCount = data.breakdown[0]?.transactionCount ?? 0;
                return (
                  <div key={label} className="p-3 border rounded-lg space-y-2">
                    <div>
                      <p className="text-sm font-semibold">{label}</p>
                      {CUSTOMER_SERVICE_DESCRIPTIONS[label] && (
                        <p className="text-xs text-muted-foreground leading-snug">{CUSTOMER_SERVICE_DESCRIPTIONS[label]}</p>
                      )}
                    </div>
                    <p className="text-2xl font-bold">{totalCount} caso(s)</p>
                    <p className="text-xs text-muted-foreground">de {txnCount} transações no ciclo</p>
                    {data.breakdown.length > 0 && (
                      <div className="pt-2 border-t space-y-1">
                        {data.breakdown.map((b, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{b.dimension}</span>
                            <span className="font-medium">{b.rate !== null ? `${b.rate}%` : "-"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
