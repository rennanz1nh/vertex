"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Gauge, Loader2, AlertCircle } from "lucide-react";
import { authedFetch } from "@/lib/admin-fetch";

type RateLimit = {
  key: string;
  label: string;
  limit: number;
  used: number;
  remaining: number;
  resetAt: string;
};

function formatReset(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

/** Shared across all eBay automation pages — shows how much of each daily API quota is left. */
export function EbayRateLimitsButton() {
  const [open, setOpen] = useState(false);
  const [limits, setLimits] = useState<RateLimit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleOpen() {
    setOpen(true);
    if (limits) return; // already loaded this session — no need to spend quota re-checking
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch("/api/ebay/rate-limits");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao consultar limites da API");
        return;
      }
      setLimits(data.limits);
    } catch {
      setError("Falha na conexão ao consultar limites da API");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 border-yellow-300 bg-yellow-50 text-yellow-800 hover:bg-yellow-100 hover:text-yellow-900"
        onClick={handleOpen}
      >
        <Gauge className="h-4 w-4" />
        Limites Diários
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              Limites Diários da API do eBay
            </DialogTitle>
            <DialogDescription>Cotas resetam à meia-noite (horário do eBay) — mostrado abaixo em horário de Brasília.</DialogDescription>
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
          ) : limits && limits.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recurso</TableHead>
                  <TableHead className="text-right">Usado / Limite</TableHead>
                  <TableHead className="text-right">Restante</TableHead>
                  <TableHead className="text-right">Reseta em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {limits.map((l) => {
                  const lowQuota = l.remaining <= l.limit * 0.1;
                  return (
                    <TableRow key={l.key}>
                      <TableCell className="text-sm font-medium">{l.label}</TableCell>
                      <TableCell className="text-right text-sm">{l.used.toLocaleString("pt-BR")} / {l.limit.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className={`text-right text-sm font-semibold ${lowQuota ? "text-red-600" : "text-green-600"}`}>
                        {l.remaining.toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{formatReset(l.resetAt)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhum dado de limite disponível</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
