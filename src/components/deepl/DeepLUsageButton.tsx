"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Languages, Loader2, AlertCircle } from "lucide-react";
import { authedFetch } from "@/lib/admin-fetch";

type Usage = { characterCount: number; characterLimit: number };

/** Mirrors EbayRateLimitsButton — tracks the DeepL free-tier monthly character quota. */
export function DeepLUsageButton() {
  const [open, setOpen] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleOpen() {
    setOpen(true);
    if (usage) return;
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch("/api/translate/deepl/usage");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao consultar uso do DeepL");
        return;
      }
      setUsage(data);
    } catch {
      setError("Falha na conexão ao consultar uso do DeepL");
    } finally {
      setLoading(false);
    }
  }

  const pct = usage ? Math.min(100, (usage.characterCount / usage.characterLimit) * 100) : 0;
  const lowQuota = pct >= 90;

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={handleOpen}>
        <Languages className="h-4 w-4" />
        Uso do DeepL
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Languages className="h-5 w-5" />
              Uso do DeepL (Tradução)
            </DialogTitle>
            <DialogDescription>Cota gratuita mensal de caracteres traduzidos.</DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Consultando...</span>
            </div>
          ) : usage ? (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold">{usage.characterCount.toLocaleString("pt-BR")}</span>
                <span className="text-sm text-muted-foreground">de {usage.characterLimit.toLocaleString("pt-BR")} caracteres</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${lowQuota ? "bg-red-500" : "bg-black"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className={`text-xs ${lowQuota ? "text-red-600" : "text-muted-foreground"}`}>
                {(100 - pct).toFixed(1)}% restante neste mês
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
