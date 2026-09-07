"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/admin-fetch";
import { startEbayReconnect } from "@/components/ebay/EbayConnectionButton";

/**
 * Report routes fall back to the last cached payload whenever the live eBay call fails
 * (see withEbayCache) — which hides a genuinely broken connection (refresh_token expired
 * or revoked) behind a small "dados desatualizados" note on each card. Checking
 * /api/ebay/status up front surfaces that as one clear, actionable prompt at the top of
 * the page, so reconnecting happens before anyone has to notice the report went stale.
 */
export function EbayReconnectBanner() {
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authedFetch("/api/ebay/status")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (!d.connected) setError("Conta eBay não conectada.");
        else if (d.lastRefreshError) setError("A última tentativa de renovar a conexão com o eBay falhou.");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!error) return null;

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between gap-3 flex-wrap">
        <span>{error} Os relatórios abaixo podem estar mostrando dados desatualizados até reconectar.</span>
        <Button
          size="sm"
          variant="outline"
          disabled={reconnecting}
          onClick={async () => {
            setReconnecting(true);
            await startEbayReconnect(toast);
            setReconnecting(false);
          }}
        >
          {reconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Reconectar agora"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
