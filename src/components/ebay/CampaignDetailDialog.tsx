"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  Loader2,
  Pause,
  Play,
  Save,
  ExternalLink,
  Square,
  Trash2,
  Plus,
  Eye,
  MousePointerClick,
  DollarSign,
  ShoppingCart,
  Target,
} from "lucide-react";
import { EbayListingPicker, type EbayListing } from "@/components/ebay/EbayListingPicker";
import { authedFetch } from "@/lib/admin-fetch";
import { REPORT_PERIODS, type ReportPeriod } from "@/lib/report-periods";

type SelectionRules = {
  categoryIds: string[];
  brands: string[];
  minPrice: string | null;
  maxPrice: string | null;
  listingConditionIds: string[];
};

type CampaignDetail = {
  campaignId: string;
  name: string;
  status: string;
  targetingType: string | null;
  channels: string[];
  startDate: string | null;
  endDate: string | null;
  fundingModel: string | null;
  bidPercentage: string | null;
  biddingStrategy: string | null;
  dailyBudget: number | null;
  currency: string | null;
  selectionRules: SelectionRules | null;
  autoSelectFutureInventory: boolean | null;
};

type CampaignAd = { adId: string; listingId: string; bidPercentage: string | null; adStatus?: string | null };

export type CampaignMetricsView = {
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  sales: number;
  revenue: number;
  roas: number;
  costPerSale: number;
};

