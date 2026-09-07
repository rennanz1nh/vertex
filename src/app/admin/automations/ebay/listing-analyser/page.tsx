"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2, AlertCircle, CheckCircle2, Send, Link2, Plus, X, ImagePlus, Wand2, Sparkles, Eye,
} from "lucide-react";
import { EbayListingPicker } from "@/components/ebay/EbayListingPicker";
import { EbayAutomationTabs } from "@/components/ebay/EbayAutomationTabs";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compress";
import { authedFetch } from "@/lib/admin-fetch";

const TITLE_MAX_LENGTH = 80;
const MAX_REFERENCES = 5;

type EbayListingDetail = {
  itemId: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  images: string[];
  itemSpecifics: { name: string; values: string[] }[];
};

type ReferenceListing = {
  itemId: string;
  title: string;
  description: string;
  imageUrl?: string;
  itemSpecifics: { name: string; values: string[] }[];
};

type SpecificRow = { name: string; values: string };

type DiscoveryResult = {
  suggestedTitle: string;
  titleKeywordGaps: string[];
  specificsSuggestions: { name: string; suggestedValue: string; reason: string }[];
};

function extractItemId(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d{9,}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/\/itm\/(?:[^/?]+\/)?(\d{9,})/);
  return match ? match[1] : null;
}

