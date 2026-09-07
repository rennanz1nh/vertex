"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/admin-fetch";

const tiktokLogo = "/images/sales-channels/TikTok.png";

/** Kicks off the TikTok Shop OAuth flow via the `tiktok-shop-oauth-url` Supabase Edge
 *  Function — same shape as startEbayReconnect. The edge function builds the
 *  authorize URL server-side with the Partner Center service_id, and TikTok's
 *  registered callback (`tiktok-shop-oauth-callback`) does the token exchange + save. */
export async function startTikTokShopReconnect(toast: ReturnType<typeof useToast>["toast"]) {
  try {
    const returnTo = typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined;
    const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>("tiktok-shop-oauth-url", {
      body: { returnTo },
    });
    if (error || !data?.url) {
      toast({
        title: "Erro ao conectar TikTok Shop",
        description: data?.error || error?.message || "Não foi possível obter a URL de autorização",
        variant: "destructive",
      });
      return;
    }
    window.location.href = data.url;
  } catch (err) {
    toast({
      title: "Erro ao conectar TikTok Shop",
      description: err instanceof Error ? err.message : String(err),
      variant: "destructive",
    });
  }
}

/** Shown on the TikTok Shop automation pages — connection status, with a button to (re)connect. */
export function TikTokShopConnectionButton() {
  const { toast } = useToast();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    authedFetch("/api/tiktok-shop/status")
      .then((r) => r.json())
      .then((d) => {
        setConnected(!!d.connected);
        setRefreshError(d.lastRefreshError ?? null);
      })
      .catch(() => setConnected(false));
  }, []);

  async function handleReconnect() {
    setConnecting(true);
    await startTikTokShopReconnect(toast);
    setConnecting(false);
  }

  if (connected === null) {
    return (
      <Button variant="outline" size="sm" className="gap-1.5" disabled>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={tiktokLogo} alt="TikTok Shop" className="h-4 w-auto object-contain" />
        <Loader2 className="h-3 w-3 animate-spin" />
      </Button>
    );
  }

  if (connected && refreshError) {
    return (
      <Button size="sm" variant="outline" className="gap-1.5" title={refreshError} type="button" onClick={handleReconnect} disabled={connecting}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={tiktokLogo} alt="TikTok Shop" className="h-4 w-auto object-contain" />
        {connecting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Falha - Reconectar"}
      </Button>
    );
  }

  if (connected) {
    return (
      <Button variant="outline" size="sm" className="gap-1.5" type="button">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={tiktokLogo} alt="TikTok Shop" className="h-4 w-auto object-contain" />
        Conectado
      </Button>
    );
  }

  return (
    <Button size="sm" variant="outline" className="gap-1.5" type="button" onClick={handleReconnect} disabled={connecting}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={tiktokLogo} alt="TikTok Shop" className="h-4 w-auto object-contain" />
      {connecting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Desconectado - Conectar"}
    </Button>
  );
}
