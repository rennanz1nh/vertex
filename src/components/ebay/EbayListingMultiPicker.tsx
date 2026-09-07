"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Loader2 } from "lucide-react";
import type { EbayListing } from "@/components/ebay/EbayListingPicker";
import { authedFetch } from "@/lib/admin-fetch";

/** Multi-select variant of EbayListingPicker — for flows that place several listings
 *  into one thing at once (e.g. a new ad campaign), where the single-select picker
 *  (used by Listings Automation / Listing Analyser) doesn't fit. */
export function EbayListingMultiPicker({
  selectedItemIds,
  onChange,
}: {
  selectedItemIds: Set<string>;
  onChange: (itemIds: Set<string>) => void;
}) {
  const [listings, setListings] = useState<EbayListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    authedFetch("/api/ebay/listings")
      .then((r) => r.json())
      .then((d) => setListings(d.listings || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredListings = listings.filter((l) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return l.title.toLowerCase().includes(q) || l.itemId.includes(q);
  });

  function toggle(itemId: string) {
    const next = new Set(selectedItemIds);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título ou ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{selectedItemIds.size} selecionado(s)</span>
        <div className="flex gap-3">
          <button type="button" className="underline hover:text-foreground" onClick={() => onChange(new Set(filteredListings.map((l) => l.itemId)))}>
            Selecionar todos
          </button>
          <button type="button" className="underline hover:text-foreground" onClick={() => onChange(new Set())}>
            Limpar
          </button>
        </div>
      </div>
      <div className="border rounded-lg overflow-y-auto max-h-[360px]">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Carregando listings do eBay...</span>
          </div>
        ) : (
          <>
            {filteredListings.map((l) => (
              <label
                key={l.itemId}
                className="w-full flex items-center gap-3 p-2.5 border-b last:border-0 cursor-pointer hover:bg-muted/30"
              >
                <Checkbox checked={selectedItemIds.has(l.itemId)} onCheckedChange={() => toggle(l.itemId)} />
                {l.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.imageUrl} alt="" className="h-10 w-10 rounded object-cover shrink-0 bg-muted" />
                ) : (
                  <div className="h-10 w-10 rounded shrink-0 bg-muted" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{l.title}</p>
                  <p className="text-xs text-muted-foreground">ID: {l.itemId}</p>
                </div>
                <span className="text-sm font-semibold shrink-0">${l.price.toFixed(2)}</span>
              </label>
            ))}
            {filteredListings.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhum listing encontrado</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
