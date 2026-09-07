"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, Plus, Pencil, Image as ImageIcon, Video as VideoIcon, Loader2 } from "lucide-react";
import { SettingsTabs } from "@/components/admin/SettingsTabs";
import BannerModal from "@/components/admin/BannerModal";
import { BANNER_PAGE_OPTIONS, type Banner, type BannerPlacement } from "@/lib/banners";
import { getRibbonClassName } from "@/lib/ribbon";

const pageLabel = (value: string) => BANNER_PAGE_OPTIONS.find((o) => o.value === value)?.label ?? value;

export default function BannersSettingsPage() {
  const { toast } = useToast();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [creating, setCreating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<BannerPlacement>("hero");

  const fetchBanners = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("banners")
      .select("*")
      .order("page")
      .order("sort_order");
    if (error) {
      toast({ title: "Erro ao carregar banners", description: error.message, variant: "destructive" });
    } else {
      setBanners((data ?? []) as Banner[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const visibleBanners = useMemo(() => banners.filter((b) => b.placement === activeTab), [banners, activeTab]);

  async function toggleActive(banner: Banner) {
    setTogglingId(banner.id);
    const { error } = await supabase
      .from("banners")
      .update({ active: !banner.active, updated_at: new Date().toISOString() })
      .eq("id", banner.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setBanners((prev) => prev.map((b) => (b.id === banner.id ? { ...b, active: !b.active } : b)));
    }
    setTogglingId(null);
  }

  const newLabel = activeTab === "popup" ? "Novo Pop-up" : "Novo Banner";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-7 w-7" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
            <p className="text-muted-foreground text-sm">Preferências gerais do sistema</p>
          </div>
        </div>
        <Button className="bg-black hover:bg-black/80 text-white" onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {newLabel}
        </Button>
      </div>

      <SettingsTabs />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as BannerPlacement)}>
        <TabsList>
          <TabsTrigger value="hero">Banners</TabsTrigger>
          <TabsTrigger value="popup">Pop-ups</TabsTrigger>
        </TabsList>
      </Tabs>
      <p className="text-sm text-muted-foreground -mt-4">
        {activeTab === "hero"
          ? "Faixas fixas no topo das páginas (ex: a foto grande da Home). Mais de uma ativa na mesma página gira em carrossel automaticamente."
          : "Janelas que aparecem sobre a página ao carregar."}
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando...</span>
        </div>
      ) : visibleBanners.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            {activeTab === "hero" ? "Nenhum banner" : "Nenhum pop-up"} configurado ainda. Clique em &quot;{newLabel}&quot; para criar o primeiro.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleBanners.map((banner) => (
            <Card key={banner.id} className={banner.active ? "" : "opacity-60"}>
              <div className="relative w-full aspect-[16/9] bg-muted overflow-hidden rounded-t-lg">
                {banner.media_type === "video" ? (
                  <video src={banner.media_url} className="w-full h-full object-cover" muted />
                ) : banner.media_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={banner.media_url} alt={banner.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}
                <span className="absolute top-2 left-2 rounded bg-black/70 text-white text-[10px] font-semibold px-2 py-0.5 flex items-center gap-1">
                  {banner.media_type === "video" ? <VideoIcon className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                  {banner.media_type === "video" ? "Vídeo" : "Imagem"}
                </span>
                {banner.ribbon_text && (
                  <span className={`absolute top-2 right-2 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${getRibbonClassName(banner.ribbon_color)}`}>
                    {banner.ribbon_text}
                  </span>
                )}
              </div>
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="font-semibold truncate">{banner.title}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <Badge variant="secondary">{pageLabel(banner.page)}</Badge>
                    {banner.placement === "hero" && <Badge variant="outline">{banner.duration_seconds}s no carrossel</Badge>}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={banner.active}
                      onCheckedChange={() => toggleActive(banner)}
                      disabled={togglingId === banner.id}
                      className="data-[state=checked]:bg-black"
                    />
                    <span className="text-xs text-muted-foreground">{banner.active ? "Ativo" : "Inativo"}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(banner)}>
                    <Pencil className="h-4 w-4 mr-1.5" />
                    Editar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BannerModal
        banner={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
        onChanged={fetchBanners}
      />
      <BannerModal
        banner={null}
        open={creating}
        onClose={() => setCreating(false)}
        onChanged={fetchBanners}
        defaultPlacement={activeTab}
      />
    </div>
  );
}
