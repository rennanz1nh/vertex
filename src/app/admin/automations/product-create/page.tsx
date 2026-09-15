"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Sparkles, Loader2, Upload, X, Plus, TrendingUp, Trash2, Send,
} from "lucide-react";
import { PublishToEbayDialog } from "@/components/product-create/PublishToEbayDialog";
import { ProductCreateTabs } from "@/components/product-create/ProductCreateTabs";
import { authedFetch } from "@/lib/admin-fetch";

interface Draft {
  id: string;
  name: string | null;
  brand: string | null;
  category: string | null;
  notes: string | null;
  price: number | string | null;
  images: string[];
  ai_description: string | null;
  ai_triggers: string[];
  ai_image_prompts: string[];
  updated_at: string;
}

interface SimilarInternal { id: string; name: string; brand: string; imageUrl: string | null; price: string | null; qty?: number }
interface SimilarEbay { itemId: string; title: string; price: number | null; currency: string | null; imageUrl: string | null; itemWebUrl: string | null }
interface SimilarGoogle { title: string; link: string; snippet: string; thumbnailUrl: string | null }

function emptyDraft(): Draft {
  return {
    id: "",
    name: "",
    brand: "",
    category: "",
    notes: "",
    price: "",
    images: [],
    ai_description: null,
    ai_triggers: [],
    ai_image_prompts: [],
    updated_at: "",
  };
}