export default function ListingAnalyserPage() {
  // 1. Our listing
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [sourceDetail, setSourceDetail] = useState<EbayListingDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");

  // 2. References
  const [referenceInput, setReferenceInput] = useState("");
  const [references, setReferences] = useState<ReferenceListing[]>([]);
  const [referenceError, setReferenceError] = useState("");
  const [addingReference, setAddingReference] = useState(false);

  // Draft fields — shared final state, editable regardless of whether AI ran
  const [draftTitle, setDraftTitle] = useState("");
  const [draftSpecifics, setDraftSpecifics] = useState<SpecificRow[]>([]);
  const [draftDescription, setDraftDescription] = useState("");

  // 3. Discovery (title + specifics)
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryError, setDiscoveryError] = useState("");
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult | null>(null);

  // 4. Conversion (description + images)
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState("");
  const [descriptionLoading, setDescriptionLoading] = useState(false);
  const [descriptionError, setDescriptionError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  // 5. Revise (apply to live listing)
  const [reviseDialogOpen, setReviseDialogOpen] = useState(false);
  const [revising, setRevising] = useState(false);
  const [reviseError, setReviseError] = useState("");
  const [revisedSuccess, setRevisedSuccess] = useState(false);

  async function handleSelectListing(itemId: string) {
    setSelectedItemId(itemId);
    setSourceDetail(null);
    setLoadingDetail(true);
    setDetailError("");
    setReferences([]);
    setReferenceInput("");
    setReferenceError("");
    setDiscoveryResult(null);
    setDiscoveryError("");
    setUploadedImages([]);
    setDescriptionError("");
    setRevisedSuccess(false);
    setReviseError("");

    try {
      const res = await authedFetch(`/api/ebay/listing-detail?itemId=${itemId}`);
      const data = await res.json();
      if (!res.ok) {
        setDetailError(data.error || "Erro ao carregar detalhes do anúncio");
        return;
      }
      const detail: EbayListingDetail = data.listing;
      setSourceDetail(detail);
      setDraftTitle(detail.title);
      setDraftDescription(detail.description);
      setDraftSpecifics(detail.itemSpecifics.map((s) => ({ name: s.name, values: s.values.join(", ") })));
    } catch {
      setDetailError("Falha na conexão ao carregar detalhes do anúncio");
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleAddReference() {
    const itemId = extractItemId(referenceInput);
    if (!itemId) {
      setReferenceError("Não consegui identificar o ID do anúncio nesse link. Cole um link de /itm/ do eBay.");
      return;
    }
    if (references.some((r) => r.itemId === itemId)) {
      setReferenceError("Esse anúncio já foi adicionado.");
      return;
    }
    if (references.length >= MAX_REFERENCES) {
      setReferenceError(`Máximo de ${MAX_REFERENCES} referências.`);
      return;
    }
    setReferenceError("");
    setAddingReference(true);
    try {
      const res = await authedFetch(`/api/ebay/listing-detail?itemId=${itemId}`);
      const data = await res.json();
      if (!res.ok) {
        setReferenceError(data.error || "Erro ao carregar esse anúncio de referência");
        return;
      }
      const detail: EbayListingDetail = data.listing;
      setReferences((prev) => [
        ...prev,
        {
          itemId: detail.itemId,
          title: detail.title,
          description: detail.description,
          imageUrl: detail.images[0],
          itemSpecifics: detail.itemSpecifics,
        },
      ]);
      setReferenceInput("");
    } catch {
      setReferenceError("Falha na conexão ao carregar o anúncio de referência");
    } finally {
      setAddingReference(false);
    }
  }

  function handleRemoveReference(itemId: string) {
    setReferences((prev) => prev.filter((r) => r.itemId !== itemId));
  }

  async function handleAnalyzeDiscovery() {
    if (!sourceDetail || references.length === 0) return;
    setDiscoveryLoading(true);
    setDiscoveryError("");
    try {
      const res = await authedFetch("/api/ebay/analyze-discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current: { title: sourceDetail.title, itemSpecifics: sourceDetail.itemSpecifics },
          references: references.map((r) => ({ title: r.title, itemSpecifics: r.itemSpecifics })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDiscoveryError(data.error || "Erro ao analisar o anúncio");
        return;
      }
      setDiscoveryResult(data);
    } catch {
      setDiscoveryError("Falha na conexão ao analisar o anúncio");
    } finally {
      setDiscoveryLoading(false);
    }
  }

  function applySuggestedTitle() {
    if (discoveryResult) setDraftTitle(discoveryResult.suggestedTitle);
  }

  function addSuggestedSpecific(name: string, value: string) {
    setDraftSpecifics((prev) => {
      const existing = prev.findIndex((s) => s.name.toLowerCase() === name.toLowerCase());
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { name, values: value };
        return next;
      }
      return [...prev, { name, values: value }];
    });
  }

  function updateSpecificRow(index: number, field: "name" | "values", value: string) {
    setDraftSpecifics((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function removeSpecificRow(index: number) {
    setDraftSpecifics((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploadingImage(true);
    setImageUploadError("");
    try {
      for (const file of files) {
        const blob = await compressImage(file);
        const path = `${selectedItemId ?? "ref"}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
        const { error } = await supabase.storage
          .from("listing-images")
          .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
        if (error) throw error;
        const { data } = supabase.storage.from("listing-images").getPublicUrl(path);
        setUploadedImages((prev) => [...prev, data.publicUrl]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      setImageUploadError(`Falha ao subir imagem: ${message}`);
    } finally {
      setUploadingImage(false);
    }
  }

  function removeUploadedImage(url: string) {
    setUploadedImages((prev) => prev.filter((u) => u !== url));
  }

  async function handleGenerateDescription() {
    if (!sourceDetail) return;
    setDescriptionLoading(true);
    setDescriptionError("");
    try {
      const res = await authedFetch("/api/ebay/analyze-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentTitle: sourceDetail.title,
          currentDescription: sourceDetail.description,
          imageUrls: uploadedImages,
          referenceDescriptions: references.map((r) => r.description),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDescriptionError(data.error || "Erro ao gerar a descrição");
        return;
      }
      setDraftDescription(data.improvedDescriptionHtml);
    } catch {
      setDescriptionError("Falha na conexão ao gerar a descrição");
    } finally {
      setDescriptionLoading(false);
    }
  }

  async function handleConfirmRevise() {
    if (!selectedItemId) return;
    setRevising(true);
    setReviseError("");
    try {
      const res = await authedFetch("/api/ebay/revise-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: selectedItemId,
          title: draftTitle,
          description: draftDescription,
          itemSpecifics: draftSpecifics
            .filter((s) => s.name.trim() && s.values.trim())
            .map((s) => ({ name: s.name.trim(), values: s.values.split(",").map((v) => v.trim()).filter(Boolean) })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setReviseError(data.error || data.errors?.join("; ") || "Erro ao atualizar o anúncio");
        return;
      }
      setRevisedSuccess(true);
      setReviseDialogOpen(false);
    } catch {
      setReviseError("Falha na conexão ao atualizar o anúncio");
    } finally {
      setRevising(false);
    }
  }

  const titleTooLong = draftTitle.length > TITLE_MAX_LENGTH;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/EBay_logo.svg.png" alt="eBay" className="h-10 w-auto" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Listing Analyser</h1>
          <p className="text-muted-foreground text-sm">
            Compare com anúncios de referência e use IA para melhorar título, especificações e descrição
          </p>
        </div>
      </div>

      <EbayAutomationTabs />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card>
          <CardHeader>
            <CardTitle>1. Selecionar Anúncio</CardTitle>
            <CardDescription>Escolha o anúncio que você quer melhorar</CardDescription>
          </CardHeader>
          <CardContent>
            <EbayListingPicker selectedItemId={selectedItemId} onSelect={handleSelectListing} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Anúncios de Referência</CardTitle>
            <CardDescription>Cole links de anúncios do eBay da mesma linha de produto que vendem bem (até {MAX_REFERENCES})</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selectedItemId ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Selecione um anúncio ao lado para começar</p>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://www.ebay.com/itm/..."
                    value={referenceInput}
                    onChange={(e) => setReferenceInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddReference()}
                    disabled={references.length >= MAX_REFERENCES}
                  />
                  <Button
                    variant="outline"
                    onClick={handleAddReference}
                    disabled={addingReference || !referenceInput.trim() || references.length >= MAX_REFERENCES}
                  >
                    {addingReference ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
                {referenceError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{referenceError}</AlertDescription>
                  </Alert>
                )}
                {references.length > 0 && (
                  <div className="border rounded-lg divide-y">
                    {references.map((r) => (
                      <div key={r.itemId} className="flex items-center gap-3 p-2.5">
                        {r.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.imageUrl} alt="" className="h-10 w-10 rounded object-cover shrink-0 bg-muted" />
                        ) : (
                          <div className="h-10 w-10 rounded shrink-0 bg-muted" />
                        )}
                        <p className="flex-1 min-w-0 text-sm truncate">{r.title}</p>
                        <button type="button" onClick={() => handleRemoveReference(r.itemId)} className="text-muted-foreground hover:text-destructive shrink-0">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {detailError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{detailError}</AlertDescription>
        </Alert>
      )}
      {loadingDetail && (
        <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando anúncio...</span>
        </div>
      )}

      {sourceDetail && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                3. Descoberta — Título e Especificações
                <Badge variant="outline" className="font-normal">o que faz o anúncio ser encontrado</Badge>
              </CardTitle>
              <CardDescription>Compara com as referências para sugerir título e especificações mais completas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                disabled={discoveryLoading || references.length === 0}
                onClick={handleAnalyzeDiscovery}
                title={references.length === 0 ? "Adicione pelo menos 1 anúncio de referência" : undefined}
              >
                {discoveryLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analisando...</>
                ) : (
                  <><Wand2 className="mr-2 h-4 w-4" />Analisar com IA</>
                )}
              </Button>

              {discoveryError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{discoveryError}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Título Atual</Label>
                  <Input value={sourceDetail.title} readOnly className="bg-muted/30" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Título (rascunho editável)</Label>
                    <span className={`text-xs ${titleTooLong ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                      {draftTitle.length}/{TITLE_MAX_LENGTH}
                    </span>
                  </div>
                  <Input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className={titleTooLong ? "border-destructive text-destructive focus-visible:ring-destructive" : ""}
                  />
                  {titleTooLong && (
                    <p className="text-xs text-destructive">Excede o limite do eBay em {draftTitle.length - TITLE_MAX_LENGTH} caractere{draftTitle.length - TITLE_MAX_LENGTH > 1 ? "s" : ""}</p>
                  )}
                </div>
              </div>

              {discoveryResult && (
                <div className="space-y-3 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Título sugerido pela IA</Label>
                    <Button size="sm" variant="ghost" onClick={applySuggestedTitle} className="h-7 gap-1">
                      <Sparkles className="h-3 w-3" />Usar este título
                    </Button>
                  </div>
                  <p className="text-sm border rounded-lg p-2.5 bg-muted/20">{discoveryResult.suggestedTitle}</p>

                  {discoveryResult.titleKeywordGaps.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Palavras que as referências têm e o nosso título não</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {discoveryResult.titleKeywordGaps.map((w, i) => (
                          <Badge key={i} variant="outline">{w}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {discoveryResult.specificsSuggestions.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Especificações sugeridas</Label>
                      <div className="border rounded-lg divide-y">
                        {discoveryResult.specificsSuggestions.map((s, i) => (
                          <div key={i} className="flex items-center gap-3 p-2.5">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{s.name}: <span className="font-normal">{s.suggestedValue}</span></p>
                              <p className="text-xs text-muted-foreground">{s.reason}</p>
                            </div>
                            <Button size="sm" variant="outline" className="shrink-0" onClick={() => addSuggestedSpecific(s.name, s.suggestedValue)}>
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5 pt-2 border-t">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Especificações (rascunho editável)</Label>
                <div className="border rounded-lg divide-y">
                  {draftSpecifics.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 p-2">
                      <Input value={s.name} onChange={(e) => updateSpecificRow(i, "name", e.target.value)} placeholder="Nome" className="flex-1" />
                      <Input value={s.values} onChange={(e) => updateSpecificRow(i, "values", e.target.value)} placeholder="Valor(es), separados por vírgula" className="flex-1" />
                      <button type="button" onClick={() => removeSpecificRow(i)} className="text-muted-foreground hover:text-destructive shrink-0">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setDraftSpecifics((prev) => [...prev, { name: "", values: "" }])} className="gap-1">
                  <Plus className="h-3.5 w-3.5" />Adicionar campo manualmente
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                4. Conversão — Descrição
                <Badge variant="outline" className="font-normal">o que faz quem já achou o anúncio comprar</Badge>
              </CardTitle>
              <CardDescription>Suba fotos do produto e gere uma descrição em HTML mais completa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Imagens</Label>
                <div className="flex flex-wrap gap-2">
                  {uploadedImages.map((url) => (
                    <div key={url} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-16 w-16 rounded object-cover border" />
                      <button
                        type="button"
                        onClick={() => removeUploadedImage(url)}
                        className="absolute -top-1.5 -right-1.5 bg-background border rounded-full p-0.5 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <label className="h-16 w-16 rounded border border-dashed flex items-center justify-center cursor-pointer text-muted-foreground hover:bg-muted/30 shrink-0">
                    {uploadingImage ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                  </label>
                </div>
                {imageUploadError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{imageUploadError}</AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" disabled={descriptionLoading} onClick={handleGenerateDescription}>
                  {descriptionLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando...</>
                  ) : (
                    <><Wand2 className="mr-2 h-4 w-4" />Gerar Descrição Melhorada</>
                  )}
                </Button>
                <Button variant="outline" disabled={!draftDescription} onClick={() => setPreviewOpen(true)}>
                  <Eye className="mr-2 h-4 w-4" />Preview
                </Button>
              </div>

              {descriptionError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{descriptionError}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Pré-visualização</Label>
                    <button type="button" onClick={() => setPreviewOpen(true)} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                      <Eye className="h-3 w-3" />Ampliar
                    </button>
                  </div>
                  <div
                    className="border rounded-lg p-3 max-h-80 overflow-y-auto text-sm bg-muted/20"
                    dangerouslySetInnerHTML={{ __html: draftDescription }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">HTML (editável)</Label>
                  <Textarea value={draftDescription} onChange={(e) => setDraftDescription(e.target.value)} rows={12} className="font-mono text-xs" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>5. Aplicar no eBay</CardTitle>
              <CardDescription>Revisa o anúncio que já está no ar com o título, especificações e descrição acima</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {reviseError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{reviseError}</AlertDescription>
                </Alert>
              )}

              {revisedSuccess ? (
                <Alert className="border-emerald-200 bg-emerald-50">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-emerald-800">
                    Anúncio atualizado com sucesso.{" "}
                    <a
                      href={`https://www.ebay.com/itm/${selectedItemId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-medium"
                    >
                      Ver no eBay
                    </a>
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="flex items-center gap-3">
                  <Button
                    className="gap-2"
                    disabled={titleTooLong}
                    onClick={() => setReviseDialogOpen(true)}
                    title={titleTooLong ? "Título excede o limite de 80 caracteres do eBay" : undefined}
                  >
                    <Send className="h-4 w-4" />
                    Aplicar no eBay
                  </Button>
                  <a
                    href={`https://www.ebay.com/itm/${selectedItemId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Ver anúncio atual
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <AlertDialog open={reviseDialogOpen} onOpenChange={setReviseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar atualização do anúncio</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Isso vai atualizar <strong>o anúncio que já está ativo e à venda</strong> no eBay — título, especificações
                  e descrição, agora mesmo. Diferente do Listings Automation (que cria um anúncio novo), essa ação edita o
                  original. O eBay não oferece uma pré-visualização de erros para essa operação, então revise o rascunho
                  acima com atenção antes de confirmar.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revising}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={revising}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmRevise();
              }}
            >
              {revising ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Aplicando...</>
              ) : (
                "Confirmar e Aplicar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Preview — como a descrição deve aparecer no anúncio</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 pt-3 space-y-3">
            <p className="text-lg font-semibold leading-snug">{draftTitle || sourceDetail?.title}</p>
            <div className="border rounded-lg p-4 bg-white text-black" dangerouslySetInnerHTML={{ __html: draftDescription }} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
