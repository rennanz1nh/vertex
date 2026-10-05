"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Link2,
  Plus,
  Trash2,
  GripVertical,
  ExternalLink,
  Loader2,
  Save,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Copy,
  ImageIcon,
  Palette,
  Sparkles,
  Type,
  Upload,
  X,
} from "lucide-react";
import { SettingsHeader } from "@/components/admin/SettingsHeader";
import { authedFetch } from "@/lib/admin-fetch";

function ImageUploadField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  hint?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await authedFetch("/api/admin/bio-links/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onChange(data.url);
    } catch (err: any) {
      setUploadError(err.message || "Falha no upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4" />
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
          <span className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-muted transition-colors">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Enviando..." : "Enviar imagem"}
          </span>
        </label>
        {value && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onChange(null)}
          >
            <X className="h-4 w-4 mr-1" />
            Remover
          </Button>
        )}
      </div>
      {value && (
        <div className="flex items-center gap-3 p-2 border rounded-lg bg-muted/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Preview" className="w-16 h-16 rounded object-cover" />
          <span className="text-xs text-muted-foreground truncate flex-1">{value}</span>
        </div>
      )}
      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
      {hint && !uploadError && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

type BioLink = {
  id: string;
  title: string;
  url: string;
  icon: string | null;
  thumbnail_url: string | null;
  description: string | null;
  button_color: string | null;
  button_text_color: string | null;
  position: number;
  enabled: boolean;
};

type BioSettings = {
  id: string;
  display_name: string;
  description: string | null;
  subtitle: string | null;
  avatar_url: string | null;
  background_color: string;
  background_image_url: string | null;
  text_color: string;
  accent_color: string | null;
  button_style: string;
  gradient_start: string | null;
  gradient_end: string | null;
  gradient_direction: string;
  button_shadow: string;
  button_animation: string;
  font_family: string;
  social_position: string;
};

const ICON_OPTIONS = [
  { value: "none", label: "Nenhum" },
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "website", label: "Website" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "twitter", label: "Twitter / X" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "map", label: "Mapa" },
  { value: "store", label: "Loja" },
  { value: "link", label: "Link genérico" },
];

const SHADOW_OPTIONS = [
  { value: "none", label: "Nenhuma" },
  { value: "soft", label: "Suave" },
  { value: "medium", label: "Média" },
  { value: "hard", label: "Forte" },
  { value: "neon", label: "Neon (Brilho)" },
  { value: "floating", label: "Flutuante" },
];

const ANIMATION_OPTIONS = [
  { value: "none", label: "Nenhuma" },
  { value: "fade-in", label: "Fade In" },
  { value: "slide-up", label: "Deslizar para cima" },
  { value: "scale", label: "Escala" },
  { value: "bounce", label: "Quicar" },
];

const FONT_OPTIONS = [
  { value: "Inter", label: "Inter (Moderno)" },
  { value: "Poppins", label: "Poppins (Clean)" },
  { value: "Montserrat", label: "Montserrat (Elegante)" },
  { value: "Raleway", label: "Raleway (Sofisticado)" },
  { value: "Playfair Display", label: "Playfair Display (Serif)" },
  { value: "Space Grotesk", label: "Space Grotesk (Tech)" },
  { value: "DM Sans", label: "DM Sans (Minimalista)" },
  { value: "Outfit", label: "Outfit (Geométrico)" },
  { value: "Sora", label: "Sora (Futurista)" },
  { value: "Nunito", label: "Nunito (Arredondado)" },
];

const GRADIENT_DIRECTIONS = [
  { value: "to bottom", label: "Cima → Baixo" },
  { value: "to top", label: "Baixo → Cima" },
  { value: "to right", label: "Esquerda → Direita" },
  { value: "to left", label: "Direita → Esquerda" },
  { value: "to bottom right", label: "Diagonal ↘" },
  { value: "to bottom left", label: "Diagonal ↙" },
];

const SOCIAL_POSITION_OPTIONS = [
  { value: "top", label: "Topo (acima dos links)" },
  { value: "bottom", label: "Rodapé" },
  { value: "hidden", label: "Oculto (mostrar como link)" },
];