export default function ProductCreatePage() {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftSearch, setDraftSearch] = useState("");
  const [current, setCurrent] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [similarQuery, setSimilarQuery] = useState("");
  const [internalResults, setInternalResults] = useState<SimilarInternal[]>([]);
  const [bestsellerResults, setBestsellerResults] = useState<SimilarInternal[]>([]);
  const [ebayResults, setEbayResults] = useState<SimilarEbay[]>([]);
  const [googleResults, setGoogleResults] = useState<SimilarGoogle[]>([]);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const [publishEbayOpen, setPublishEbayOpen] = useState(false);

  const loadDrafts = useCallback(async (q?: string) => {
    const res = await authedFetch(`/api/product-create/drafts${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    const data = await res.json();
    if (data.drafts) setDrafts(data.drafts);
  }, []);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  async function handleSave() {
    setSaving(true);
    try {
      if (current.id) {
        const res = await authedFetch(`/api/product-create/drafts/${current.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: current.name, brand: current.brand, category: current.category,
            notes: current.notes, price: current.price || null, images: current.images,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setCurrent(data.draft);
      } else {
        const res = await authedFetch("/api/product-create/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: current.name, brand: current.brand, category: current.category,
            notes: current.notes, price: current.price || null, images: current.images,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setCurrent(data.draft);
      }
      toast({ title: "Salvo", description: "Rascunho salvo com sucesso." });
      loadDrafts(draftSearch);
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await authedFetch(`/api/product-create/drafts/${id}`, { method: "DELETE" });
    if (current.id === id) setCurrent(emptyDraft());
    loadDrafts(draftSearch);
  }

  async function handleUploadPhotos(files: FileList) {
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const blob = await compressImage(file);
        const path = `product-create/${current.id || "new"}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
        const { error } = await supabase.storage.from("vertex-product-images").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
        if (error) throw error;
        uploaded.push(supabase.storage.from("vertex-product-images").getPublicUrl(path).data.publicUrl);
      }
      setCurrent((c) => ({ ...c, images: [...c.images, ...uploaded] }));
    } catch (e) {
      toast({ title: "Erro ao enviar foto", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  function removeImage(url: string) {
    setCurrent((c) => ({ ...c, images: c.images.filter((i) => i !== url) }));
  }

  async function handleSearchSimilar() {
    const q = similarQuery.trim() || current.name?.trim();
    if (!q) {
      toast({ title: "Digite um termo", description: "Preencha o nome do produto ou o campo de busca.", variant: "destructive" });
      return;
    }
    setSearching(true);
    setGoogleError(null);
    try {
      const [internal, bestsellers, ebay, google] = await Promise.all([
        authedFetch(`/api/product-create/search-internal?q=${encodeURIComponent(q)}`).then((r) => r.json()),
        authedFetch(`/api/product-create/search-similar?q=${encodeURIComponent(q)}`).then((r) => r.json()),
        authedFetch(`/api/product-create/search-ebay?q=${encodeURIComponent(q)}`).then((r) => r.json()),
        authedFetch(`/api/product-create/search-google?q=${encodeURIComponent(q)}`).then((r) => r.json()),
      ]);
      setInternalResults(internal.products ?? []);
      setBestsellerResults(bestsellers.products ?? []);
      setEbayResults(ebay.items ?? []);
      if (google.error) setGoogleError(google.error);
      else setGoogleResults(google.results ?? []);
    } finally {
      setSearching(false);
    }
  }

  async function handleGenerate() {
    if (!current.name) {
      toast({ title: "Preencha o nome do produto primeiro", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const similarProducts = [
        ...bestsellerResults.map((p) => ({ name: p.name, brand: p.brand, price: p.price })),
        ...ebayResults.map((e) => ({ name: e.title, price: e.price })),
      ];
      const res = await authedFetch("/api/product-create/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: current.name, brand: current.brand, category: current.category,
          notes: current.notes, price: current.price, similarProducts,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCurrent((c) => ({
        ...c,
        name: data.suggestedTitle || c.name,
        ai_description: data.description,
        ai_triggers: data.triggers,
        ai_image_prompts: data.imagePrompts,
      }));
      if (current.id) {
        await authedFetch(`/api/product-create/drafts/${current.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ai_description: data.description, ai_triggers: data.triggers, ai_image_prompts: data.imagePrompts }),
        });
      }
      toast({ title: "Conteúdo gerado", description: "Descrição, gatilhos e prompts de imagem prontos." });
    } catch (e) {
      toast({ title: "Erro ao gerar com IA", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Product Create</h1>
          <p className="text-muted-foreground text-sm">
            Monte a ficha de um produto (fotos, informações), pesquise produtos parecidos e deixe a IA gerar descrição,
            gatilhos comerciais e prompts de imagem.
          </p>
        </div>
        <Button variant="outline" onClick={() => setCurrent(emptyDraft())}>
          <Plus className="h-4 w-4 mr-2" /> Novo rascunho
        </Button>
      </div>

      <ProductCreateTabs />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Draft list / internal search */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Seus rascunhos</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar (ex: Ácido Glicólico)"
                value={draftSearch}
                onChange={(e) => { setDraftSearch(e.target.value); loadDrafts(e.target.value); }}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-y-auto">
              {drafts.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhum rascunho ainda</p>}
              {drafts.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setCurrent({ ...d, price: d.price ?? "", images: d.images ?? [], ai_triggers: d.ai_triggers ?? [], ai_image_prompts: d.ai_image_prompts ?? [] })}
                  className={`w-full flex items-center gap-2 p-3 border-b last:border-0 text-left hover:bg-muted/30 ${current.id === d.id ? "bg-accent" : ""}`}
                >
                  {d.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.images[0]} alt="" className="h-9 w-9 rounded object-cover shrink-0 bg-muted" />
                  ) : (
                    <div className="h-9 w-9 rounded shrink-0 bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.name || "(sem nome)"}</p>
                    <p className="text-xs text-muted-foreground truncate">{d.brand}</p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Editor */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Informações do produto</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome do produto</Label>
                  <Input value={current.name ?? ""} onChange={(e) => setCurrent((c) => ({ ...c, name: e.target.value }))} placeholder="Ex: Ácido Glicólico 10% Sérum Facial" />
                </div>
                <div>
                  <Label>Marca</Label>
                  <Input value={current.brand ?? ""} onChange={(e) => setCurrent((c) => ({ ...c, brand: e.target.value }))} />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Input value={current.category ?? ""} onChange={(e) => setCurrent((c) => ({ ...c, category: e.target.value }))} />
                </div>
                <div>
                  <Label>Preço</Label>
                  <Input type="number" step="0.01" value={current.price ?? ""} onChange={(e) => setCurrent((c) => ({ ...c, price: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Informações / ingredientes / notas</Label>
                <Textarea rows={4} value={current.notes ?? ""} onChange={(e) => setCurrent((c) => ({ ...c, notes: e.target.value }))} placeholder="Cole aqui tudo que você já tem: ingredientes, modo de uso, características..." />
              </div>

              <div>
                <Label>Fotos</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {current.images.map((url) => (
                    <div key={url} className="relative h-20 w-20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover rounded border" />
                      <button type="button" onClick={() => removeImage(url)} className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <label className="h-20 w-20 border border-dashed rounded flex items-center justify-center cursor-pointer text-muted-foreground hover:border-muted-foreground/50">
                    {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                    <input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && handleUploadPhotos(e.target.files)} disabled={uploading} />
                  </label>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar rascunho
                </Button>
                {current.id && (
                  <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(current.id)}>
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Similar products search */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Buscar produtos parecidos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Termo de busca (padrão: nome do produto)"
                  value={similarQuery}
                  onChange={(e) => setSimilarQuery(e.target.value)}
                />
                <Button onClick={handleSearchSimilar} disabled={searching}>
                  {searching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  Buscar
                </Button>
              </div>

              <Tabs defaultValue="bestsellers">
                <TabsList>
                  <TabsTrigger value="bestsellers">Nosso catálogo (mais vendidos)</TabsTrigger>
                  <TabsTrigger value="ebay">eBay</TabsTrigger>
                  <TabsTrigger value="google">Google</TabsTrigger>
                </TabsList>

                <TabsContent value="bestsellers" className="space-y-2">
                  {bestsellerResults.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhum resultado ainda — busque acima.</p>}
                  {bestsellerResults.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 border rounded-lg p-2">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.brand}</p>
                      </div>
                      {typeof p.qty === "number" && (
                        <Badge variant="secondary" className="shrink-0"><TrendingUp className="h-3 w-3 mr-1" />{p.qty} vendidos</Badge>
                      )}
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="ebay" className="space-y-2">
                  {ebayResults.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhum resultado ainda — busque acima.</p>}
                  {ebayResults.map((item) => (
                    <a key={item.itemId} href={item.itemWebUrl ?? undefined} target="_blank" rel="noreferrer" className="flex items-center gap-3 border rounded-lg p-2 hover:bg-muted/30">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt="" className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                      </div>
                      {item.price !== null && <span className="text-sm font-semibold">${item.price.toFixed(2)}</span>}
                    </a>
                  ))}
                </TabsContent>

                <TabsContent value="google" className="space-y-2">
                  {googleError && <p className="text-sm text-destructive py-4 text-center">{googleError}</p>}
                  {!googleError && googleResults.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhum resultado ainda — busque acima.</p>}
                  {googleResults.map((r) => (
                    <a key={r.link} href={r.link} target="_blank" rel="noreferrer" className="flex items-center gap-3 border rounded-lg p-2 hover:bg-muted/30">
                      {r.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.thumbnailUrl} alt="" className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.snippet}</p>
                      </div>
                    </a>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* AI generation */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Gerar com IA</CardTitle>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Gerar descrição, gatilhos e prompts
              </Button>
            </CardHeader>
            {(current.ai_description || current.ai_triggers.length > 0) && (
              <CardContent className="space-y-4">
                {current.ai_description && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label>Descrição</Label>
                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard(current.ai_description!)}>Copiar</Button>
                    </div>
                    <Textarea readOnly rows={6} value={current.ai_description} />
                  </div>
                )}
                {current.ai_triggers.length > 0 && (
                  <div>
                    <Label>Gatilhos comerciais</Label>
                    <ul className="list-disc list-inside text-sm space-y-1 mt-1">
                      {current.ai_triggers.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </div>
                )}
                {current.ai_image_prompts.length > 0 && (
                  <div>
                    <Label>Prompts de imagem (cole em uma IA de imagem)</Label>
                    <div className="space-y-2 mt-1">
                      {current.ai_image_prompts.map((p, i) => (
                        <div key={i} className="flex items-start gap-2 border rounded-lg p-2">
                          <p className="text-sm flex-1">{p}</p>
                          <Button size="sm" variant="ghost" onClick={() => copyToClipboard(p)}>Copiar</Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Publish */}
          {current.id && (
            <Card>
              <CardHeader><CardTitle className="text-base">Publicar</CardTitle></CardHeader>
              <CardContent className="flex gap-3">
                <Button variant="outline" onClick={() => setPublishEbayOpen(true)}>
                  <Send className="h-4 w-4 mr-2" /> Publicar no eBay
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {current.id && (
        <>
          <PublishToEbayDialog
            draft={{ name: current.name ?? "", ai_description: current.ai_description, price: current.price, images: current.images }}
            open={publishEbayOpen}
            onOpenChange={setPublishEbayOpen}
          />
        </>
      )}
    </div>
  );
}
