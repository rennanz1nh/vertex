"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, BarChart3, Store } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SettingsHeader } from "@/components/admin/SettingsHeader";
import { SettingsField } from "@/components/admin/SettingsField";
import {
  GoogleLogo,
  GoogleAnalyticsLogo,
  GoogleTagManagerLogo,
  GoogleAdsLogo,
  GoogleSearchConsoleLogo,
} from "@/components/brand-logos";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export default function GoogleSettingsPage() {
  const { toast } = useToast();
  const { row, loading, saving, setField, save } = useSiteSettings();

  async function handleSave() {
    const ok = await save();
    toast(
      ok
        ? { title: "Salvo!", description: "Conexões do Google atualizadas." }
        : { title: "Erro ao salvar", description: "Tente novamente.", variant: "destructive" }
    );
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

  return (
    <div className="space-y-6">
      <SettingsHeader />

      <div className="max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <GoogleLogo className="h-8 w-8" />
          <h2 className="text-2xl font-bold tracking-tight">Google</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" /> Tags e Rastreamento
            </CardTitle>
            <CardDescription>
              Cole os IDs abaixo — o site injeta os scripts automaticamente (só em produção). Deixe em
              branco para desativar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <SettingsField
              label={<><GoogleAnalyticsLogo className="h-4 w-4 shrink-0" />Google Analytics (GA4) — Measurement ID</>}
              value={row.ga4_measurement_id}
              onChange={(v) => setField("ga4_measurement_id", v)}
              placeholder="G-XXXXXXXXXX"
              hint={
                <>
                  Encontrado em Admin &gt; Fluxos de dados no Google Analytics. Esse é o ID que ativa o
                  rastreamento (G-XXXX) — não confunda com o Property ID numérico, que fica em{" "}
                  <a href="/admin/automations/google-cloud/bigquery" className="underline">
                    Automações &gt; Google Cloud &gt; Status GA4 → BigQuery
                  </a>
                  .
                </>
              }
            />
            <SettingsField
              label={<><GoogleTagManagerLogo className="h-4 w-4 shrink-0" />Google Tag Manager — Container ID</>}
              value={row.gtm_container_id}
              onChange={(v) => setField("gtm_container_id", v)}
              placeholder="GTM-XXXXXXX"
              hint="Se usar o GTM, normalmente configure o GA4/Ads por dentro dele."
            />
            <SettingsField
              label={<><GoogleAdsLogo className="h-4 w-4 shrink-0" />Google Ads — Conversion ID</>}
              value={row.google_ads_conversion_id}
              onChange={(v) => setField("google_ads_conversion_id", v)}
              placeholder="AW-XXXXXXXXX"
            />
          </CardContent>
        </Card>

        <Card className="border-blue-100 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <GoogleSearchConsoleLogo className="h-8 w-8" />
              <span>Google Search Console</span>
            </CardTitle>
            <CardDescription>
              Configure a verificação de domínio para gerenciar seu site no Search Console.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsField
              label={<><GoogleSearchConsoleLogo className="h-4 w-4 shrink-0" />Código de verificação</>}
              value={row.google_site_verification}
              onChange={(v) => setField("google_site_verification", v)}
              placeholder="Ex: google1234abcd... (só o conteúdo do meta tag)"
              hint="No Search Console, escolha verificação por tag HTML e cole apenas o valor do content."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" /> Google Business (Perfil da Empresa)
            </CardTitle>
            <CardDescription>
              Esses dados geram os &quot;dados estruturados&quot; de negócio local (endereço, telefone,
              horário) que o Google usa para mostrar seu negócio na busca e no Maps.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <SettingsField
              label="Nome do negócio"
              value={row.business_name}
              onChange={(v) => setField("business_name", v)}
              placeholder="Vertex Rental Cars"
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <SettingsField label="Telefone" value={row.business_phone} onChange={(v) => setField("business_phone", v)} placeholder="+1 407 000 0000" />
              <SettingsField label="Email" value={row.business_email} onChange={(v) => setField("business_email", v)} placeholder="contato@cosmeticmkt.com" />
            </div>
            <SettingsField label="Endereço (rua e número)" value={row.business_street} onChange={(v) => setField("business_street", v)} placeholder="123 Main St" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <SettingsField label="Cidade" value={row.business_city} onChange={(v) => setField("business_city", v)} placeholder="Orlando" />
              <SettingsField label="Estado" value={row.business_state} onChange={(v) => setField("business_state", v)} placeholder="FL" />
              <SettingsField label="CEP / ZIP" value={row.business_zip} onChange={(v) => setField("business_zip", v)} placeholder="32801" />
              <SettingsField label="País" value={row.business_country} onChange={(v) => setField("business_country", v)} placeholder="US" />
            </div>
            <SettingsField
              label="Horário de funcionamento"
              value={row.business_hours}
              onChange={(v) => setField("business_hours", v)}
              placeholder="Mo-Fr 09:00-18:00"
              hint="Formato schema.org (ex: Mo-Fr 09:00-18:00, Sa 10:00-14:00)."
            />
            <SettingsField
              label="Link do Google Maps / Perfil da Empresa"
              value={row.business_maps_url}
              onChange={(v) => setField("business_maps_url", v)}
              placeholder="https://maps.google.com/..."
            />
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
