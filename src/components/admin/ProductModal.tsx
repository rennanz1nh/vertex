import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import {
  Save,
  Trash2,
  Store,
  StoreIcon,
  Upload,
  Image as ImageIcon,
  Video as VideoIcon,
  Loader2,
  Check,
  Plus,
  ExternalLink,
  X as XIcon,
  Copy,
} from "lucide-react";
import { STORE_CATEGORY_OPTIONS } from "@/lib/categories";
import { RIBBON_COLOR_OPTIONS, getRibbonClassName } from "@/lib/ribbon";
import { compressImage } from "@/lib/image-compress";
import { isVideoUrl } from "@/lib/media-url";

const MAX_VIDEO_MB = 25;

type Field = { field: string; label: string; long?: boolean; type?: "text" | "link" | "currency" };

type DetailItem = { label: string; value: string };

// Preset labels for the [+] extra-info menu.
const DETAIL_PRESETS = [
  { key: "ad", label: "Anúncio Descrição" },
  { key: "howto", label: "How to Use" },
  { key: "other", label: "Outro" },
];

// Field groups shown in the modal (mirrors the products table columns). Rendered in a
// fixed order below: Fotos, Informações básicas, Loja online, Preços, Custos e Frete,
// Descrição, Informações adicionais, Drive Link (see the modal body for the full order).
const BASIC_INFO_GROUP: { title: string; fields: Field[] } = {
  title: "Informações básicas",
  fields: [
    { field: "Produto Nome", label: "Nome do produto" },
    { field: "Marca", label: "Marca" },
    { field: "Linha do produto", label: "Linha do produto" },
    { field: "SKU", label: "SKU" },
    { field: "ASIN", label: "ASIN" },
    { field: "UPC", label: "UPC" },
    { field: "EAN", label: "EAN" },
    { field: "Volume", label: "Volume" },
    { field: "Quantidade no Estoque", label: "Quantidade no Estoque" },
  ],
};

const GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: "Descrição",
    fields: [
      {
        field: "Informacoes dos produtos / descricao",
        label: "Informações / descrição",
        long: true,
      },
    ],
  },
];

type Props = {
  product: Record<string, unknown> | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void; // refresh the list after save/delete/store change
};

