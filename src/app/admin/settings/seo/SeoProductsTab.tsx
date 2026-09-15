"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Search, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SeoFieldsBlock, type SeoValues } from "@/components/admin/SeoFieldsBlock";

type ProductRow = {
  id: string;
  name: string | null;
  vin: string | null;
  image_url: string | null;
  description: string | null;
};

const EMPTY: SeoValues = { title: null, description: null, og_image: null, noindex: false };

export default function SeoProductsTab() {
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ProductRow | null>(null);
  const [values, setValues] = useState<SeoValues>(EMPTY);
  const [loadingSeo, setLoadingSeo] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingList(true);
      const { data } = await supabase
        .from("products")
        .select("id, name, vin, image_url, description")
        .order("name");
      setProducts((data as ProductRow[] | null) ?? []);
      setLoadingList(false);
    })();
  }, []);

  const openProduct = useCallback(async (p: ProductRow) => {
    setSelected(p);
    setLoadingSeo(true);
    const { data } = await supabase.from("product_seo").select("*").eq("product_id", p.id).maybeSingle();
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
    setLoadingSeo(false);
  }, []);

  function set<K extends keyof SeoValues>(key: K, value: SeoValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from("product_seo").upsert(
      {
        product_id: selected.id,
        title: values.title?.trim() || null,
        description: values.description?.trim() || null,
        og_image: values.og_image?.trim() || null,
        noindex: values.noindex,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "product_id" }
    );
    setSaving(false);
    toast(
      error
        ? { title: "Erro ao salvar", description: error.message, variant: "destructive" }
        : { title: "Salvo!", description: "SEO do produto atualizado." }
    );
  }

  const term = search.toLowerCase();
  const filtered = products.filter(
    (p) =>
      (p.name || "").toLowerCase().includes(term) ||
      (p.vin || "").toLowerCase().includes(term)
  );

  // ---- Editing a selected product ----
  if (selected) {
    return (
      <Card className="max-w-3xl">
        <CardHeader>
          <button
            onClick={() => setSelected(null)}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ChevronLeft className="h-4 w-4" /> Voltar para a lista
          </button>
          <CardTitle className="flex items-center gap-3">
            {selected.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.image_url} alt="" className="w-10 h-10 rounded object-cover" />
            )}
            {selected.name || "Produto"}
          </CardTitle>
          <CardDescription>
            Em branco = usa o nome/descrição do próprio carro. VIN: {selected.vin || "—"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loadingSeo ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : (
            <>
              <SeoFieldsBlock
                values={values}
                onChange={set}
                fallbackTitle={selected.name || undefined}
                fallbackDescription={selected.description || undefined}
              />
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

  // ---- Product list + search ----
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>SEO por produto</CardTitle>
        <CardDescription>Busque e selecione um produto para editar o SEO dele.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {loadingList ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando produtos...
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">Nenhum produto encontrado.</p>
        ) : (
          <div className="divide-y border rounded-lg max-h-[480px] overflow-y-auto">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => openProduct(p)}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted transition-colors"
              >
                <div className="w-10 h-10 rounded bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Search className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground">{p.vin || "sem VIN"}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
