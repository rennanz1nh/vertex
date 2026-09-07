"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EbayListingPicker } from "@/components/ebay/EbayListingPicker";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { authedFetch } from "@/lib/admin-fetch";

interface Draft {
  name: string;
  ai_description: string | null;
  price: number | string | null;
  images: string[];
}

interface EbayListingDetail {
  categoryId: string;
  categoryName: string;
  conditionId: string;
  currency: string;
  sku: string | null;
  itemSpecifics: { name: string; values: string[] }[];
  packageDetails: unknown;
  sellerProfiles: unknown;
  country: string;
  postalCode: string;
  listingDuration: string;
}

type Step = "pick-template" | "review" | "done";

// Publishing a genuinely new product needs a category, condition, and shipping/payment/
// return profiles — the same fields the eBay Listings Automation page already collects,
// but only by picking an existing listing to clone from (there's no from-scratch category
// picker anywhere in this app yet). Reusing that same "clone a template" idea here: pick
// any of your existing eBay listings as the template for category/condition/profiles,
// then swap in this draft's AI-written title/description/price/images before publishing.
export function PublishToEbayDialog({ draft, open, onOpenChange }: { draft: Draft; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [step, setStep] = useState<Step>("pick-template");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateDetail, setTemplateDetail] = useState<EbayListingDetail | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [verifiedOk, setVerifiedOk] = useState(false);
  const [resultItemId, setResultItemId] = useState<string | null>(null);

  async function handlePickTemplate(itemId: string) {
    setTemplateId(itemId);
    setLoadingTemplate(true);
    setError("");
    try {
      const res = await authedFetch(`/api/ebay/listing-detail?itemId=${itemId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao carregar listing modelo");
      setTemplateDetail(data.listing);
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingTemplate(false);
    }
  }

  function buildInput() {
    if (!templateDetail) return null;
    return {
      title: draft.name.slice(0, 80),
      description: draft.ai_description ?? "",
      categoryId: templateDetail.categoryId,
      conditionId: templateDetail.conditionId,
      currency: templateDetail.currency,
      price: Number(draft.price) || 0,
      quantity: 1,
      sku: templateDetail.sku,
      images: draft.images,
      itemSpecifics: templateDetail.itemSpecifics,
      packageDetails: templateDetail.packageDetails,
      sellerProfiles: templateDetail.sellerProfiles,
      country: templateDetail.country,
      postalCode: templateDetail.postalCode,
      listingDuration: templateDetail.listingDuration,
    };
  }

  async function handleVerify() {
    const input = buildInput();
    if (!input) return;
    setVerifying(true);
    setError("");
    setVerifiedOk(false);
    try {
      const res = await authedFetch("/api/ebay/publish-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? data.errors?.join("; ") ?? "Verificação falhou");
      setVerifiedOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setVerifying(false);
    }
  }

  async function handlePublish() {
    const input = buildInput();
    if (!input) return;
    setPublishing(true);
    setError("");
    try {
      const res = await authedFetch("/api/ebay/publish-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, dryRun: false }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? data.errors?.join("; ") ?? "Falha ao publicar");
      setResultItemId(data.itemId);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Publicar no eBay</DialogTitle>
        </DialogHeader>

        {step === "pick-template" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Categoria, condição e perfis de envio/pagamento não têm um seletor próprio ainda — escolha um dos seus
              anúncios já ativos para usar como modelo dessas configurações. Título, descrição, preço e fotos vêm do
              rascunho, não do modelo.
            </p>
            {loadingTemplate ? (
              <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Carregando modelo...
              </div>
            ) : (
              <EbayListingPicker selectedItemId={templateId} onSelect={handlePickTemplate} />
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        {step === "review" && templateDetail && (
          <div className="space-y-3">
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">Título:</span> {draft.name}</p>
              <p><span className="text-muted-foreground">Preço:</span> ${Number(draft.price || 0).toFixed(2)}</p>
              <p><span className="text-muted-foreground">Categoria (do modelo):</span> {templateDetail.categoryName}</p>
              <p><span className="text-muted-foreground">Fotos:</span> {draft.images.length}</p>
            </div>
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle className="h-4 w-4" />{error}</p>
            )}
            {verifiedOk && (
              <p className="text-sm text-green-600 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />Verificado — pronto para publicar.</p>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep("pick-template")}>Trocar modelo</Button>
              {!verifiedOk ? (
                <Button onClick={handleVerify} disabled={verifying}>
                  {verifying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Verificar
                </Button>
              ) : (
                <Button onClick={handlePublish} disabled={publishing}>
                  {publishing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Publicar de verdade
                </Button>
              )}
            </DialogFooter>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-3 text-center py-6">
            <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
            <p className="font-medium">Publicado no eBay!</p>
            {resultItemId && <p className="text-sm text-muted-foreground">Item ID: {resultItemId}</p>}
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
