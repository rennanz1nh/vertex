"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SeoFieldsBlock, type SeoValues } from "@/components/admin/SeoFieldsBlock";
import { SEO_PAGE_OPTIONS } from "@/lib/seo";

const EMPTY: SeoValues = { title: null, description: null, og_image: null, noindex: false };

export default function SeoPagesTab() {
  const { toast } = useToast();
  const [pageKey, setPageKey] = useState<string>(SEO_PAGE_OPTIONS[0].value);
  const [values, setValues] = useState<SeoValues>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (key: string) => {
    setLoading(true);
    const { data } = await supabase.from("page_seo").select("*").eq("page_key", key).maybeSingle();
    setValues(
      data
        ? {
            title: data.title ?? null,
            description: data.description ?? null,
            og_image: data.og_image ?? null,
            noindex: !!data.noindex,
          }
        : EMPTY
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load(pageKey);
  }, [pageKey, load]);

  function set<K extends keyof SeoValues>(key: K, value: SeoValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase.from("page_seo").upsert(
      {
        page_key: pageKey,
        title: values.title?.trim() || null,
        description: values.description?.trim() || null,
        og_image: values.og_image?.trim() || null,
        noindex: values.noindex,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "page_key" }
    );
    setSaving(false);
    toast(
      error
        ? { title: "Erro ao salvar", description: error.message, variant: "destructive" }
        : { title: "Salvo!", description: "SEO da página atualizado." }
    );
  }

  const current = SEO_PAGE_OPTIONS.find((p) => p.value === pageKey);

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>SEO por página</CardTitle>
        <CardDescription>
          Escolha uma página e defina título, descrição e imagem próprios. Em branco = usa o padrão da
          aba Geral.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label>Página</Label>
          <Select value={pageKey} onValueChange={setPageKey}>
            <SelectTrigger className="max-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEO_PAGE_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label} <span className="text-muted-foreground">({p.path})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <>
            <SeoFieldsBlock values={values} onChange={set} fallbackTitle={current?.label} />
            <Button className="bg-black hover:bg-black/80 text-white" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
