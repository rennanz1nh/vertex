"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  AlertCircle, Loader2, Eye, MousePointerClick, DollarSign, ShoppingCart, Target,
  ArrowUp, ArrowDown, ArrowUpDown, Plus,
} from "lucide-react";
import { REPORT_PERIODS, type ReportPeriod } from "@/lib/report-periods";
import { EbayRateLimitsButton } from "@/components/ebay/EbayRateLimitsButton";
import { EbayAutomationTabs } from "@/components/ebay/EbayAutomationTabs";
import { StaleDataBanner } from "@/components/ebay/StaleDataBanner";
import { CampaignDetailDialog } from "@/components/ebay/CampaignDetailDialog";
import { CreateCampaignDialog } from "@/components/ebay/CreateCampaignDialog";
import { authedFetch } from "@/lib/admin-fetch";

type Campaign = {
  campaignId: string;
  name: string;
  status: string;
  fundingModel: string | null;
  dailyBudget: number | null;
  currency: string | null;
  startDate: string | null;
  endDate: string | null;
};

type CampaignMetrics = {
  campaignId: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  sales: number;
  revenue: number;
  roas: number;
  costPerSale: number;
};

type CampaignReport = {
  period: ReportPeriod;
  range: { start: string; end: string };
  totals: { impressions: number; clicks: number; ctr: number; spend: number; sales: number; revenue: number; roas: number };
  campaigns: CampaignMetrics[];
  metricsWarnings?: { fundingModel: string; error: string }[];
};

const FUNDING_MODEL_LABEL: Record<string, string> = {
  COST_PER_SALE: "Custo por Venda",
  COST_PER_CLICK: "Custo por Clique",
};

type Row = Campaign & Omit<CampaignMetrics, "campaignId">;

type SortKey = "impressions" | "clicks" | "spend" | "sales" | "roas";
type SortDir = "asc" | "desc";

const STATUS_LABEL: Record<string, string> = {
  RUNNING: "Rodando",
  ENDED: "Encerrada",
  PAUSED: "Pausada",
  SCHEDULED: "Agendada",
  DRAFT: "Rascunho",
  CANCELED: "Cancelada",
};

const STATUS_CLASS: Record<string, string> = {
  RUNNING: "bg-green-100 text-green-700 border-green-300",
  ENDED: "bg-gray-100 text-gray-600 border-gray-300",
  PAUSED: "bg-yellow-100 text-yellow-700 border-yellow-300",
  SCHEDULED: "bg-blue-100 text-blue-700 border-blue-300",
};