export default function LinkBioSettingsPage() {
  const [links, setLinks] = useState<BioLink[]>([]);
  const [settings, setSettings] = useState<BioSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showEditor, setShowEditor] = useState(false);
  const [editingLink, setEditingLink] = useState<Partial<BioLink>>({});
  const [saving, setSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [copied, setCopied] = useState(false);

  const publicUrl = typeof window !== "undefined"
    ? `${window.location.origin}/links`
    : "/links";

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/admin/bio-links");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLinks(data.links);
      setSettings(data.settings);
    } catch (e: any) {
      setError(e.message || "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function flash(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  }

  async function handleSaveLink() {
    setSaving(true);
    setError("");
    try {
      const res = await authedFetch("/api/admin/bio-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert_link", ...editingLink }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowEditor(false);
      setEditingLink({});
      flash(editingLink.id ? "Link atualizado" : "Link criado");
      fetchData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setError("");
    try {
      const res = await authedFetch("/api/admin/bio-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_link", id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      flash("Link removido");
      fetchData();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleToggle(link: BioLink) {
    try {
      await authedFetch("/api/admin/bio-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert_link", ...link, enabled: !link.enabled }),
      });
      setLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, enabled: !l.enabled } : l)));
    } catch {}
  }

  async function handleMoveUp(index: number) {
    if (index === 0) return;
    const newLinks = [...links];
    [newLinks[index - 1], newLinks[index]] = [newLinks[index], newLinks[index - 1]];
    const order = newLinks.map((l, i) => ({ id: l.id, position: i }));
    setLinks(newLinks);
    await authedFetch("/api/admin/bio-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reorder", order }),
    });
  }

  async function handleMoveDown(index: number) {
    if (index >= links.length - 1) return;
    const newLinks = [...links];
    [newLinks[index], newLinks[index + 1]] = [newLinks[index + 1], newLinks[index]];
    const order = newLinks.map((l, i) => ({ id: l.id, position: i }));
    setLinks(newLinks);
    await authedFetch("/api/admin/bio-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reorder", order }),
    });
  }

  async function handleSaveSettings() {
    if (!settings) return;
    setSavingSettings(true);
    setError("");
    try {
      const res = await authedFetch("/api/admin/bio-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_settings", ...settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettings(data.settings);
      flash("Configurações salvas");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingSettings(false);
    }
  }

  function handleCopyUrl() {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const gradientPreview = settings?.gradient_start && settings?.gradient_end
    ? `linear-gradient(${settings.gradient_direction || "to bottom"}, ${settings.gradient_start}, ${settings.gradient_end})`
    : null;

  if (loading) {
    return (
      <div className="space-y-6">
        <SettingsHeader />
        <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsHeader />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Public URL */}
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Link na Bio
          </CardTitle>
          <CardDescription>
            Configure os links que aparecem na sua página pública. Copie o link abaixo e cole na bio do Instagram.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input value={publicUrl} readOnly className="font-mono text-sm" />
            <Button variant="outline" size="sm" onClick={handleCopyUrl}>
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/links" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Page settings - Profile */}
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Perfil & Textos
          </CardTitle>
          <CardDescription>Nome, descrição e subtítulo exibidos na página.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome exibido</Label>
            <Input
              value={settings?.display_name ?? ""}
              onChange={(e) => setSettings((s) => s ? { ...s, display_name: e.target.value } : s)}
            />
          </div>
          <ImageUploadField
            label="Foto de Perfil (Avatar)"
            value={settings?.avatar_url ?? null}
            onChange={(url) => setSettings((s) => s ? { ...s, avatar_url: url ?? "" } : s)}
            hint="JPG, PNG ou WebP. Máximo 5MB."
          />
          <div className="space-y-1.5">
            <Label>Subtítulo / Cargo</Label>
            <Input
              placeholder="Ex: CEO | Aluguel de carros premium"
              value={settings?.subtitle ?? ""}
              onChange={(e) => setSettings((s) => s ? { ...s, subtitle: e.target.value } : s)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição da página (SEO)</Label>
            <Input
              placeholder="Ex: Links oficiais da Vertex Rental Cars"
              value={settings?.description ?? ""}
              onChange={(e) => setSettings((s) => s ? { ...s, description: e.target.value } : s)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Background & Gradient */}
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Fundo & Cores
          </CardTitle>
          <CardDescription>Cor sólida, gradiente ou imagem de fundo. O gradiente tem prioridade sobre a cor sólida.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ImageUploadField
            label="Imagem de Fundo"
            value={settings?.background_image_url ?? null}
            onChange={(url) => setSettings((s) => s ? { ...s, background_image_url: url ?? "" } : s)}
            hint="Se preenchido, a imagem substitui cor e gradiente. Máximo 5MB."
          />

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Cor de fundo</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings?.background_color ?? "#000000"}
                  onChange={(e) => setSettings((s) => s ? { ...s, background_color: e.target.value } : s)}
                  className="h-9 w-12 rounded border cursor-pointer"
                />
                <Input
                  value={settings?.background_color ?? "#000000"}
                  onChange={(e) => setSettings((s) => s ? { ...s, background_color: e.target.value } : s)}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Cor do texto</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings?.text_color ?? "#ffffff"}
                  onChange={(e) => setSettings((s) => s ? { ...s, text_color: e.target.value } : s)}
                  className="h-9 w-12 rounded border cursor-pointer"
                />
                <Input
                  value={settings?.text_color ?? "#ffffff"}
                  onChange={(e) => setSettings((s) => s ? { ...s, text_color: e.target.value } : s)}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Cor de destaque</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings?.accent_color ?? "#3b82f6"}
                  onChange={(e) => setSettings((s) => s ? { ...s, accent_color: e.target.value } : s)}
                  className="h-9 w-12 rounded border cursor-pointer"
                />
                <Input
                  value={settings?.accent_color ?? "#3b82f6"}
                  onChange={(e) => setSettings((s) => s ? { ...s, accent_color: e.target.value } : s)}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </div>

          {/* Gradient */}
          <div className="border rounded-lg p-4 space-y-3">
            <Label className="text-sm font-semibold">Gradiente (opcional)</Label>
            <p className="text-xs text-muted-foreground">Preencha ambas as cores para ativar o gradiente.</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Cor inicial</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings?.gradient_start ?? "#1a1a2e"}
                    onChange={(e) => setSettings((s) => s ? { ...s, gradient_start: e.target.value } : s)}
                    className="h-9 w-12 rounded border cursor-pointer"
                  />
                  <Input
                    placeholder="#1a1a2e"
                    value={settings?.gradient_start ?? ""}
                    onChange={(e) => setSettings((s) => s ? { ...s, gradient_start: e.target.value } : s)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cor final</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings?.gradient_end ?? "#16213e"}
                    onChange={(e) => setSettings((s) => s ? { ...s, gradient_end: e.target.value } : s)}
                    className="h-9 w-12 rounded border cursor-pointer"
                  />
                  <Input
                    placeholder="#16213e"
                    value={settings?.gradient_end ?? ""}
                    onChange={(e) => setSettings((s) => s ? { ...s, gradient_end: e.target.value } : s)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Direção</Label>
                <Select
                  value={settings?.gradient_direction ?? "to bottom"}
                  onValueChange={(v) => setSettings((s) => s ? { ...s, gradient_direction: v } : s)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADIENT_DIRECTIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {gradientPreview && (
              <div className="h-12 rounded-lg border" style={{ background: gradientPreview }} />
            )}
            {(settings?.gradient_start || settings?.gradient_end) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setSettings((s) => s ? { ...s, gradient_start: null as any, gradient_end: null as any } : s)}
              >
                Limpar gradiente
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Visual Effects */}
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Efeitos Visuais
          </CardTitle>
          <CardDescription>Estilo dos botões, sombras, animações e tipografia.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Estilo dos botões</Label>
              <Select
                value={settings?.button_style ?? "rounded"}
                onValueChange={(v) => setSettings((s) => s ? { ...s, button_style: v } : s)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rounded">Arredondado</SelectItem>
                  <SelectItem value="pill">Pílula</SelectItem>
                  <SelectItem value="square">Quadrado</SelectItem>
                  <SelectItem value="outline">Contorno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sombra dos botões</Label>
              <Select
                value={settings?.button_shadow ?? "soft"}
                onValueChange={(v) => setSettings((s) => s ? { ...s, button_shadow: v } : s)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHADOW_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Animação de entrada</Label>
              <Select
                value={settings?.button_animation ?? "fade-in"}
                onValueChange={(v) => setSettings((s) => s ? { ...s, button_animation: v } : s)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANIMATION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Fonte</Label>
              <Select
                value={settings?.font_family ?? "Inter"}
                onValueChange={(v) => setSettings((s) => s ? { ...s, font_family: v } : s)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Barra de redes sociais</Label>
              <Select
                value={settings?.social_position ?? "bottom"}
                onValueChange={(v) => setSettings((s) => s ? { ...s, social_position: v } : s)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOCIAL_POSITION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSaveSettings} disabled={savingSettings} className="bg-black hover:bg-black/80 text-white">
              {savingSettings ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Aparência
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Links list */}
      <Card className="max-w-3xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Links</CardTitle>
              <CardDescription>Adicione, edite e organize seus links. Cada link pode ter cores individuais.</CardDescription>
            </div>
            <Button
              onClick={() => { setEditingLink({}); setShowEditor(true); }}
              className="bg-black hover:bg-black/80 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Link
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhum link adicionado ainda.</p>
          ) : (
            <div className="space-y-2">
              {links.map((link, i) => (
                <div
                  key={link.id}
                  className="flex items-center gap-3 p-3 border rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleMoveUp(i)}
                      disabled={i === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs"
                    >
                      ▲
                    </button>
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <button
                      onClick={() => handleMoveDown(i)}
                      disabled={i === links.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs"
                    >
                      ▼
                    </button>
                  </div>

                  {link.button_color && (
                    <div
                      className="w-4 h-10 rounded shrink-0"
                      style={{ backgroundColor: link.button_color }}
                      title={`Cor: ${link.button_color}`}
                    />
                  )}

                  {link.thumbnail_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={link.thumbnail_url}
                      alt=""
                      className="w-10 h-10 rounded object-cover shrink-0"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{link.title}</span>
                      {link.icon && (
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {link.icon}
                        </span>
                      )}
                    </div>
                    {link.description && (
                      <p className="text-xs text-muted-foreground truncate">{link.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground truncate opacity-60">{link.url}</p>
                  </div>

                  <Switch
                    checked={link.enabled}
                    onCheckedChange={() => handleToggle(link)}
                  />

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setEditingLink(link); setShowEditor(true); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(link.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link editor dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLink.id ? "Editar Link" : "Novo Link"}</DialogTitle>
            <DialogDescription>Configure título, URL, ícone, descrição e cores individuais.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                placeholder="Ex: Nosso Instagram"
                value={editingLink.title ?? ""}
                onChange={(e) => setEditingLink((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>URL</Label>
              <Input
                placeholder="https://..."
                value={editingLink.url ?? ""}
                onChange={(e) => setEditingLink((f) => ({ ...f, url: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição (opcional)</Label>
              <Input
                placeholder="Ex: Siga-nos para novidades e promoções"
                value={editingLink.description ?? ""}
                onChange={(e) => setEditingLink((f) => ({ ...f, description: e.target.value || null }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ícone</Label>
              <Select
                value={editingLink.icon ?? "none"}
                onValueChange={(v) => setEditingLink((f) => ({ ...f, icon: v === "none" ? null : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um ícone" />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ImageUploadField
              label="Miniatura do link"
              value={editingLink.thumbnail_url ?? null}
              onChange={(url) => setEditingLink((f) => ({ ...f, thumbnail_url: url ?? null }))}
              hint="Imagem exibida ao lado do título. Máximo 5MB."
            />

            {/* Per-link colors */}
            <div className="border rounded-lg p-3 space-y-3">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Cores individuais (opcional)
              </Label>
              <p className="text-xs text-muted-foreground">Se vazio, usa a cor de destaque padrão.</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Cor do botão</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editingLink.button_color ?? "#3b82f6"}
                      onChange={(e) => setEditingLink((f) => ({ ...f, button_color: e.target.value }))}
                      className="h-9 w-12 rounded border cursor-pointer"
                    />
                    <Input
                      placeholder="Ex: #ff6b35"
                      value={editingLink.button_color ?? ""}
                      onChange={(e) => setEditingLink((f) => ({ ...f, button_color: e.target.value || null }))}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cor do texto</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editingLink.button_text_color ?? "#ffffff"}
                      onChange={(e) => setEditingLink((f) => ({ ...f, button_text_color: e.target.value }))}
                      className="h-9 w-12 rounded border cursor-pointer"
                    />
                    <Input
                      placeholder="Ex: #ffffff"
                      value={editingLink.button_text_color ?? ""}
                      onChange={(e) => setEditingLink((f) => ({ ...f, button_text_color: e.target.value || null }))}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
              {editingLink.button_color && (
                <div
                  className="h-10 rounded-lg flex items-center justify-center text-sm font-medium"
                  style={{
                    backgroundColor: editingLink.button_color,
                    color: editingLink.button_text_color || "#ffffff",
                  }}
                >
                  Preview do botão
                </div>
              )}
              {(editingLink.button_color || editingLink.button_text_color) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setEditingLink((f) => ({ ...f, button_color: null, button_text_color: null }))}
                >
                  Limpar cores individuais
                </Button>
              )}
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditor(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveLink}
              disabled={saving || !editingLink.title || !editingLink.url}
              className="bg-black hover:bg-black/80 text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