const STATUS_LABEL: Record<string, string> = {
  RUNNING: "Rodando",
  ENDED: "Encerrada",
  PAUSED: "Pausada",
  SCHEDULED: "Agendada",
  DRAFT: "Rascunho",
  CANCELED: "Cancelada",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function money(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function unrestrictedRules(rules: SelectionRules | null) {
  if (!rules) return false;
  return (
    rules.categoryIds.length === 0 &&
    rules.brands.length === 0 &&
    !rules.minPrice &&
    !rules.maxPrice &&
    rules.listingConditionIds.length === 0
  );
}

export function CampaignDetailDialog({
  campaignId,
  metrics,
  period,
  onClose,
  onChanged,
}: {
  campaignId: string | null;
  metrics: CampaignMetricsView | null;
  period: ReportPeriod;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [ads, setAds] = useState<CampaignAd[] | null>(null);
  const [adsLoading, setAdsLoading] = useState(false);
  const [adsError, setAdsError] = useState("");
  const [adBidDrafts, setAdBidDrafts] = useState<Record<string, string>>({});
  const [adBusyId, setAdBusyId] = useState<string | null>(null);

  const [togglingStatus, setTogglingStatus] = useState(false);
  const [actionError, setActionError] = useState("");

  const [budgetInput, setBudgetInput] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetSaved, setBudgetSaved] = useState(false);

  const [ending, setEnding] = useState(false);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [showAddListing, setShowAddListing] = useState(false);
  const [addListingBid, setAddListingBid] = useState("5");
  const [addingListing, setAddingListing] = useState(false);

  const [eligibleListings, setEligibleListings] = useState<EbayListing[] | null>(null);
  const [eligibleLoading, setEligibleLoading] = useState(false);

  const fetchDetail = useCallback(async (id: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch(`/api/ebay/campaigns/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao carregar detalhe da campanha");
        return;
      }
      setDetail(data.detail);
      setBudgetInput(data.detail.dailyBudget != null ? String(data.detail.dailyBudget) : "");
    } catch {
      setError("Falha na conexão ao carregar detalhe da campanha");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAds = useCallback(async (id: string) => {
    setAdsLoading(true);
    setAdsError("");
    try {
      const res = await authedFetch(`/api/ebay/campaigns/${id}/ads`);
      const data = await res.json();
      if (!res.ok) {
        setAdsError(data.error || "Erro ao carregar os anúncios da campanha");
        return;
      }
      setAds(data.ads);
      const drafts: Record<string, string> = {};
      for (const ad of data.ads as CampaignAd[]) {
        drafts[ad.listingId] = ad.bidPercentage ?? "";
      }
      setAdBidDrafts(drafts);
    } catch {
      setAdsError("Falha na conexão ao carregar os anúncios");
    } finally {
      setAdsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!campaignId) return;
    setDetail(null);
    setAds(null);
    setAdsError("");
    setActionError("");
    setBudgetSaved(false);
    setConfirmingEnd(false);
    setConfirmingDelete(false);
    setShowAddListing(false);
    setEligibleListings(null);
    fetchDetail(campaignId);
  }, [campaignId, fetchDetail]);

  useEffect(() => {
    if (!campaignId || !detail || detail.fundingModel !== "COST_PER_CLICK") return;
    fetchAds(campaignId);
  }, [campaignId, detail, fetchAds]);

  useEffect(() => {
    if (!detail || detail.fundingModel !== "COST_PER_SALE" || !unrestrictedRules(detail.selectionRules)) return;
    setEligibleLoading(true);
    authedFetch("/api/ebay/listings")
      .then((r) => r.json())
      .then((d) => setEligibleListings(d.listings || []))
      .catch(() => {})
      .finally(() => setEligibleLoading(false));
  }, [detail]);

  async function toggleStatus() {
    if (!detail || !campaignId) return;
    const goingToPause = detail.status === "RUNNING";
    setTogglingStatus(true);
    setActionError("");
    try {
      const res = await authedFetch(`/api/ebay/campaigns/${campaignId}/${goingToPause ? "pause" : "resume"}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Erro ao mudar o status da campanha");
        return;
      }
      await fetchDetail(campaignId);
      onChanged();
    } catch {
      setActionError("Falha na conexão ao mudar o status da campanha");
    } finally {
      setTogglingStatus(false);
    }
  }

  async function saveBudget() {
    if (!campaignId) return;
    const value = Number(budgetInput);
    if (!Number.isFinite(value) || value <= 0) {
      setActionError("Orçamento precisa ser um número maior que zero");
      return;
    }
    setSavingBudget(true);
    setActionError("");
    setBudgetSaved(false);
    try {
      const res = await authedFetch(`/api/ebay/campaigns/${campaignId}/budget`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyBudget: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Erro ao salvar o orçamento");
        return;
      }
      setBudgetSaved(true);
      setTimeout(() => setBudgetSaved(false), 3000);
      await fetchDetail(campaignId);
      onChanged();
    } catch {
      setActionError("Falha na conexão ao salvar o orçamento");
    } finally {
      setSavingBudget(false);
    }
  }

  async function handleEnd() {
    if (!campaignId) return;
    if (!confirmingEnd) {
      setConfirmingEnd(true);
      return;
    }
    setEnding(true);
    setActionError("");
    try {
      const res = await authedFetch(`/api/ebay/campaigns/${campaignId}/end`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Erro ao encerrar a campanha");
        return;
      }
      setConfirmingEnd(false);
      await fetchDetail(campaignId);
      onChanged();
    } catch {
      setActionError("Falha na conexão ao encerrar a campanha");
    } finally {
      setEnding(false);
    }
  }

  async function handleDelete() {
    if (!campaignId) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setDeleting(true);
    setActionError("");
    try {
      const res = await authedFetch(`/api/ebay/campaigns/${campaignId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Erro ao excluir a campanha");
        return;
      }
      onChanged();
      onClose();
    } catch {
      setActionError("Falha na conexão ao excluir a campanha");
    } finally {
      setDeleting(false);
    }
  }

  async function saveAdBid(listingId: string) {
    if (!campaignId) return;
    const bidPercentage = adBidDrafts[listingId];
    if (!bidPercentage) return;
    setAdBusyId(listingId);
    setAdsError("");
    try {
      const res = await authedFetch(`/api/ebay/campaigns/${campaignId}/ads/bid`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, bidPercentage }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAdsError(data.error || "Erro ao atualizar a taxa do anúncio");
        return;
      }
      await fetchAds(campaignId);
    } catch {
      setAdsError("Falha na conexão ao atualizar a taxa do anúncio");
    } finally {
      setAdBusyId(null);
    }
  }

  async function toggleAdStatus(ad: CampaignAd) {
    if (!campaignId) return;
    const nextStatus = ad.adStatus === "PAUSED" ? "ACTIVE" : "PAUSED";
    setAdBusyId(ad.listingId);
    setAdsError("");
    try {
      const res = await authedFetch(`/api/ebay/campaigns/${campaignId}/ads/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: ad.listingId, adStatus: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAdsError(data.error || "Erro ao mudar o status do anúncio");
        return;
      }
      await fetchAds(campaignId);
    } catch {
      setAdsError("Falha na conexão ao mudar o status do anúncio");
    } finally {
      setAdBusyId(null);
    }
  }

  async function handleAddListing(itemId: string) {
    if (!campaignId) return;
    setAddingListing(true);
    setAdsError("");
    try {
      const res = await authedFetch(`/api/ebay/campaigns/${campaignId}/ads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: itemId, bidPercentage: addListingBid }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAdsError(data.error || "Erro ao adicionar o produto à campanha");
        return;
      }
      setShowAddListing(false);
      await fetchAds(campaignId);
      onChanged();
    } catch {
      setAdsError("Falha na conexão ao adicionar o produto");
    } finally {
      setAddingListing(false);
    }
  }

  return (
    <Dialog open={!!campaignId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Carregando detalhe da campanha...</span>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : detail ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                {detail.name}
                <Badge variant="outline">{STATUS_LABEL[detail.status] ?? detail.status}</Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              {actionError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{actionError}</AlertDescription>
                </Alert>
              )}

              <div className="border rounded-lg p-3 bg-muted/30">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-sm font-medium">Desempenho</p>
                  <span className="text-xs text-muted-foreground">
                    {REPORT_PERIODS.find((p) => p.value === period)?.label ?? period}
                  </span>
                </div>
                {metrics ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs flex items-center gap-1"><Eye className="h-3 w-3" /> Impressões</p>
                      <p className="font-semibold">{metrics.impressions.toLocaleString("pt-BR")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> Cliques</p>
                      <p className="font-semibold">{metrics.clicks.toLocaleString("pt-BR")}</p>
                      <p className="text-[11px] text-muted-foreground">CTR {pct(metrics.ctr)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs flex items-center gap-1"><DollarSign className="h-3 w-3" /> Gasto</p>
                      <p className="font-semibold">{money(metrics.spend)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> Vendas</p>
                      <p className="font-semibold">{metrics.sales.toLocaleString("pt-BR")}</p>
                      <p className="text-[11px] text-muted-foreground">{money(metrics.revenue)} receita</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs flex items-center gap-1"><Target className="h-3 w-3" /> ROAS</p>
                      <p className="font-semibold">{metrics.roas.toFixed(2)}x</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Custo por venda</p>
                      <p className="font-semibold">{metrics.sales > 0 ? money(metrics.costPerSale) : "—"}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Métricas de desempenho indisponíveis no momento para esta campanha.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Modelo de cobrança</p>
                  <p className="font-medium">{detail.fundingModel === "COST_PER_CLICK" ? "Custo por Clique" : detail.fundingModel === "COST_PER_SALE" ? "Custo por Venda" : "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">ID da campanha</p>
                  <p className="font-mono text-xs">{detail.campaignId}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Início</p>
                  <p className="font-medium">{fmtDate(detail.startDate)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Fim</p>
                  <p className="font-medium">{fmtDate(detail.endDate)}</p>
                </div>
                {detail.bidPercentage && (
                  <div>
                    <p className="text-muted-foreground text-xs">Taxa de anúncio</p>
                    <p className="font-medium">{detail.bidPercentage}%</p>
                  </div>
                )}
                {detail.channels.length > 0 && (
                  <div>
                    <p className="text-muted-foreground text-xs">Canais</p>
                    <p className="font-medium">{detail.channels.join(", ")}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {(detail.status === "RUNNING" || detail.status === "PAUSED") && (
                  <Button
                    variant="outline"
                    onClick={toggleStatus}
                    disabled={togglingStatus}
                    className="gap-1.5"
                    type="button"
                  >
                    {togglingStatus ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : detail.status === "RUNNING" ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    {detail.status === "RUNNING" ? "Pausar campanha" : "Retomar campanha"}
                  </Button>
                )}

                {(detail.status === "RUNNING" || detail.status === "PAUSED" || detail.status === "SCHEDULED") && (
                  <Button
                    variant="outline"
                    onClick={handleEnd}
                    disabled={ending}
                    className={confirmingEnd ? "gap-1.5 border-destructive text-destructive" : "gap-1.5"}
                    type="button"
                  >
                    {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                    {confirmingEnd ? "Confirmar encerramento?" : "Encerrar campanha"}
                  </Button>
                )}

                {detail.status === "ENDED" && (
                  <Button
                    variant="outline"
                    onClick={handleDelete}
                    disabled={deleting}
                    className={confirmingDelete ? "gap-1.5 border-destructive text-destructive" : "gap-1.5"}
                    type="button"
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    {confirmingDelete ? "Confirmar exclusão?" : "Excluir campanha"}
                  </Button>
                )}
              </div>

              {detail.fundingModel === "COST_PER_CLICK" && (
                <div className="border rounded-lg p-3 space-y-2">
                  <Label htmlFor="budget-input">Orçamento diário ({detail.currency ?? "USD"})</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="budget-input"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value)}
                    />
                    <Button onClick={saveBudget} disabled={savingBudget} type="button" className="shrink-0">
                      {savingBudget ? <Loader2 className="h-4 w-4 animate-spin" /> : budgetSaved ? "Salvo!" : <><Save className="h-4 w-4 mr-1.5" />Salvar</>}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O eBay exige que a mudança seja de pelo menos $0.50 e limita a 15 atualizações de orçamento por campanha por dia.
                  </p>
                </div>
              )}

              {detail.fundingModel === "COST_PER_CLICK" ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Produtos nesta campanha</p>
                    {detail.status !== "ENDED" && (
                      <Button variant="outline" size="sm" className="gap-1" type="button" onClick={() => setShowAddListing((v) => !v)}>
                        <Plus className="h-3.5 w-3.5" /> Adicionar produto
                      </Button>
                    )}
                  </div>

                  {showAddListing && (
                    <div className="border rounded-lg p-3 mb-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="add-listing-bid" className="text-xs shrink-0">Taxa de anúncio (%)</Label>
                        <Input
                          id="add-listing-bid"
                          type="number"
                          min="1"
                          max="100"
                          step="1"
                          value={addListingBid}
                          onChange={(e) => setAddListingBid(e.target.value)}
                          className="w-24"
                        />
                      </div>
                      <EbayListingPicker selectedItemId={null} onSelect={handleAddListing} />
                      {addingListing && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Adicionando produto...
                        </div>
                      )}
                    </div>
                  )}

                  {adsError && (
                    <Alert variant="destructive" className="mb-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{adsError}</AlertDescription>
                    </Alert>
                  )}
                  {adsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                      <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                    </div>
                  ) : ads && ads.length > 0 ? (
                    <div className="border rounded-lg divide-y">
                      {ads.map((ad) => (
                        <div key={ad.adId} className="flex items-center justify-between gap-2 p-2.5 text-sm">
                          <a
                            href={`https://www.ebay.com/itm/${ad.listingId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline font-mono text-xs shrink-0"
                          >
                            {ad.listingId} <ExternalLink className="h-3 w-3" />
                          </a>
                          <div className="flex items-center gap-1.5 ml-auto">
                            <Input
                              type="number"
                              min="1"
                              max="100"
                              value={adBidDrafts[ad.listingId] ?? ""}
                              onChange={(e) => setAdBidDrafts((prev) => ({ ...prev, [ad.listingId]: e.target.value }))}
                              className="w-16 h-7 text-xs"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              type="button"
                              disabled={adBusyId === ad.listingId}
                              onClick={() => saveAdBid(ad.listingId)}
                            >
                              {adBusyId === ad.listingId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 gap-1"
                              type="button"
                              disabled={adBusyId === ad.listingId}
                              onClick={() => toggleAdStatus(ad)}
                            >
                              {ad.adStatus === "PAUSED" ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum produto encontrado nesta campanha.</p>
                  )}
                </div>
              ) : detail.selectionRules ? (
                <div>
                  <p className="text-sm font-medium mb-2">Regras de seleção automática de produtos</p>
                  <div className="border rounded-lg p-3 text-sm space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      Campanhas de Custo por Venda não têm uma lista fixa de produtos — o eBay inclui automaticamente
                      qualquer anúncio que bata com estas regras.
                    </p>
                    {detail.selectionRules.categoryIds.length > 0 && (
                      <p><span className="text-muted-foreground">Categorias:</span> {detail.selectionRules.categoryIds.join(", ")}</p>
                    )}
                    {detail.selectionRules.brands.length > 0 && (
                      <p><span className="text-muted-foreground">Marcas:</span> {detail.selectionRules.brands.join(", ")}</p>
                    )}
                    {(detail.selectionRules.minPrice || detail.selectionRules.maxPrice) && (
                      <p>
                        <span className="text-muted-foreground">Faixa de preço:</span>{" "}
                        {detail.selectionRules.minPrice ?? "sem mínimo"} – {detail.selectionRules.maxPrice ?? "sem máximo"}
                      </p>
                    )}
                    {detail.autoSelectFutureInventory && (
                      <p className="text-muted-foreground text-xs">Inclui produtos novos automaticamente.</p>
                    )}
                    {unrestrictedRules(detail.selectionRules) && (
                      <p className="text-muted-foreground">Todos os produtos elegíveis da conta.</p>
                    )}
                  </div>

                  {unrestrictedRules(detail.selectionRules) && (
                    <div className="mt-3">
                      <p className="text-sm font-medium mb-2">Produtos elegíveis (todo o catálogo ativo)</p>
                      {eligibleLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                          <Loader2 className="h-4 w-4 animate-spin" /> Carregando produtos...
                        </div>
                      ) : eligibleListings && eligibleListings.length > 0 ? (
                        <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                          {eligibleListings.map((l) => (
                            <div key={l.itemId} className="flex items-center gap-2.5 p-2 text-sm">
                              {l.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={l.imageUrl} alt="" className="h-8 w-8 rounded object-cover shrink-0 bg-muted" />
                              ) : (
                                <div className="h-8 w-8 rounded shrink-0 bg-muted" />
                              )}
                              <p className="flex-1 min-w-0 truncate text-xs">{l.title}</p>
                              <span className="text-xs font-semibold shrink-0">${l.price.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhum produto ativo encontrado na conta.</p>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
