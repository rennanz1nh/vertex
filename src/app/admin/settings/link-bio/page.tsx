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
} from "lucide-react";
import { SettingsHeader } from "@/components/admin/SettingsHeader";
import { authedFetch } from "@/lib/admin-fetch";

type BioLink = {
  id: string;
  title: string;
  url: string;
  icon: string | null;
  position: number;
  enabled: boolean;
};

type BioSettings = {
  id: string;
  display_name: string;
  description: string | null;
  avatar_url: string | null;
  background_color: string;
  text_color: string;
  button_style: string;
};

const ICON_OPTIONS = [
  { value: "", label: "Nenhum" },
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

      {/* Page settings */}
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Aparência da Página</CardTitle>
          <CardDescription>Personalize como a página de links aparece para os visitantes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nome exibido</Label>
              <Input
                value={settings?.display_name ?? ""}
                onChange={(e) => setSettings((s) => s ? { ...s, display_name: e.target.value } : s)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>URL do Avatar</Label>
              <Input
                placeholder="https://..."
                value={settings?.avatar_url ?? ""}
                onChange={(e) => setSettings((s) => s ? { ...s, avatar_url: e.target.value } : s)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input
              placeholder="Uma frase curta sobre o negócio"
              value={settings?.description ?? ""}
              onChange={(e) => setSettings((s) => s ? { ...s, description: e.target.value } : s)}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
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
              <CardDescription>Adicione, edite e organize seus links.</CardDescription>
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

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{link.title}</span>
                      {link.icon && (
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {link.icon}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{link.url}</p>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLink.id ? "Editar Link" : "Novo Link"}</DialogTitle>
            <DialogDescription>Configure o título, URL e ícone do link.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
              <Label>Ícone</Label>
              <Select
                value={editingLink.icon ?? ""}
                onValueChange={(v) => setEditingLink((f) => ({ ...f, icon: v || null }))}
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
