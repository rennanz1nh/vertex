"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2, AlertCircle, Languages, Sparkles, Link2, CheckCircle2, Send, Megaphone, TrendingDown,
} from "lucide-react";
import { EbayRateLimitsButton } from "@/components/ebay/EbayRateLimitsButton";
import { EbayAutomationTabs } from "@/components/ebay/EbayAutomationTabs";
import { DeepLUsageButton } from "@/components/deepl/DeepLUsageButton";
import { EbayListingPicker } from "@/components/ebay/EbayListingPicker";
import { authedFetch } from "@/lib/admin-fetch";

type EbayListingDetail = {
  itemId: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  conditionId: string;
  currency: string;
  price: number;
  quantity: number;
  sku: string | null;
  images: string[];
  itemSpecifics: { name: string; values: string[] }[];
  packageDetails: {
    weightMajor: string;
    weightMinor: string;
    packageDepth: string;
    packageLength: string;
    packageWidth: string;
    shippingPackage: string;
  } | null;
  sellerProfiles: {
    paymentProfileId: string;
    paymentProfileName: string;
    returnProfileId: string;
    returnProfileName: string;
    shippingProfileId: string;
    shippingProfileName: string;
  } | null;
  country: string;
  postalCode: string;
  listingDuration: string;
};

type PublishResult = {
  ok: boolean;
  itemId: string | null;
  fees: { name: string; amount: string; discount: string; net: string; currency: string }[];
  errors: string[];
  warnings: string[];
};

type PromoInfo = {
  promoted: { isPromoted: boolean; campaignName: string | null; bidPercentage: string | null } | null;
  volumeDiscount: {
    hasVolumeDiscount: boolean;
    promotionName: string | null;
    rules: { minQuantity: number; percentageOff: string | null }[];
  } | null;
};

