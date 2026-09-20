"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Trash2, Upload, Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import { RIBBON_COLOR_OPTIONS } from "@/lib/ribbon";
import { BANNER_PAGE_OPTIONS, RIBBON_POSITION_OPTIONS, type Banner } from "@/lib/banners";

const MAX_VIDEO_MB = 25;

type FormState = Omit<Banner, "id" | "created_at" | "updated_at">;

const EMPTY_FORM: FormState = {
  title: "",
  page: "home",
  placement: "hero",
  media_type: "image",
  media_url: "",
  link_url: null,
  overlay_text: null,
  subtitle_text: null,
  button_text: null,
  duration_seconds: 5,
  ribbon_text: null,
  ribbon_color: null,
  ribbon_position: "top-right",
  active: true,
  sort_order: 0,
};

type Props = {
  banner: Banner | null; // null = creating a new banner
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  /** Placement to pre-select when creating a new banner (ignored when editing). */
  defaultPlacement?: FormState["placement"];
};

export default function BannerModal({ banner, open, onClose, onChanged, defaultPlacement }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setForm(banner ? { ...EMPTY_FORM, ...banner } : { ...EMPTY_FORM, placement: defaultPlacement ?? EMPTY_FORM.placement });
    setConfirmDelete(false);
  }, [banner, open, defaultPlacement]);

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  async function handleUpload(file: File) {
    const isVideo = file.type.startsWith("video/");
    if (isVideo && file.size > MAX_VIDEO_MB * 1024 * 1024) {
      toast({ title: "Vídeo muito grande", description: `Envie um vídeo de até ${MAX_VIDEO_MB}MB.`, variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      // Banners run full-bleed at the top of the page, so uploaded images are kept
      // at their original resolution/quality — no client-side downscale or recompression.
      const blob = file;
      const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await supabase.storage
        .from("vertex-banner-media")
        .upload(path, blob, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("vertex-banner-media").getPublicUrl(path);
      set("media_url", data.publicUrl);
      set("media_type", isVideo ? "video" : "image");
    } catch (e) {
      toast({ title: "Erro no upload", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast({ title: "Nome obrigatório", description: "Dê um nome interno para identificar este banner.", variant: "destructive" });
      return;
    }
    if (!form.media_url) {
      toast({ title: "Mídia obrigatória", description: "Envie uma imagem ou vídeo para o banner.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        link_url: form.link_url?.trim() || null,
        overlay_text: form.overlay_text?.trim() || null,
        subtitle_text: form.subtitle_text?.trim() || null,
        button_text: form.button_text?.trim() || null,
        ribbon_text: form.ribbon_text?.trim() || null,
        ribbon_color: form.ribbon_text?.trim() ? form.ribbon_color || "red" : null,
        updated_at: new Date().toISOString(),
      };
      const { error } = banner
        ? await supabase.from("banners").update(payload).eq("id", banner.id)
        : await supabase.from("banners").insert(payload);
      if (error) throw error;
      toast({ title: "Salvo!", description: "Banner salvo com sucesso." });
      onChanged();
      onClose();
    } catch (e) {
      toast({ title: "Erro ao salvar", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!banner) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("banners").delete().eq("id", banner.id);
      if (error) throw error;
      toast({ title: "Excluído", description: "Banner removido." });
      onChanged();
      onClose();
    } catch (e) {
      toast({ title: "Erro ao excluir", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {banner ? "Editar" : "Novo"} {form.placement === "popup" ? "Pop-up" : "Banner"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome interno</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex: Promoção de verão" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Página</Label>
              <Select value={form.page} onValueChange={(v) => set("page", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BANNER_PAGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Exibição</Label>
              <Select value={form.placement} onValueChange={(v) => set("placement", v as FormState["placement"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hero">Banner na página</SelectItem>
                  <SelectItem value="popup">Popup</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.page === "*" && form.placement === "hero" && (
            <p className="text-xs text-amber-600">
              &quot;Todas as páginas&quot; só funciona com exibição em Popup. Escolha uma página específica para um banner na página.
            </p>
          )}

          <div className="space-y-1.5">
            <Label>Imagem ou vídeo</Label>
            <div className="flex items-center gap-3">
              <div className="relative w-28 h-16 rounded overflow-hidden bg-muted flex items-center justify-center shrink-0 border">
                {form.media_url ? (
                  form.media_type === "video" ? (
                    <video src={form.media_url} className="w-full h-full object-cover" muted />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.media_url} alt="" className="w-full h-full object-cover" />
                  )
                ) : (
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <label className="flex-1">
                <div className="flex items-center justify-center gap-2 border rounded-md py-2 text-sm cursor-pointer hover:bg-muted transition-colors">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Enviando..." : "Enviar arquivo"}
                </div>
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <VideoIcon className="h-3 w-3" /> Vídeos até {MAX_VIDEO_MB}MB (mp4/webm recomendado).
            </p>
            <p className="text-xs text-muted-foreground">
              {form.placement === "popup"
                ? "Tamanho sugerido: 1000 × 800px (proporção 5:4). Qualquer tamanho enviado é recortado para caber nesse formato."
                : form.page === "home"
                  ? "Tamanho sugerido: 1600 × 345px (proporção 4.64:1) — faixa bem larga. Qualquer tamanho enviado é recortado para caber nesse formato, então o foco principal da foto deve ficar no centro."
                  : "Formato bem largo (a imagem é recortada para caber, focando o centro da foto)."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Link (opcional)</Label>
            <Input
              value={form.link_url ?? ""}
              onChange={(e) => set("link_url", e.target.value)}
              placeholder="https://... ou /products"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Título (opcional)</Label>
            <Input
              value={form.overlay_text ?? ""}
              onChange={(e) => set("overlay_text", e.target.value)}
              placeholder="Ex: Nova Coleção de Verão"
            />
          </div>

          {form.placement === "popup" && (
            <>
              <div className="space-y-1.5">
                <Label>Subtítulo (opcional)</Label>
                <Input
                  value={form.subtitle_text ?? ""}
                  onChange={(e) => set("subtitle_text", e.target.value)}
                  placeholder="Ex: Produtos selecionados com até 30% de desconto"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Texto do botão (opcional)</Label>
                <Input
                  value={form.button_text ?? ""}
                  onChange={(e) => set("button_text", e.target.value)}
                  placeholder="Comprar Agora"
                  disabled={!form.link_url?.trim()}
                />
              </div>
            </>
          )}

          {form.placement === "hero" && (
            <div className="space-y-1.5">
              <Label>Duração no carrossel</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={2}
                  max={30}
                  value={form.duration_seconds}
                  onChange={(e) => set("duration_seconds", Math.min(30, Math.max(2, Number(e.target.value) || 5)))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">segundos</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Quando houver mais de um banner ativo para a mesma página, eles giram automaticamente — cada um pelo tempo definido aqui.
              </p>
            </div>
          )}

          <div className="space-y-2 pt-2 border-t">
            <Label>Fita no canto (opcional)</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                value={form.ribbon_text ?? ""}
                onChange={(e) => set("ribbon_text", e.target.value)}
                placeholder="Ex: Promoção"
              />
              <Select
                value={form.ribbon_color || "red"}
                onValueChange={(v) => set("ribbon_color", v)}
                disabled={!form.ribbon_text}
              >
                <SelectTrigger><SelectValue placeholder="Cor" /></SelectTrigger>
                <SelectContent>
                  {RIBBON_COLOR_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!!form.ribbon_text && (
              <Select value={form.ribbon_position} onValueChange={(v) => set("ribbon_position", v as FormState["ribbon_position"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RIBBON_POSITION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
            <div>
              <Label className="font-semibold">Ativo</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Desative para esconder sem perder a configuração.</p>
            </div>
            <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} className="data-[state=checked]:bg-black" />
          </div>

          <div className="flex gap-2 pt-2">
            <Button className="flex-1 bg-black hover:bg-black/80 text-white" onClick={handleSave} disabled={saving || uploading}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? "Salvando..." : "Salvar"}
            </Button>
            {banner && (
              <Button
                variant={confirmDelete ? "destructive" : "outline"}
                onClick={() => (confirmDelete ? handleDelete() : setConfirmDelete(true))}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {confirmDelete ? "Confirmar exclusão" : ""}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
