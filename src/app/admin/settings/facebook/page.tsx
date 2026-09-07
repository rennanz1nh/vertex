"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Share2, ShoppingBag, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SettingsHeader } from "@/components/admin/SettingsHeader";
import { SettingsField } from "@/components/admin/SettingsField";
import { FacebookLogo, MetaLogo } from "@/components/brand-logos";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { resolveSiteUrl } from "@/lib/seo";

export default function FacebookSettingsPage() {
  const { toast } = useToast();
  const { row, loading, saving, setField, save } = useSiteSettings();
  const [copied, setCopied] = useState(false);

  async function handleSave() {
    const ok = await save();
    toast(
      ok
        ? { title: "Salvo!", description: "Conexões do Facebook atualizadas." }
        : { title: "Erro ao salvar", description: "Tente novamente.", variant: "destructive" }
    );
  }

  function copyFeed(url: string) {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading || !row) {
    return (
      <div className="space-y-6">
        <SettingsHeader />
        <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando...</span>
        </div>
      </div>
    );
  }

  const feedUrl = `${resolveSiteUrl(row)}/feed/products`;

  return (
    <div className="space-y-6">
      <SettingsHeader />

      <div className="max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <FacebookLogo className="h-8 w-8" />
          <h2 className="text-2xl font-bold tracking-tight">Facebook</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" /> Meta Pixel e Verificação
            </CardTitle>
            <CardDescription>
              Cole os IDs do Meta (Facebook/Instagram) — o site injeta o Pixel automaticamente (só em
              produção).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <SettingsField
              label={<><MetaLogo className="h-4 w-4 shrink-0" />Meta Pixel ID</>}
              value={row.facebook_pixel_id}
              onChange={(v) => setField("facebook_pixel_id", v)}
              placeholder="123456789012345"
              hint="Encontrado no Meta Events Manager > Fontes de dados."
            />
            <SettingsField
              label={<><MetaLogo className="h-4 w-4 shrink-0" />Verificação de domínio (Meta)</>}
              value={row.facebook_domain_verification}
              onChange={(v) => setField("facebook_domain_verification", v)}
              placeholder="Só o valor do content da meta tag"
              hint="Business Settings > Brand Safety > Domains > verificação por meta-tag."
            />
            <SettingsField
              label="Link da página no Facebook"
              value={row.facebook_page_url}
              onChange={(v) => setField("facebook_page_url", v)}
              placeholder="https://facebook.com/suapagina"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" /> Catálogo de Produtos (Feed)
            </CardTitle>
            <CardDescription>
              O site gera automaticamente um feed com todos os produtos publicados. Use esta URL no
              Meta Commerce Manager (e também serve para o Google Merchant Center) como um feed
              agendado — ele atualiza sozinho.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Input readOnly value={feedUrl} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copyFeed(feedUrl)} title="Copiar">
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              No Commerce Manager: Catálogo &gt; Fontes de dados &gt; Feed de dados &gt; Usar URL, cole
              o link acima e defina a frequência (ex: diária). A URL usa o endereço configurado na aba
              SEO.
            </p>
          </CardContent>
        </Card>

        <div className="flex">
          <Button className="bg-black hover:bg-black/80 text-white" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