function ListingPreviewBody({
  detail,
  title,
  description,
  promo,
  promoLoading,
}: {
  detail: EbayListingDetail;
  title: string;
  description: string;
  promo?: PromoInfo | null;
  promoLoading?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium leading-snug">{title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          ${detail.price.toFixed(2)} {detail.currency} · {detail.categoryName || "Categoria"} · Qtd: {detail.quantity}
        </p>
      </div>

      {detail.images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {detail.images.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt="" className="h-16 w-16 rounded object-cover shrink-0 bg-muted" />
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Descrição</Label>
        <div
          className="border rounded-lg p-3 max-h-64 overflow-y-auto text-sm bg-muted/20"
          dangerouslySetInnerHTML={{ __html: description }}
        />
      </div>

      {detail.itemSpecifics.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Especificações</Label>
          <div className="border rounded-lg divide-y">
            {detail.itemSpecifics.map((spec, i) => (
              <div key={i} className="flex justify-between gap-3 px-3 py-1.5 text-sm">
                <span className="text-muted-foreground">{spec.name}</span>
                <span className="font-medium text-right">{spec.values.join(", ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {detail.sku && <Badge variant="outline">SKU: {detail.sku}</Badge>}
        <Badge variant="outline">Condição: {detail.conditionId}</Badge>
        {detail.packageDetails && (
          <Badge variant="outline">
            Peso: {detail.packageDetails.weightMajor}lb {detail.packageDetails.weightMinor}oz
          </Badge>
        )}
        {detail.sellerProfiles && <Badge variant="outline">{detail.sellerProfiles.shippingProfileName}</Badge>}
        <Badge variant="outline">Localização: {detail.country}{detail.postalCode ? ` · ${detail.postalCode}` : ""}</Badge>
        <Badge variant="outline">Duração: {detail.listingDuration}</Badge>
      </div>

      {promo !== undefined && (
        <div className="space-y-1.5 pt-2 border-t">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Impulsionamento &amp; Descontos</Label>
          {promoLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Verificando no eBay...
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {promo?.promoted?.isPromoted ? (
                <Badge className="gap-1 bg-blue-100 text-blue-800 hover:bg-blue-100">
                  <Megaphone className="h-3 w-3" />
                  Impulsionado{promo.promoted.campaignName ? ` — ${promo.promoted.campaignName}` : ""}
                  {promo.promoted.bidPercentage ? ` (${promo.promoted.bidPercentage}% de taxa de anúncio)` : ""}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">Sem impulsionamento ativo</Badge>
              )}

              {promo?.volumeDiscount?.hasVolumeDiscount ? (
                <Badge className="gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                  <TrendingDown className="h-3 w-3" />
                  Desconto progressivo
                  {promo.volumeDiscount.rules.length > 0 &&
                    ` — ${promo.volumeDiscount.rules
                      .map((r) => `${r.minQuantity}+: ${r.percentageOff ?? "?"}%`)
                      .join(", ")}`}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">Sem desconto progressivo</Badge>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const TITLE_MAX_LENGTH = 80;

const LANGUAGES = [
  { code: "ES", name: "Espanhol" },
  { code: "AR", name: "Árabe" },
  { code: "ZH", name: "Chinês" },
  { code: "FR", name: "Francês" },
  { code: "PT-BR", name: "Português (Brasil)" },
  { code: "IT", name: "Italiano" },
  { code: "DE", name: "Alemão" },
];

export default function ListingsAutomationPage() {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const [sourceDetail, setSourceDetail] = useState<EbayListingDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [promoInfo, setPromoInfo] = useState<PromoInfo | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const [targetLang, setTargetLang] = useState("ES");

  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftProvider, setDraftProvider] = useState<"deepl" | "claude" | null>(null);
  const [translating, setTranslating] = useState<"deepl" | "claude" | null>(null);
  const [translateError, setTranslateError] = useState("");

  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<PublishResult | null>(null);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedItemId, setPublishedItemId] = useState<string | null>(null);
  const [publishError, setPublishError] = useState("");

  async function handleSelectListing(itemId: string) {
    setSelectedItemId(itemId);
    setDraftTitle("");
    setDraftDescription("");
    setDraftProvider(null);
    setTranslateError("");
    setSourceDetail(null);
    setLoadingDetail(true);
    setDetailError("");
    setPromoInfo(null);
    setPromoLoading(true);
    setVerifyResult(null);
    setPublishedItemId(null);
    setPublishError("");

    authedFetch(`/api/ebay/listing-promotions?itemId=${itemId}`)
      .then((r) => r.json())
      .then((d) => setPromoInfo({ promoted: d.promoted ?? null, volumeDiscount: d.volumeDiscount ?? null }))
      .catch(() => setPromoInfo({ promoted: null, volumeDiscount: null }))
      .finally(() => setPromoLoading(false));

    try {
      const res = await authedFetch(`/api/ebay/listing-detail?itemId=${itemId}`);
      const data = await res.json();
      if (!res.ok) {
        setDetailError(data.error || "Erro ao carregar detalhes do anúncio");
        return;
      }
      setSourceDetail(data.listing);
    } catch {
      setDetailError("Falha na conexão ao carregar detalhes do anúncio");
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleTranslate(provider: "deepl" | "claude") {
    if (!sourceDetail) return;
    setTranslating(provider);
    setTranslateError("");
    try {
      const languageName = LANGUAGES.find((l) => l.code === targetLang)?.name ?? targetLang;
      const res = await authedFetch(`/api/translate/${provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: sourceDetail.title,
          description: sourceDetail.description,
          targetLang,
          targetLanguageName: languageName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTranslateError(data.error || "Erro ao traduzir");
        return;
      }
      setDraftTitle(data.title);
      setDraftDescription(data.description);
      setDraftProvider(provider);
      setVerifyResult(null);
      setPublishedItemId(null);
      setPublishError("");
    } catch {
      setTranslateError("Falha na conexão ao traduzir");
    } finally {
      setTranslating(null);
    }
  }

  function buildPublishInput() {
    if (!sourceDetail) return null;
    return {
      title: draftTitle,
      description: draftDescription,
      categoryId: sourceDetail.categoryId,
      conditionId: sourceDetail.conditionId,
      currency: sourceDetail.currency,
      price: sourceDetail.price,
      quantity: sourceDetail.quantity,
      sku: sourceDetail.sku,
      images: sourceDetail.images,
      itemSpecifics: sourceDetail.itemSpecifics,
      packageDetails: sourceDetail.packageDetails,
      sellerProfiles: sourceDetail.sellerProfiles
        ? {
            paymentProfileId: sourceDetail.sellerProfiles.paymentProfileId,
            returnProfileId: sourceDetail.sellerProfiles.returnProfileId,
            shippingProfileId: sourceDetail.sellerProfiles.shippingProfileId,
          }
        : null,
      country: sourceDetail.country,
      postalCode: sourceDetail.postalCode,
      listingDuration: sourceDetail.listingDuration,
    };
  }

  async function handleVerifyPublish() {
    const input = buildPublishInput();
    if (!input) return;
    setVerifying(true);
    setPublishError("");
    try {
      const res = await authedFetch("/api/ebay/publish-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPublishError(data.error || "Erro ao verificar o anúncio");
        return;
      }
      setVerifyResult(data);
      setVerifyDialogOpen(true);
    } catch {
      setPublishError("Falha na conexão ao verificar o anúncio");
    } finally {
      setVerifying(false);
    }
  }

  async function handleConfirmPublish() {
    const input = buildPublishInput();
    if (!input) return;
    setPublishing(true);
    setPublishError("");
    try {
      const res = await authedFetch("/api/ebay/publish-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, dryRun: false }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setPublishError(data.error || data.errors?.join("; ") || "Erro ao publicar o anúncio");
        return;
      }
      setPublishedItemId(data.itemId);
      setVerifyDialogOpen(false);
    } catch {
      setPublishError("Falha na conexão ao publicar o anúncio");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/EBay_logo.svg.png" alt="eBay" className="h-10 w-auto" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Listings Automation</h1>
            <p className="text-muted-foreground text-sm">Crie uma cópia de um anúncio em outro idioma — rascunho para revisar antes de publicar</p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <DeepLUsageButton />
          <EbayRateLimitsButton />
        </div>
      </div>

      <EbayAutomationTabs />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card>
          <CardHeader>
            <CardTitle>1. Selecionar Anúncio de Origem</CardTitle>
            <CardDescription>Escolha o anúncio que será copiado e traduzido</CardDescription>
          </CardHeader>
          <CardContent>
            <EbayListingPicker selectedItemId={selectedItemId} onSelect={handleSelectListing} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Idioma e Tradução</CardTitle>
            <CardDescription>Escolha o idioma de destino e gere o rascunho</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedItemId ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Selecione um anúncio ao lado para começar</p>
            ) : detailError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{detailError}</AlertDescription>
              </Alert>
            ) : loadingDetail ? (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Carregando anúncio...</span>
              </div>
            ) : sourceDetail ? (
              <>
                <div className="space-y-1.5">
                  <Label>Idioma de Destino</Label>
                  <Select value={targetLang} onValueChange={setTargetLang}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    disabled={translating !== null}
                    onClick={() => handleTranslate("deepl")}
                  >
                    {translating === "deepl" ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Traduzindo...</>
                    ) : (
                      <><Languages className="mr-2 h-4 w-4" />Traduzir (Automático)</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={translating !== null}
                    onClick={() => handleTranslate("claude")}
                  >
                    {translating === "claude" ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Traduzindo...</>
                    ) : (
                      <><Sparkles className="mr-2 h-4 w-4" />Traduzir com IA</>
                    )}
                  </Button>
                </div>

                {translateError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{translateError}</AlertDescription>
                  </Alert>
                )}

                <div className="pt-2 border-t space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Campos copiados sem alteração</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{sourceDetail.categoryName || "Categoria"}</Badge>
                    <Badge variant="outline">${sourceDetail.price.toFixed(2)} {sourceDetail.currency}</Badge>
                    <Badge variant="outline">{sourceDetail.images.length} imagens</Badge>
                    <Badge variant="outline">{sourceDetail.itemSpecifics.length} especificações</Badge>
                    {sourceDetail.sellerProfiles && <Badge variant="outline">Políticas da conta</Badge>}
                    <Badge variant="outline">Localização ({sourceDetail.country})</Badge>
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {sourceDetail && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <Card>
            <CardHeader>
              <CardTitle>3. Anúncio Original Completo</CardTitle>
              <CardDescription>Como o anúncio está publicado hoje no eBay</CardDescription>
            </CardHeader>
            <CardContent>
              <ListingPreviewBody
                detail={sourceDetail}
                title={sourceDetail.title}
                description={sourceDetail.description}
                promo={promoInfo}
                promoLoading={promoLoading}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. Anúncio Traduzido (Pré-visualização)</CardTitle>
              <CardDescription>Título e descrição traduzidos — os demais campos são copiados sem alteração</CardDescription>
            </CardHeader>
            <CardContent>
              {draftTitle ? (
                <ListingPreviewBody
                  detail={sourceDetail}
                  title={draftTitle}
                  description={draftDescription}
                  promo={promoInfo}
                  promoLoading={promoLoading}
                />
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Clique em &quot;Traduzir (Automático)&quot; ou &quot;Traduzir com IA&quot; acima para gerar a pré-visualização
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {draftTitle && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              5. Rascunho — Revisar Antes de Publicar
              <Badge variant="outline" className="gap-1">
                {draftProvider === "claude" ? <Sparkles className="h-3 w-3" /> : <Languages className="h-3 w-3" />}
                {draftProvider === "claude" ? "Traduzido com IA" : "Traduzido (Automático)"}
              </Badge>
            </CardTitle>
            <CardDescription>Edite o texto traduzido se necessário antes de publicar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Título Original</Label>
                <Input value={sourceDetail?.title ?? ""} readOnly className="bg-muted/30" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Título Traduzido</Label>
                  <span className={`text-xs ${draftTitle.length > TITLE_MAX_LENGTH ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                    {draftTitle.length}/{TITLE_MAX_LENGTH}
                  </span>
                </div>
                <Input
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className={draftTitle.length > TITLE_MAX_LENGTH ? "border-destructive text-destructive focus-visible:ring-destructive" : ""}
                />
                {draftTitle.length > TITLE_MAX_LENGTH && (
                  <p className="text-xs text-destructive">
                    Excede o limite do eBay em {draftTitle.length - TITLE_MAX_LENGTH} caractere{draftTitle.length - TITLE_MAX_LENGTH > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Descrição Original (HTML)</Label>
                <Textarea value={sourceDetail?.description ?? ""} readOnly rows={10} className="bg-muted/30 font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição Traduzida (HTML)</Label>
                <Textarea value={draftDescription} onChange={(e) => setDraftDescription(e.target.value)} rows={10} className="font-mono text-xs" />
              </div>
            </div>

            {publishError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{publishError}</AlertDescription>
              </Alert>
            )}

            {publishedItemId ? (
              <Alert className="border-emerald-200 bg-emerald-50">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <AlertDescription className="text-emerald-800">
                  Anúncio publicado com sucesso — ItemID {publishedItemId}.{" "}
                  <a
                    href={`https://www.ebay.com/itm/${publishedItemId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    Ver no eBay
                  </a>
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex items-center gap-3 pt-2 border-t">
                <Button
                  className="gap-2"
                  disabled={verifying || draftTitle.length > TITLE_MAX_LENGTH}
                  onClick={handleVerifyPublish}
                  title={draftTitle.length > TITLE_MAX_LENGTH ? "Título excede o limite de 80 caracteres do eBay" : undefined}
                >
                  {verifying ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Verificando...</>
                  ) : (
                    <><Send className="h-4 w-4" />Publicar no eBay</>
                  )}
                </Button>
                {selectedItemId && (
                  <a
                    href={`https://www.ebay.com/itm/${selectedItemId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Ver anúncio original
                  </a>
                )}
                <span className="text-xs text-muted-foreground ml-auto inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Cria um novo anúncio no eBay.com (EUA) — não altera o original
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar publicação no eBay</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Isso vai criar um <strong>novo anúncio real e público</strong> no eBay.com (EUA), clonando categoria, preço,
                  fotos, especificações e políticas do anúncio original — só o título e a descrição ficam traduzidos. Pode gerar
                  taxa de inserção.
                </p>
                {verifyResult && verifyResult.fees.length > 0 && (() => {
                  // eBay's "ListingFee" is the aggregate total across every paid feature used
                  // (insertion fee + any add-ons) — not an extra charge on top of the others.
                  // And the sticker "amount" on each fee is BEFORE eBay's free-listing
                  // promotional discount is applied — "net" (amount - discount) is what's
                  // actually charged, which is often $0 even when amount shows $0.35.
                  const total = verifyResult.fees.find((f) => f.name === "ListingFee") ?? verifyResult.fees[0];
                  const breakdown = verifyResult.fees.filter((f) => f.name !== "ListingFee");
                  const hasDiscount = verifyResult.fees.some((f) => parseFloat(f.discount) > 0);
                  return (
                    <div className="border rounded-lg p-2.5 space-y-1">
                      <p className="font-medium text-foreground">
                        Total a pagar: {total.net} {total.currency}
                      </p>
                      {breakdown.map((f, i) => (
                        <p key={i} className="text-xs">
                          {f.name}: {f.net} {f.currency}
                          {parseFloat(f.discount) > 0 && (
                            <span className="text-emerald-600"> (taxa de {f.amount}, desconto promocional de {f.discount})</span>
                          )}
                        </p>
                      ))}
                      {hasDiscount && (
                        <p className="text-xs text-emerald-600 pt-1">
                          Coberto pela promoção de listagem grátis do eBay — por isso normalmente você não paga nada.
                        </p>
                      )}
                    </div>
                  );
                })()}
                {verifyResult && verifyResult.warnings.length > 0 && (
                  <div className="border border-amber-200 bg-amber-50 rounded-lg p-2.5 space-y-1 text-amber-800">
                    {verifyResult.warnings.map((w, i) => (
                      <p key={i}>{w}</p>
                    ))}
                  </div>
                )}
                {verifyResult && verifyResult.errors.length > 0 && (
                  <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-2.5 space-y-1 text-destructive">
                    {verifyResult.errors.map((e, i) => (
                      <p key={i}>{e}</p>
                    ))}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publishing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={publishing || (verifyResult ? verifyResult.errors.length > 0 : false)}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmPublish();
              }}
            >
              {publishing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Publicando...</>
              ) : (
                "Confirmar e Publicar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
