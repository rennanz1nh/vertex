"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Globe, FileText, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SettingsField } from "@/components/admin/SettingsField";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export default function SeoGeneralTab() {
  const { toast } = useToast();
  const { row, loading, saving, setField, save } = useSiteSettings();

  async function handleSave() {
    const ok = await save();
    toast(
      ok
        ? { title: "Salvo!", description: "Configurações gerais de SEO atualizadas." }
        : { title: "Erro ao salvar", description: "Tente novamente.", variant: "destructive" }
    );
  }

  if (loading || !row) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Carregando...</span>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" /> Padrões do site
          </CardTitle>
          <CardDescription>
            Valores usados quando uma página ou produto não tem SEO próprio definido.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <SettingsField
            label="Endereço do site (URL canônica)"
            value={row.site_url}
            onChange={(v) => setField("site_url", v)}
            placeholder="https://vertexrentalcars.com"
            hint="Base usada em links canônicos, sitemap e feed. Sem barra no final."
          />
          <SettingsField
            label="Nome do site"
            value={row.site_name}
            onChange={(v) => setField("site_name", v)}
            placeholder="Vertex Rental Cars"
          />
          <SettingsField
            label="Título padrão"
            value={row.default_title}
            onChange={(v) => setField("default_title", v)}
            placeholder="Vertex Rental Cars — Premium Car Rentals"
          />
          <SettingsField
            label="Descrição padrão"
            value={row.default_description}
            onChange={(v) => setField("default_description", v)}
            placeholder="Premium vehicles for your next trip in Orlando, FL..."
            textarea
          />
          <SettingsField
            label="Imagem social padrão (Open Graph)"
            value={row.default_og_image}
            onChange={(v) => setField("default_og_image", v)}
            placeholder="https://... imagem exibida ao compartilhar links do site"
          />
          <Button className="bg-black hover:bg-black/80 text-white" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Arquivos técnicos (gerados automaticamente)
          </CardTitle>
          <CardDescription>
            Esses arquivos são gerados pelo site. Envie o sitemap ao Google Search Console.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {[
            { href: "/sitemap.xml", label: "sitemap.xml" },
            { href: "/robots.txt", label: "robots.txt" },
            { href: "/feed/products", label: "feed de produtos" },
          ].map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 border rounded-md hover:bg-muted transition-colors"
            >
              {l.label}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