export default function ProductModal({ product, open, onClose, onChanged }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Set by "Duplicar Produto": the form is pre-filled from an existing product but must be
  // treated as a brand-new one (isNew), since SKU/ASIN/UPC/EAN are unique in the DB and were
  // cleared for the user to fill in before creating.
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    setForm(product ? { ...product } : {});
    setConfirmDelete(false);
    setDuplicating(false);
  }, [product]);

  if (!product) return null;

  const isNew = !product.id || duplicating;
  const id = duplicating ? "" : (product.id as string) || "";
  const set = (field: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));
  const v = (field: string) => (form[field] ?? "") as string;
  const inStore = !!form.store_visible;

  function handleDuplicate() {
    const { id: _omit, ...rest } = form;
    setForm({
      ...rest,
      "Produto Nome": `${v("Produto Nome")} (Cópia)`,
      SKU: "",
      ASIN: null,
      UPC: "",
      EAN: "",
      store_visible: false,
    });
    setDuplicating(true);
    setConfirmDelete(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      // exclude relational/computed fields, send the editable ones
      const { id: _omit, ...payload } = form;
      // ASIN has a UNIQUE index in the DB — an empty string ("" from a blank input) is a
      // real, non-null value there, so a second product left blank collides with the first
      // and fails to save. Normalize blank to null, which the unique index allows to repeat.
      if (payload.ASIN === "") payload.ASIN = null;
      const { error } = isNew
        ? await supabase.from("products").insert(payload as unknown as TablesInsert<"products">)
        : await supabase
            .from("products")
            .update(payload as unknown as TablesUpdate<"products">)
            .eq("id", id);
      if (error) throw error;
      toast({ title: "Salvo!", description: isNew ? "Produto criado com sucesso." : "Produto atualizado com sucesso." });
      onChanged();
      onClose();
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao salvar", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Excluído", description: "Produto removido do catálogo." });
      onChanged();
      onClose();
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao excluir", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function setStoreVisibility(visible: boolean) {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { store_visible: visible };
      // when sending to the store, persist the chosen categories too
      if (visible) payload.store_categories = categories;
      const { error } = await supabase
        .from("products")
        .update(payload as unknown as TablesUpdate<"products">)
        .eq("id", id);
      if (error) throw error;
      set("store_visible", visible);
      toast({
        title: visible ? "Enviado à loja" : "Removido da loja",
        description: visible
          ? "O produto agora aparece na loja online."
          : "O produto não aparece mais na loja.",
      });
      onChanged();
    } catch (e) {
      console.error(e);
      toast({ title: "Erro", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const gallery: string[] = Array.isArray(form.gallery_urls)
    ? (form.gallery_urls as string[])
    : [];

  // Compress (medium quality) + upload one image file, returning its public URL.
  // Videos skip compression entirely — uploaded as-is (gallery only, never the cover).
  async function uploadToStorage(file: File): Promise<string> {
    const isVideo = file.type.startsWith("video/");
    if (isVideo && file.size > MAX_VIDEO_MB * 1024 * 1024) {
      throw new Error(`Envie um vídeo de até ${MAX_VIDEO_MB}MB.`);
    }
    const blob = isVideo ? file : await compressImage(file);
    const ext = isVideo ? (file.name.split(".").pop() || "mp4") : "jpg";
    const path = `${id || "new"}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const { error } = await supabase.storage
      .from("vertex-product-images")
      .upload(path, blob, { upsert: true, contentType: isVideo ? file.type : "image/jpeg" });
    if (error) throw error;
    return supabase.storage.from("vertex-product-images").getPublicUrl(path).data.publicUrl;
  }

  // Primary/cover image — applied to the form, persisted on Save.
  async function handleCoverUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadToStorage(file);
      set("image_url", url);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro no upload", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  // Add one or more photos to the gallery — applied to the form, saved on Save.
  async function handleGalleryAdd(files: FileList) {
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) urls.push(await uploadToStorage(file));
      setForm((prev) => ({
        ...prev,
        gallery_urls: [
          ...(Array.isArray(prev.gallery_urls) ? (prev.gallery_urls as string[]) : []),
          ...urls,
        ],
      }));
    } catch (e) {
      console.error(e);
      toast({ title: "Erro no upload", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  function removeGalleryImage(url: string) {
    set("gallery_urls", gallery.filter((g) => g !== url));
  }

  // Promote a gallery image to cover; the old cover moves into the gallery.
  function makeCover(url: string) {
    const oldCover = (form.image_url as string) || "";
    const next = gallery.filter((g) => g !== url);
    if (oldCover) next.unshift(oldCover);
    setForm((prev) => ({ ...prev, image_url: url, gallery_urls: next }));
  }

  // ---- Extra info sections (Anúncio Descrição / How to Use / Outro) ----
  const details: DetailItem[] = Array.isArray(form.details)
    ? (form.details as DetailItem[])
    : [];

  function addDetail(label: string) {
    setForm((prev) => ({
      ...prev,
      details: [
        ...(Array.isArray(prev.details) ? (prev.details as DetailItem[]) : []),
        { label, value: "" },
      ],
    }));
  }

  function updateDetail(index: number, key: "label" | "value", val: string) {
    setForm((prev) => {
      const list = Array.isArray(prev.details) ? [...(prev.details as DetailItem[])] : [];
      list[index] = { ...list[index], [key]: val };
      return { ...prev, details: list };
    });
  }

  function removeDetail(index: number) {
    setForm((prev) => {
      const list = Array.isArray(prev.details) ? [...(prev.details as DetailItem[])] : [];
      list.splice(index, 1);
      return { ...prev, details: list };
    });
  }

  // ---- Store categories (multi-select) ----
  const categories: string[] = Array.isArray(form.store_categories)
    ? (form.store_categories as string[])
    : [];

  function toggleCategory(value: string) {
    setForm((prev) => {
      const cur = Array.isArray(prev.store_categories)
        ? (prev.store_categories as string[])
        : [];
      const next = cur.includes(value)
        ? cur.filter((c) => c !== value)
        : [...cur, value];
      return { ...prev, store_categories: next };
    });
  }

  function renderField(f: Field) {
    return (
      <div key={f.field} className={f.long || f.type === "link" ? "col-span-full" : ""}>
        <Label className="text-xs">{f.label}</Label>
        {f.long ? (
          <Textarea
            value={v(f.field)}
            onChange={(e) => set(f.field, e.target.value)}
            className="min-h-[100px]"
          />
        ) : f.type === "link" ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={v(f.field)}
              onChange={(e) => set(f.field, e.target.value)}
              placeholder="https://drive.google.com/..."
            />
            <a
              href={v(f.field) || undefined}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir link"
              aria-disabled={!v(f.field)}
              className={`shrink-0 ${
                v(f.field)
                  ? "text-blue-600 hover:text-blue-800"
                  : "text-gray-300 pointer-events-none"
              }`}
            >
              <ExternalLink className="h-5 w-5" />
            </a>
          </div>
        ) : f.type === "currency" ? (
          <CurrencyInput value={v(f.field)} onChange={(e) => set(f.field, e.target.value)} />
        ) : (
          <Input value={v(f.field)} onChange={(e) => set(f.field, e.target.value)} />
        )}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl lg:max-w-5xl xl:max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {duplicating ? v("Produto Nome") || "Novo Produto" : isNew ? "Novo Produto" : v("Produto Nome") || "Produto"}
            {duplicating && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                <Copy className="h-3 w-3" /> Duplicado — revise antes de criar
              </span>
            )}
            {inStore && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                <Store className="h-3 w-3" /> Na loja
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Two-column layout: left = Fotos, Fita, Informações básicas;
            right = Loja, Preços, Custos/Descrição, Informações adicionais, Drive Link.
            Collapses to a single column below lg. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
          {/* ── Left column ── */}
          <div className="space-y-6">
          {/* Photos: cover + gallery — first thing shown */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Fotos do produto</h3>
              {uploading && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Enviando...
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {/* Cover */}
              <div className="relative w-24 h-24 rounded overflow-hidden bg-muted flex items-center justify-center group">
                {v("image_url") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v("image_url")} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                )}
                <span className="absolute top-0 left-0 bg-black/70 text-white text-[10px] px-1.5 py-0.5">
                  Capa
                </span>
                <label className="absolute inset-0 cursor-pointer bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Upload className="h-5 w-5 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleCoverUpload(f);
                    }}
                  />
                </label>
              </div>

              {/* Gallery thumbnails */}
              {gallery.map((url) => {
                const isVideo = isVideoUrl(url);
                return (
                  <div
                    key={url}
                    className="relative w-24 h-24 rounded overflow-hidden bg-muted group"
                  >
                    {isVideo ? (
                      <video src={url} className="w-full h-full object-cover" muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    )}
                    {isVideo && (
                      <span className="absolute top-0.5 left-0.5 bg-black/70 text-white rounded-full p-1">
                        <VideoIcon className="h-3 w-3" />
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeGalleryImage(url)}
                      title={isVideo ? "Remover vídeo" : "Remover foto"}
                      className="absolute top-0.5 right-0.5 bg-black/70 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                    {!isVideo && (
                      <button
                        type="button"
                        onClick={() => makeCover(url)}
                        title="Tornar capa"
                        className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Tornar capa
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Add more [+] */}
              <label className="w-24 h-24 rounded border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 cursor-pointer text-muted-foreground hover:border-gray-400 hover:text-foreground transition-colors">
                <Plus className="h-6 w-6" />
                <span className="text-[10px]">Adicionar</span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) handleGalleryAdd(e.target.files);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              As fotos são otimizadas automaticamente (qualidade média). A capa precisa ser uma
              foto; vídeos (até {MAX_VIDEO_MB}MB, mp4/webm) só podem ser adicionados na galeria.
              As alterações entram na loja ao clicar em <strong>Salvar</strong>.
            </p>
          </div>

          {/* Informações básicas */}
          <div>
            <h3 className="text-sm font-semibold mb-2">{BASIC_INFO_GROUP.title}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {BASIC_INFO_GROUP.fields.map(renderField)}
            </div>
          </div>

          {/* Fita (ribbon banner over the product image) */}
          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-semibold">Fita</h3>
            <div className="grid sm:grid-cols-2 gap-3 items-end">
              <div>
                <Label className="text-xs">Cor da fita</Label>
                <Select
                  value={v("ribbon_color") || "none"}
                  onValueChange={(value) => set("ribbon_color", value === "none" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem fita" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem fita</SelectItem>
                    {RIBBON_COLOR_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Texto da fita</Label>
                <Input
                  value={v("ribbon_text")}
                  onChange={(e) => set("ribbon_text", e.target.value)}
                  placeholder="Ex: Best Seller's"
                />
              </div>
            </div>
            {v("ribbon_text") && (
              <span
                className={`inline-block text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide ${getRibbonClassName(v("ribbon_color"))}`}
              >
                {v("ribbon_text")}
              </span>
            )}
          </div>
          </div>
          {/* ── End left column ── */}

          {/* ── Right column ── */}
          <div className="space-y-6">
          {/* Store controls */}
          <div className="rounded-lg border p-4 space-y-3 bg-accent/30">
            <div className="flex items-center gap-2 font-semibold">
              <StoreIcon className="h-4 w-4" /> Loja online
            </div>
            <div className="grid sm:grid-cols-2 gap-3 items-start">
              <div>
                <Label className="text-xs">Categorias na loja</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal">
                      <span className="truncate">
                        {categories.length === 0
                          ? "Selecione as categorias"
                          : `${categories.length} selecionada${categories.length > 1 ? "s" : ""}`}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64 bg-popover">
                    <DropdownMenuLabel>Coleções da loja</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {STORE_CATEGORY_OPTIONS.map((o) => (
                      <DropdownMenuCheckboxItem
                        key={o.value}
                        checked={categories.includes(o.value)}
                        onCheckedChange={() => toggleCategory(o.value)}
                        onSelect={(e) => e.preventDefault()}
                      >
                        {o.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {categories.map((c) => {
                      const opt = STORE_CATEGORY_OPTIONS.find((o) => o.value === c);
                      return (
                        <span
                          key={c}
                          className="inline-flex items-center gap-1 bg-black text-white text-xs px-2 py-0.5 rounded-full"
                        >
                          {opt?.label || c}
                          <button
                            type="button"
                            onClick={() => toggleCategory(c)}
                            className="hover:text-destructive"
                            title="Remover"
                          >
                            <XIcon className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex gap-2 sm:pt-5">
                {!inStore ? (
                  <Button onClick={() => setStoreVisibility(true)} disabled={busy || isNew} className="flex-1">
                    <Store className="mr-2 h-4 w-4" /> Enviar à loja
                  </Button>
                ) : (
                  <Button
                    onClick={() => setStoreVisibility(false)}
                    disabled={busy || isNew}
                    variant="outline"
                    className="flex-1"
                  >
                    <XIcon className="mr-2 h-4 w-4" /> Remover da loja
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {isNew
                ? "Crie o produto primeiro (botão Criar Produto abaixo) para depois poder enviá-lo à loja."
                : "Produtos \"na loja\" aparecem no site público. Selecione uma ou mais coleções (Women, Men, Sale, etc.) onde o produto será exibido."}
            </p>
          </div>

          {/* Preços (Online) */}
          <div className="rounded-lg border p-4 space-y-2">
            <h3 className="text-sm font-semibold">Preços</h3>
            <div className="flex flex-wrap gap-4">
              <div className="w-32">
                <Label className="text-xs">Valor de venda</Label>
                <CurrencyInput
                  value={v("Valor de venda (Online)")}
                  onChange={(e) => set("Valor de venda (Online)", e.target.value)}
                />
              </div>
              <div className="w-32">
                <Label className="text-xs">Preço Promocional</Label>
                <CurrencyInput
                  value={v("sale_price")}
                  onChange={(e) => set("sale_price", e.target.value)}
                  placeholder="14.00"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Preço Promocional (opcional): quando preenchido e menor que o Valor de venda,
              a loja mostra o preço original riscado e esse valor em destaque — e é o valor
              realmente cobrado no checkout. Deixe em branco para remover a promoção.
            </p>
          </div>

          {/* Remaining groups (Custos, Descrição) — stacked within the right column */}
          <div className="space-y-5">
            {GROUPS.map((group) => {
              const wide = group.fields.some((f) => f.long);
              return (
                <div key={group.title}>
                  <h3 className="text-sm font-semibold mb-2">{group.title}</h3>
                  <div className={`grid gap-3 ${wide ? "grid-cols-1" : "grid-cols-2"}`}>
                    {group.fields.map(renderField)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Extra info sections (dynamic) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Informações adicionais</h3>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="mr-1 h-4 w-4" /> Adicionar campo
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {DETAIL_PRESETS.map((p) => (
                    <DropdownMenuItem
                      key={p.key}
                      onSelect={() => addDetail(p.key === "other" ? "" : p.label)}
                    >
                      {p.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {details.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum campo extra. Use &quot;Adicionar campo&quot; para incluir Anúncio Descrição,
                How to Use ou outro.
              </p>
            ) : (
              <div className="space-y-3">
                {details.map((d, i) => (
                  <div key={i} className="rounded-md border p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Input
                        value={d.label}
                        onChange={(e) => updateDetail(i, "label", e.target.value)}
                        placeholder="Título do campo (ex: How to Use)"
                        className="h-8 font-medium"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={() => removeDetail(i)}
                        title="Remover campo"
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      value={d.value}
                      onChange={(e) => updateDetail(i, "value", e.target.value)}
                      className="min-h-[80px]"
                      placeholder="Conteúdo..."
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Drive Link (detalhes) — last field in the modal */}
          <div>
            <Label className="text-xs text-blue-600">Drive Link (detalhes)</Label>
            <div className="flex items-center gap-1.5">
              <Input
                value={v("drive_link")}
                onChange={(e) => set("drive_link", e.target.value)}
                placeholder="https://drive.google.com/..."
                className="text-blue-600 placeholder:text-blue-300"
              />
              <a
                href={v("drive_link") || undefined}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir link"
                aria-disabled={!v("drive_link")}
                className={`shrink-0 ${
                  v("drive_link")
                    ? "text-blue-600 hover:text-blue-800"
                    : "text-gray-300 pointer-events-none"
                }`}
              >
                <ExternalLink className="h-5 w-5" />
              </a>
            </div>
          </div>
          </div>
          {/* ── End right column ── */}
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t mt-2">
          {isNew ? (
            <div />
          ) : !confirmDelete ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleDuplicate}
                disabled={busy || saving}
              >
                <Copy className="mr-2 h-4 w-4" /> Duplicar Produto
              </Button>
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmDelete(true)}
                disabled={busy || saving}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Excluir produto
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Confirmar exclusão?</span>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Sim
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                Não
              </Button>
            </div>
          )}

          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Fechar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isNew ? "Criar Produto" : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
