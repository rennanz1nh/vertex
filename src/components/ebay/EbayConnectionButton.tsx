"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/admin-fetch";

const ebayLogo = "/images/sales-channels/Ebay.png";

/**
 * Kicks off the eBay OAuth flow via the `ebay-oauth-url` Supabase Edge Function — the only
 * OAuth path left in this app (the old `/api/ebay/auth`/`/api/ebay/callback` Next.js routes
 * were removed: they used a redirect_uri that didn't match what's actually registered for the
 * RuName in eBay's developer portal, so they silently failed to reconnect). The edge function
 * builds the authorize URL server-side with the correct scopes and RuName, and eBay's real
 * registered callback (`ebay-oauth-callback`) does the token exchange and save.
 */
export async function startEbayReconnect(toast: ReturnType<typeof useToast>["toast"]) {
  try {
    const returnTo = typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined;
    const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>("ebay-oauth-url", {
      body: { returnTo },
    });
    if (error || !data?.url) {
      toast({
        title: "Erro ao conectar eBay",
        description: data?.error || error?.message || "Não foi possível obter a URL de autorização",
        variant: "destructive",
      });
      return;
    }
    window.location.href = data.url;
  } catch (err) {
    toast({
      title: "Erro ao conectar eBay",
      description: err instanceof Error ? err.message : String(err),
      variant: "destructive",
    });
  }
}

/**
 * Single "Sincronizar" button shown on the eBay automation pages (and anywhere else that
 * needs a consistent eBay control). Clicking checks the real connection status: if the
 * token is missing or the last refresh genuinely failed, it kicks off reconnection;
 * otherwise it just confirms the account is connected. This replaces the old status
 * button that could get stuck on "Falha - Reconectar" — the /api/ebay/status route now
 * ignores a stale error that predates the last successful token update.
 */
export function EbayConnectionButton() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleSync() {
    setBusy(true);
    try {
      const res = await authedFetch("/api/ebay/status");
      const d = await res.json();
      if (!d.connected || d.lastRefreshError) {
        // Not connected, or the token's last refresh really failed → reconnect.
        await startEbayReconnect(toast);
        return;
      }
      toast({ title: "eBay conectado", description: "Sua conta eBay está conectada e ativa." });
    } catch (err) {
      toast({
        title: "Erro ao verificar eBay",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="outline" className="gap-1.5" type="button" onClick={handleSync} disabled={busy}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ebayLogo} alt="eBay" className="h-4 w-auto object-contain" />
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sincronizar"}
    </Button>
  );
}
