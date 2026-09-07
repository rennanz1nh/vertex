"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TikTokShopAutomationTabs } from "@/components/tiktok-shop/TikTokShopAutomationTabs";
import { TikTokShopConnectionButton } from "@/components/tiktok-shop/TikTokShopConnectionButton";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { authedFetch } from "@/lib/admin-fetch";

type TikTokShopListing = { productId: string; skuId: string; title: string; price: number; imageUrl?: string };

export default function TikTokShopListings() {
  const [listings, setListings] = useState<TikTokShopListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    authedFetch("/api/tiktok-shop/listings")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setListings(d.listings ?? []);
      })
      .catch(() => setError("Falha na conexão ao buscar listings"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = listings.filter((l) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return l.title.toLowerCase().includes(q) || l.skuId.includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/sales-channels/TikTok.png" alt="TikTok Shop" className="h-10 w-auto" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Listings — TikTok Shop</h1>
            <p className="text-muted-foreground text-sm">Catálogo de produtos/SKUs ativos na sua loja TikTok Shop</p>
          </div>
        </div>
        <div className="ml-auto">
          <TikTokShopConnectionButton />
        </div>
      </div>

      <TikTokShopAutomationTabs />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Catálogo</CardTitle>
          <CardDescription>{loading ? "Carregando..." : `${filtered.length} SKU(s) ativo(s)`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por título ou SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Carregando listings do TikTok Shop...</span>
            </div>
          ) : (
            <div className="border rounded-lg divide-y">
              {filtered.map((l) => (
                <div key={l.skuId} className="flex items-center gap-3 p-2.5">
                  {l.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.imageUrl} alt="" className="h-10 w-10 rounded object-cover shrink-0 bg-muted" />
                  ) : (
                    <div className="h-10 w-10 rounded shrink-0 bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{l.title}</p>
                    <p className="text-xs text-muted-foreground">SKU: {l.skuId}</p>
                  </div>
                  <span className="text-sm font-semibold shrink-0">${l.price.toFixed(2)}</span>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhum listing encontrado</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