function money(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function SortableHead({
  label, sortKey, activeKey, dir, onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
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

export default function EbayCampaignsPage() {
  const [period, setPeriod] = useState<ReportPeriod>("today");

  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignsError, setCampaignsError] = useState("");
  const [campaignsStale, setCampaignsStale] = useState<string | null>(null);

  const [report, setReport] = useState<CampaignReport | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState("");
  const [reportStale, setReportStale] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    setCampaignsError("");
    try {
      const res = await authedFetch("/api/ebay/campaigns");
      const data = await res.json();
      if (!res.ok) {
        setCampaignsError(data.error || "Erro ao carregar campanhas");
        return;
      }
      setCampaigns(data.campaigns);
      setCampaignsStale(data.stale ? data.fetchedAt : null);
    } catch {
      setCampaignsError("Falha na conexão ao carregar campanhas");
    } finally {
      setCampaignsLoading(false);
    }
  }, []);

  const fetchReport = useCallback(async (p: ReportPeriod) => {
    setReportLoading(true);
    setReportError("");
    try {
      const res = await authedFetch(`/api/ebay/campaigns/report?period=${p}`);
      const data = await res.json();
      if (!res.ok) {
        setReportError(data.error || "Erro ao carregar métricas das campanhas");
        return;
      }
      setReport(data);
      setReportStale(data.stale ? data.fetchedAt : null);
    } catch {
      setReportError("Falha na conexão ao carregar métricas das campanhas");
    } finally {
      setReportLoading(false);
    }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);
  useEffect(() => { fetchReport(period); }, [period, fetchReport]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const rows = useMemo<Row[] | null>(() => {
    if (!campaigns) return null;
    const metricsById = new Map(report?.campaigns.map((m) => [m.campaignId, m]) ?? []);
    return campaigns.map((c) => {
      const m = metricsById.get(c.campaignId);
      return {
        ...c,
        impressions: m?.impressions ?? 0,
        clicks: m?.clicks ?? 0,
        ctr: m?.ctr ?? 0,
        spend: m?.spend ?? 0,
        sales: m?.sales ?? 0,
        revenue: m?.revenue ?? 0,
        roas: m?.roas ?? 0,
        costPerSale: m?.costPerSale ?? 0,
      };
    });
  }, [campaigns, report]);

  const sortedRows = useMemo(() => {
    if (!rows) return rows;
    const copy = [...rows];
    copy.sort((a, b) => (sortDir === "desc" ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]));
    return copy;
  }, [rows, sortKey, sortDir]);

  const metricsAvailable = !!report && !reportError;

  const selectedMetrics = useMemo(() => {
    if (!metricsAvailable || !selectedCampaignId || !sortedRows) return null;
    const r = sortedRows.find((row) => row.campaignId === selectedCampaignId);
    if (!r) return null;
    return {
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: r.ctr,
      spend: r.spend,
      sales: r.sales,
      revenue: r.revenue,
      roas: r.roas,
      costPerSale: r.costPerSale,
    };
  }, [metricsAvailable, selectedCampaignId, sortedRows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/EBay_logo.svg.png" alt="eBay" className="h-10 w-auto" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">eBay Campaigns</h1>
            <p className="text-muted-foreground text-sm">Anúncios Promovidos — impressões, gasto e retorno por campanha</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap ml-auto">
          <div className="flex gap-1.5">
            {REPORT_PERIODS.map((p) => (
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
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5" type="button">
            <Plus className="h-4 w-4" /> Nova Campanha
          </Button>
        </div>
      </div>

      <EbayAutomationTabs />

      {reportError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Métricas de performance indisponíveis no momento: {reportError}
            {reportError.toLowerCase().includes("token") || reportError.toLowerCase().includes("scope") || reportError.toLowerCase().includes("invalid_grant") ? (
              <> — clique em <strong>Sincronizar</strong> no topo da página para renovar as permissões.</>
            ) : (
              <> A lista de campanhas abaixo continua disponível normalmente.</>
            )}
          </AlertDescription>
        </Alert>
      )}

      {metricsAvailable && report!.metricsWarnings && report!.metricsWarnings.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {report!.metricsWarnings.map((w) => (
              <div key={w.fundingModel}>
                Métricas de <strong>{FUNDING_MODEL_LABEL[w.fundingModel] ?? w.fundingModel}</strong> indisponíveis no
                momento (erro do próprio eBay): {w.error}
              </div>
            ))}
            Os números abaixo são reais para os demais tipos de campanha.
          </AlertDescription>
        </Alert>
      )}

      {(reportStale || campaignsStale) && <StaleDataBanner fetchedAt={reportStale ?? campaignsStale} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Impressões</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{reportLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : metricsAvailable ? report!.totals.impressions.toLocaleString("pt-BR") : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cliques</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{reportLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : metricsAvailable ? report!.totals.clicks.toLocaleString("pt-BR") : "—"}</p>
            {metricsAvailable && <p className="text-xs text-muted-foreground">CTR médio: {pct(report!.totals.ctr)}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gasto Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{reportLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : metricsAvailable ? money(report!.totals.spend) : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vendas Geradas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{reportLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : metricsAvailable ? report!.totals.sales.toLocaleString("pt-BR") : "—"}</p>
            {metricsAvailable && <p className="text-xs text-muted-foreground">{money(report!.totals.revenue)} em receita</p>}
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ROAS</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{reportLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : metricsAvailable ? `${report!.totals.roas.toFixed(2)}x` : "—"}</p>
            <p className="text-xs text-muted-foreground">Retorno em vendas pra cada $1 gasto em anúncios</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campanhas</CardTitle>
          <CardDescription>
            {metricsAvailable
              ? "Uma linha por campanha — ordene por qualquer coluna pra achar o que vale (ou não) continuar pagando"
              : "Métricas de performance indisponíveis no momento — mostrando apenas dados de cadastro da campanha"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {campaignsError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{campaignsError}</AlertDescription>
            </Alert>
          ) : campaignsLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Carregando...</span>
            </div>
          ) : sortedRows && sortedRows.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Orçamento Diário</TableHead>
                    <SortableHead label="Impressões" sortKey="impressions" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortableHead label="Cliques" sortKey="clicks" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortableHead label="Gasto" sortKey="spend" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortableHead label="Vendas" sortKey="sales" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortableHead label="ROAS" sortKey="roas" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map((r) => (
                    <TableRow
                      key={r.campaignId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedCampaignId(r.campaignId)}
                    >
                      <TableCell>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate max-w-[280px]">{r.name}</p>
                          <Badge variant="outline" className={`${STATUS_CLASS[r.status] ?? ""} text-[10px] mt-1`}>
                            {STATUS_LABEL[r.status] ?? r.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.dailyBudget !== null ? money(r.dailyBudget) : "—"}
                      </TableCell>
                      <TableCell className="text-right">{metricsAvailable ? r.impressions.toLocaleString("pt-BR") : "—"}</TableCell>
                      <TableCell className="text-right">{metricsAvailable ? r.clicks.toLocaleString("pt-BR") : "—"}</TableCell>
                      <TableCell className="text-right">{metricsAvailable ? money(r.spend) : "—"}</TableCell>
                      <TableCell className="text-right">{metricsAvailable ? r.sales.toLocaleString("pt-BR") : "—"}</TableCell>
                      <TableCell className="text-right font-medium">{metricsAvailable ? `${r.roas.toFixed(2)}x` : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhuma campanha de Anúncios Promovidos encontrada</p>
          )}
        </CardContent>
      </Card>

      <CampaignDetailDialog
        campaignId={selectedCampaignId}
        metrics={selectedMetrics}
        period={period}
        onClose={() => setSelectedCampaignId(null)}
        onChanged={() => { fetchCampaigns(); fetchReport(period); }}
      />
      <CreateCampaignDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { fetchCampaigns(); fetchReport(period); }}
      />
    </div>
  );
}
