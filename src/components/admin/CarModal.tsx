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
  X as XIcon,
  Copy,
} from "lucide-react";
import { STORE_CATEGORY_OPTIONS } from "@/lib/categories";
import { RIBBON_COLOR_OPTIONS, getRibbonClassName } from "@/lib/ribbon";
import { compressImage } from "@/lib/image-compress";
import { isVideoUrl } from "@/lib/media-url";

const MAX_VIDEO_MB = 25;

const TRANSMISSION_OPTIONS = ["Automatic", "Manual"];
const FUEL_TYPE_OPTIONS = ["Gasoline", "Hybrid", "Electric", "Diesel"];

type Props = {
  car: Record<string, unknown> | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void; // refresh the list after save/delete/store change
};

export default function CarModal({ car, open, onClose, onChanged }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [featuresText, setFeaturesText] = useState("");
  // Set by "Duplicar Carro": the form is pre-filled from an existing car but must be
  // treated as a brand-new one (isNew), since VIN/Placa are unique in the DB and were
  // cleared for the user to fill in before creating.
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    setForm(car ? { ...car } : {});
    setFeaturesText(Array.isArray(car?.features) ? (car!.features as string[]).join(", ") : "");
    setConfirmDelete(false);
    setDuplicating(false);
  }, [car]);

  if (!car) return null;

  const isNew = !car.id || duplicating;
  const id = duplicating ? "" : (car.id as string) || "";
  const set = (field: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));
  const v = (field: string) => (form[field] ?? "") as string;
  const inStore = !!form.store_visible;
  const displayName =
    v("name") || [v("year"), v("make"), v("model")].filter(Boolean).join(" ") || "";

  function handleDuplicate() {
    const { id: _omit, ...rest } = form;
    setForm({
      ...rest,
      name: `${displayName} (Copy)`,
      vin: "",
      license_plate: null,
      store_visible: false,
    });
    setDuplicating(true);
    setConfirmDelete(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { id: _omit, ...payload } = form;
      // Auto-compose the display name from year/make/model when left blank.
      if (!String(payload.name || "").trim()) {
        payload.name = [payload.year, payload.make, payload.model].filter(Boolean).join(" ");
      }
      payload.features = featuresText
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);
      for (const numField of ["year", "mileage", "seats", "doors", "min_driver_age"]) {
        if (payload[numField] === "" || payload[numField] == null) {
          if (numField === "min_driver_age") payload[numField] = 18;
          else payload[numField] = null;
        } else {
          payload[numField] = Number(payload[numField]);
        }
      }
      // license_plate has a UNIQUE index — an empty string ("" from a blank input) is a
      // real, non-null value there, so a second car left blank collides with the first
      // and fails to save. Normalize blank to null, which the unique index allows to repeat.
      if (payload.license_plate === "") payload.license_plate = null;
      const { error } = isNew
        ? await supabase.from("products").insert(payload as unknown as TablesInsert<"products">)
        : await supabase
            .from("products")
            .update(payload as unknown as TablesUpdate<"products">)
            .eq("id", id);
      if (error) throw error;
      toast({ title: "Salvo!", description: isNew ? "Carro criado com sucesso." : "Carro atualizado com sucesso." });
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
      toast({ title: "Excluído", description: "Carro removido da frota." });
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
          ? "O carro agora aparece na loja online."
          : "O carro não aparece mais na loja.",
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

  // ---- Store categories (vehicle class, multi-select) ----
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

  function textField(field: string, label: string, placeholder?: string) {
    return (
      <div>
        <Label className="text-xs">{label}</Label>
        <Input value={v(field)} onChange={(e) => set(field, e.target.value)} placeholder={placeholder} />
      </div>
    );
  }

  function numberField(field: string, label: string, placeholder?: string) {
    return (
      <div>
        <Label className="text-xs">{label}</Label>
        <Input
          type="number"
          value={v(field)}
          onChange={(e) => set(field, e.target.value)}
          placeholder={placeholder}
        />
      </div>
    );
  }

  function selectField(field: string, label: string, options: string[]) {
    return (
      <div>
        <Label className="text-xs">{label}</Label>
        <Select value={v(field) || "none"} onValueChange={(value) => set(field, value === "none" ? "" : value)}>
          <SelectTrigger>
            <SelectValue placeholder={`Selecione`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">—</SelectItem>
            {options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl lg:max-w-5xl xl:max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {duplicating ? displayName || "Novo Carro" : isNew ? "Novo Carro" : displayName || "Carro"}
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
          {/* ── Left column ── */}
          <div className="space-y-6">
          {/* Photos: cover + gallery — first thing shown */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Fotos do carro</h3>
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

          {/* Vehicle details */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Detalhes do veículo</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {textField("make", "Marca (Make)", "Toyota")}
              {textField("model", "Modelo", "Corolla")}
              {numberField("year", "Ano", "2024")}
              {textField("color", "Cor", "Prata")}
              {textField("vin", "VIN")}
              {textField("license_plate", "Placa")}
              {numberField("mileage", "Quilometragem (mi)")}
              {selectField("transmission", "Câmbio", TRANSMISSION_OPTIONS)}
              {selectField("fuel_type", "Combustível", FUEL_TYPE_OPTIONS)}
              {numberField("seats", "Assentos")}
              {numberField("doors", "Portas")}
              {textField("pickup_city", "Cidade de retirada", "Miami, FL")}
              {numberField("min_driver_age", "Idade mínima do motorista", "18")}
            </div>
            <div className="mt-3">
              <Label className="text-xs">Nome de exibição (opcional)</Label>
              <Input
                value={v("name")}
                onChange={(e) => set("name", e.target.value)}
                placeholder={displayName || "Gerado automaticamente: Ano Marca Modelo"}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Deixe em branco para usar &quot;Ano Marca Modelo&quot; automaticamente.
              </p>
            </div>
            <div className="mt-3">
              <Label className="text-xs">Comodidades (separadas por vírgula)</Label>
              <Input
                value={featuresText}
                onChange={(e) => setFeaturesText(e.target.value)}
                placeholder="GPS, Bluetooth, Backup Camera, Apple CarPlay"
              />
            </div>
          </div>

          {/* Fita (ribbon banner over the car image) */}
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
                  placeholder="Ex: Most Popular"
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
                <Label className="text-xs">Categoria do veículo</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal">
                      <span className="truncate">
                        {categories.length === 0
                          ? "Selecione a categoria"
                          : `${categories.length} selecionada${categories.length > 1 ? "s" : ""}`}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64 bg-popover">
                    <DropdownMenuLabel>Categorias da loja</DropdownMenuLabel>
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
                ? "Crie o carro primeiro (botão Criar Carro abaixo) para depois poder enviá-lo à loja."
                : "Carros \"na loja\" aparecem no site público. Selecione a(s) categoria(s) (Compact, Big Van, Luxe, Sport, Special Offers) onde o carro será exibido."}
            </p>
          </div>

          {/* Diária */}
          <div className="rounded-lg border p-4 space-y-2">
            <h3 className="text-sm font-semibold">Diária</h3>
            <div className="flex flex-wrap gap-4">
              <div className="w-32">
                <Label className="text-xs">Valor da diária</Label>
                <CurrencyInput
                  value={v("daily_rate")}
                  onChange={(e) => set("daily_rate", e.target.value)}
                />
              </div>
              <div className="w-32">
                <Label className="text-xs">Diária promocional</Label>
                <CurrencyInput
                  value={v("discounted_daily_rate")}
                  onChange={(e) => set("discounted_daily_rate", e.target.value)}
                  placeholder="45.00"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Diária promocional (opcional): quando preenchida e menor que a diária normal,
              a loja mostra o valor original riscado e esse valor em destaque. Deixe em
              branco para remover a promoção.
            </p>
          </div>

          {/* Descrição */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Descrição</h3>
            <Textarea
              value={v("description")}
              onChange={(e) => set("description", e.target.value)}
              className="min-h-[100px]"
              placeholder="Descreva o veículo para o cliente..."
            />
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
                <Copy className="mr-2 h-4 w-4" /> Duplicar Carro
              </Button>
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmDelete(true)}
                disabled={busy || saving}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Excluir carro
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
              {isNew ? "Criar Carro" : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
