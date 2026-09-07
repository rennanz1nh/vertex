"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle, Loader2, Rocket, Sparkles } from "lucide-react";
import { EbayListingMultiPicker } from "@/components/ebay/EbayListingMultiPicker";
import { authedFetch } from "@/lib/admin-fetch";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

type Recommendation = { listingId: string; bidPercentage: string | null; promoteWithAd: string | null };

export function CreateCampaignDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(todayStr());
  const [dailyBudget, setDailyBudget] = useState("5.00");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [recommendationError, setRecommendationError] = useState("");

  function reset() {
    setName("");
    setStartDate(todayStr());
    setDailyBudget("5.00");
    setSelectedItemIds(new Set());
    setConfirmed(false);
    setError("");
    setRecommendations(null);
    setRecommendationError("");
  }

  async function fetchRecommendations() {
    if (selectedItemIds.size === 0) {
      setRecommendationError("Selecione pelo menos um anúncio primeiro");
      return;
    }
    setLoadingRecommendations(true);
    setRecommendationError("");
    try {
      const res = await authedFetch("/api/ebay/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingIds: [...selectedItemIds] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRecommendationError(data.error || "Erro ao buscar recomendações do eBay");
        return;
      }
      setRecommendations(data.recommendations);
    } catch {
      setRecommendationError("Falha na conexão ao buscar recomendações");
    } finally {
      setLoadingRecommendations(false);
    }
  }

  async function handleCreate() {
    const budget = Number(dailyBudget);
    if (!name.trim()) return setError("Dê um nome pra campanha");
    if (!Number.isFinite(budget) || budget <= 0) return setError("Orçamento diário precisa ser maior que zero");
    if (selectedItemIds.size === 0) return setError("Selecione pelo menos um anúncio");
    if (!confirmed) return setError("Confirme que entendeu que isso gera gasto real de anúncio antes de continuar");

    setSubmitting(true);
    setError("");
    try {
      const res = await authedFetch("/api/ebay/campaigns/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), startDate, dailyBudget: budget, listingIds: [...selectedItemIds] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao criar a campanha");
        return;
      }
      reset();
      onCreated();
      onClose();
    } catch {
      setError("Falha na conexão ao criar a campanha");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova campanha (Custo por Clique)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Esta é a parte menos verificada dessa integração (a documentação completa desse endpoint não pôde ser
              conferida contra uma resposta real). Assim que criar a primeira campanha, confira no Seller Hub do eBay
              se ela ficou como esperado antes de confiar nisso sem olhar.
            </AlertDescription>
          </Alert>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-name">Nome da campanha</Label>
              <Input id="campaign-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Promoção Keratin Agosto" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-start">Data de início</Label>
              <Input id="campaign-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} min={todayStr()} />
            </div>
          </div>

          <div className="space-y-1.5 max-w-[200px]">
            <Label htmlFor="campaign-budget">Orçamento diário (USD)</Label>
            <Input id="campaign-budget" type="number" min="0.01" step="0.01" value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Anúncios a promover</Label>
            <EbayListingMultiPicker selectedItemIds={selectedItemIds} onChange={setSelectedItemIds} />
          </div>

          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="gap-1.5"
              onClick={fetchRecommendations}
              disabled={loadingRecommendations}
            >
              {loadingRecommendations ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Ver lance sugerido pelo eBay
            </Button>
            {recommendationError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{recommendationError}</AlertDescription>
              </Alert>
            )}
            {recommendations && recommendations.length > 0 && (
              <div className="border rounded-lg divide-y text-sm">
                {recommendations.map((r) => (
                  <div key={r.listingId} className="flex items-center justify-between p-2 gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{r.listingId}</span>
                    <span>
                      {r.bidPercentage ? `Sugestão: ${r.bidPercentage}%` : "Sem sugestão disponível"}
                      {r.promoteWithAd && r.promoteWithAd !== "true" && (
                        <span className="text-xs text-muted-foreground ml-1.5">({r.promoteWithAd})</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Entendo que isso cria uma campanha real no eBay que vai gastar até{" "}
              <strong>${Number(dailyBudget || 0).toFixed(2)}/dia</strong> assim que ativa.
            </span>
          </label>

          <Button onClick={handleCreate} disabled={submitting} className="w-full gap-1.5" type="button">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            {submitting ? "Criando..." : "Criar campanha"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
