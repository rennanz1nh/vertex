"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, AlertCircle, Link2 } from "lucide-react";
import { authedFetch } from "@/lib/admin-fetch";
import { startEbayReconnect } from "@/components/ebay/EbayConnectionButton";
import { useToast } from "@/hooks/use-toast";

export type EbayListing = { itemId: string; title: string; price: number; imageUrl?: string };

// Fetches and lets the user search/select one of the account's active eBay
// listings. Used both by Listings Automation (pick a listing to translate)
// and Listing Analyser (pick a listing to optimize) — pulled out here so the
// two don't duplicate the same fetch/search/list UI.
export function EbayListingPicker({
  selectedItemId,
  onSelect,
}: {
  selectedItemId: string | null;
  onSelect: (itemId: string) => void;
}) {
  const { toast } = useToast();
  const [listings, setListings] = useState<EbayListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    authedFetch("/api/ebay/listings")
      .then(async (r) => {
        const d = await r.json();
        // Previously this went straight from fetch to setListings(d.listings || [])
        // without ever checking r.ok — a 401/502 response still has a valid JSON body
        // (just no `listings` key), so it silently rendered as "0 listings found"
        // instead of surfacing that the eBay connection needed reconnecting.
        if (!r.ok) {
          setNeedsReconnect(r.status === 401);
          throw new Error(d.error || "Falha ao carregar listings do eBay");
        }
        setListings(d.listings || []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Falha ao carregar listings do eBay"))
      .finally(() => setLoading(false));
  }, []);

  const filteredListings = listings.filter((l) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return l.title.toLowerCase().includes(q) || l.itemId.includes(q);
  });

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
      <div className="border rounded-lg overflow-y-auto max-h-[420px]">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Carregando listings do eBay...</span>
          </div>
        ) : error ? (
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
            {needsReconnect && (
              <Button
                size="sm"
                className="gap-1.5 bg-amber-600 hover:bg-amber-700"
                disabled={connecting}
                onClick={async () => {
                  setConnecting(true);
                  await startEbayReconnect(toast);
                  setConnecting(false);
                }}
              >
                {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                Reconectar eBay
              </Button>
            )}
          </div>
        ) : (
          <>
            {filteredListings.map((l) => (
              <button
                key={l.itemId}
                type="button"
                onClick={() => onSelect(l.itemId)}
                className={`w-full flex items-center gap-3 p-2.5 border-b last:border-0 text-left transition-colors ${
                  selectedItemId === l.itemId ? "bg-accent" : "hover:bg-muted/30"
                }`}
              >
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
              </button>
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
