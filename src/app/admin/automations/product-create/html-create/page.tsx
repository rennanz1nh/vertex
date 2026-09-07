"use client";

import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compress";
import {
  parseProductText, buildHTML, sectionLabel,
  type ParsedSection, type SectionImageState,
} from "@/lib/html-create-parser";
import { ProductCreateTabs } from "@/components/product-create/ProductCreateTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Code2, Copy, Download, ImagePlus, Loader2, X } from "lucide-react";

export default function HtmlCreatePage() {
  const { toast } = useToast();
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState(false);

  const [brand, setBrand] = useState("");
  const [productName, setProductName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [footerNote, setFooterNote] = useState("");
  const [sections, setSections] = useState<ParsedSection[]>([]);

  const [heroImage, setHeroImage] = useState<SectionImageState>({ imgOn: false, imgUrl: "" });
  const [sectionImages, setSectionImages] = useState<Record<string, SectionImageState>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const [tab, setTab] = useState<"preview" | "code">("preview");

  function handleParse() {
    if (!rawText.trim()) return;
    const result = parseProductText(rawText);
    setBrand(result.brand);
    setProductName(result.productName);
    setSubtitle(result.subtitle);
    setFooterNote(result.footerNote);
    setSections(result.sections);
    setSectionImages({});
    setHeroImage({ imgOn: false, imgUrl: "" });
    setParsed(true);
  }

  async function uploadImage(key: string, file: File, onDone: (url: string) => void) {
    setUploadingKey(key);
    try {
      const blob = await compressImage(file);
      const path = `product-create/html/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
      const { error } = await supabase.storage.from("vertex-product-images").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (error) throw error;
      const url = supabase.storage.from("vertex-product-images").getPublicUrl(path).data.publicUrl;
      onDone(url);
    } catch (e) {
      toast({ title: "Erro ao enviar imagem", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setUploadingKey(null);
    }
  }

  const footerL1 = [brand, productName].filter(Boolean).join(" — ").toUpperCase();

  const html = parsed
    ? buildHTML({ brand, productName, subtitle, sections, sectionImages, heroImage, footerL1, footerNote })
    : "";

  function copyCode() {
    navigator.clipboard.writeText(html);
    toast({ title: "Copiado!" });
  }

  function downloadCode() {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(productName || "produto").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function ImageToggleRow({
    label, keyName, state, onChange,
  }: {
    label: string; keyName: string; state: SectionImageState; onChange: (next: SectionImageState) => void;
  }) {
    const uploading = uploadingKey === keyName;
    return (
      <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{label}</span>
          <Switch
            checked={state.imgOn}
            onCheckedChange={(checked) => onChange({ ...state, imgOn: checked })}
          />
        </div>
        {state.imgOn && (
          <div className="flex items-center gap-2">
            {state.imgUrl ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={state.imgUrl} alt="" className="h-10 w-10 rounded object-cover border shrink-0" />
                <span className="text-xs text-muted-foreground truncate flex-1">Imagem adicionada</span>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => onChange({ ...state, imgUrl: "" })}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={uploading}
                onClick={() => fileInputs.current[keyName]?.click()}
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                Enviar imagem
              </Button>
            )}
            <input
              ref={(el) => { fileInputs.current[keyName] = el; }}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadImage(keyName, file, (url) => onChange({ ...state, imgUrl: url }));
                e.target.value = "";
              }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Code2 className="h-7 w-7" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">HTML Create</h1>
          <p className="text-muted-foreground text-sm">
            Cole o texto do produto — a ferramenta identifica os tópicos e gera o HTML da descrição, no padrão eBay/Amazon.
          </p>
        </div>
      </div>

      <ProductCreateTabs />

      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
        {/* Form panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Texto do produto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Cole o texto do produto — descrição, Benefits, Active Ingredients, How to Use / Directions, Recommended For, Ingredients (INCI), Weight & Dimensions, etc."
                className="min-h-[260px] font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                A ferramenta reconhece títulos como &quot;Description&quot;, &quot;Benefits&quot;, &quot;Active Ingredients&quot;,
                &quot;How to Use&quot; / &quot;Directions for Use&quot;, &quot;Recommended For&quot;, &quot;Ingredients&quot; e
                &quot;Weight &amp; Dimensions&quot; — em qualquer ordem, com ou sem os dois-pontos.
              </p>
              <Button className="w-full" onClick={handleParse}>Analisar Texto</Button>
            </CardContent>
          </Card>

          {parsed && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Título (confira / ajuste)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Marca</Label>
                    <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome do produto</Label>
                    <Input value={productName} onChange={(e) => setProductName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Subtítulo</Label>
                    <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Imagens</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <ImageToggleRow
                    label="Imagem no topo (hero)"
                    keyName="hero"
                    state={heroImage}
                    onChange={setHeroImage}
                  />
                  {sections.map((sec) => (
                    <ImageToggleRow
                      key={sec.key}
                      label={sectionLabel(sec)}
                      keyName={sec.key}
                      state={sectionImages[sec.key] ?? { imgOn: false, imgUrl: "" }}
                      onChange={(next) => setSectionImages((prev) => ({ ...prev, [sec.key]: next }))}
                    />
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Preview / code panel */}
        <Card className="h-fit">
          <CardContent className="p-0">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "preview" | "code")}>
              <div className="border-b px-4 pt-3">
                <TabsList>
                  <TabsTrigger value="preview">Pré-visualização</TabsTrigger>
                  <TabsTrigger value="code">Código HTML</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="preview" className="m-0">
                {parsed ? (
                  <iframe
                    srcDoc={`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:16px;font-family:Arial,Helvetica,sans-serif;background:#fff;}</style></head><body>${html}</body></html>`}
                    className="w-full border-0 bg-white"
                    style={{ height: "calc(100vh - 260px)", minHeight: 500 }}
                    title="Pré-visualização"
                  />
                ) : (
                  <div className="flex items-center justify-center text-center text-sm text-muted-foreground p-16" style={{ minHeight: 500 }}>
                    Cole o texto do produto e clique em &quot;Analisar Texto&quot; para começar.
                  </div>
                )}
              </TabsContent>
              <TabsContent value="code" className="m-0 p-4 space-y-3">
                <div className="flex gap-2">
                  <Button size="sm" className="gap-1.5" onClick={copyCode} disabled={!parsed}>
                    <Copy className="h-3.5 w-3.5" /> Copiar código
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={downloadCode} disabled={!parsed}>
                    <Download className="h-3.5 w-3.5" /> Baixar .html
                  </Button>
                </div>
                <pre className="bg-[#1c2b21] text-[#dfe9de] p-4 rounded-lg text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap break-words" style={{ maxHeight: "calc(100vh - 320px)" }}>
                  {html}
                </pre>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
