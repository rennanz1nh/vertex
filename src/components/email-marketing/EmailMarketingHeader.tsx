"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Wifi, WifiOff } from "lucide-react";
import { BrevoLogo } from "@/components/brand-logos";
import { authedFetch } from "@/lib/admin-fetch";

type Status = {
  connected: boolean;
  plan?: { type: string; credits: number }[];
};

/** Title row shared by every Email Marketing tab: Brevo logo + title on the left,
 *  remaining credits + connection status on the right — same row, so the page's
 *  Brevo status is visible without having to open Configurações. */
export function EmailMarketingHeader() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    authedFetch("/api/email-marketing/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ connected: false }));
  }, []);

  const credits = status?.plan?.find((p) => typeof p.credits === "number")?.credits;

  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <BrevoLogo className="h-10 w-10 shrink-0" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Email Marketing</h1>
          <p className="text-muted-foreground text-sm">Contatos, campanhas e automações via Brevo</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {status === null ? (
          <Badge variant="outline" className="gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Carregando...
          </Badge>
        ) : (
          <>
            {typeof credits === "number" && (
              <Badge variant="outline" className="gap-1.5" title="Créditos restantes na conta Brevo">
                <Mail className="h-3 w-3" />
                {credits.toLocaleString("pt-BR")} créditos
              </Badge>
            )}
            <Badge
              variant={status.connected ? "outline" : "destructive"}
              className="gap-1.5"
              title={status.connected ? "Conectado ao Brevo" : "Não conectado ao Brevo"}
            >
              {status.connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {status.connected ? "Conectado" : "Desconectado"}
            </Badge>
          </>
        )}
      </div>
    </div>
  );
}
