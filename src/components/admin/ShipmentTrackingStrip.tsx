"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { detectCarrier } from "@/lib/carrier-utils";
import { parseLocalDate } from "@/lib/date-utils";
import { Truck, CheckCircle2, AlertTriangle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { authedFetch } from "@/lib/admin-fetch";

type ShippoRawStatus = "DELIVERED" | "TRANSIT" | "PRE_TRANSIT" | "UNKNOWN" | "RETURNED" | "FAILURE" | null;
type Bucket = "transit" | "delivered" | "problem";

type TrackedOrder = {
  id: string;
  numero_pedido_canal: string | null;
  canal: string | null;
  status: string | null;
  shipping_tracking: string;
  carrier: string | null;
  data_pedido: string;
  clientName: string | null;
  bucket: Bucket;
  sinceDays: number;
  statusLabel: string;
};

const DELIVERED_VISIBLE_DAYS = 3;
const LOOKBACK_DAYS = 45;

type OrderRow = {
  id: string;
  numero_pedido_canal: string | null;
  canal: string | null;
  status: string | null;
  shipping_tracking: string;
  carrier: string | null;
  data_pedido: string;
  clients: { nome_razao: string | null } | null;
};

function daysSince(date: Date): number {
  const ms = Date.now() - date.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Top-of-Dashboard operational strip: how many orders are currently in transit,
 * how many were delivered recently (fall off after DELIVERED_VISIBLE_DAYS), and how
 * many hit a real delivery problem — straight from Shippo's tracking status, the
 * same source used on Pedidos/Shipping's, not just the order's own `status` field
 * (which our sync never flips to "problem" — eBay/TikTok never send that back to us).
 */
export function ShipmentTrackingStrip() {
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openBucket, setOpenBucket] = useState<Bucket | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, numero_pedido_canal, canal, status, shipping_tracking, carrier, data_pedido, clients(nome_razao)")
        .order("data_pedido", { ascending: false })
        .limit(500);

      if (error) {
        console.error("ShipmentTrackingStrip: failed to load orders", error);
        if (!cancelled) setLoadError(error.message);
      }
      if (error || !data || cancelled) {
        setLoading(false);
        return;
      }

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);

      const matching = (data as unknown as OrderRow[]).filter((o) => {
        // Any order with a tracking number is a real shipment worth watching — not just
        // ones whose internal `status` already says "Enviado"/"Entregue". A label can be
        // bought (status stuck at "Orçado"/"Pronto para Envio") and already be moving
        // per the carrier before our own status field catches up.
        if (o.status === "Cancelado") return false;
        if (!o.shipping_tracking) return false;
        return parseLocalDate(o.data_pedido) >= cutoff;
      });

      const results = await Promise.allSettled(
        matching.map(async (o) => {
          // Baseline, always available: our own order status. This alone must be
          // enough to place the order in "A caminho"/"Entregues" — the live Shippo
          // call below can only refine it (e.g. detect a real delivery problem),
          // never be the reason an order disappears if that call fails.
          let bucket: Bucket = o.status === "Entregue" ? "delivered" : "transit";
          let statusLabel = bucket === "delivered" ? "Entregue" : "Em trânsito";
          let anchor = parseLocalDate(o.data_pedido);

          try {
            const carrier = (detectCarrier(o.shipping_tracking) ?? o.carrier ?? "USPS").toLowerCase();
            const res = await authedFetch(`/api/shippo/track?carrier=${carrier}&tracking=${encodeURIComponent(o.shipping_tracking)}`);
            if (res.ok) {
              const trackingStatus = (await res.json())?.tracking_status;
              const raw: ShippoRawStatus = trackingStatus?.status ?? null;
              if (raw === "FAILURE" || raw === "RETURNED") {
                bucket = "problem";
                statusLabel = raw === "RETURNED" ? "Devolvido ao remetente" : "Tentativa de entrega falhou";
              } else if (raw === "DELIVERED") {
                bucket = "delivered";
                statusLabel = "Entregue";
                // Shippo timestamps the moment it detected delivery — the real delivery
                // date, not our order date — so the 3-day cutoff is measured from here
                // whenever Shippo gives it to us.
                if (trackingStatus?.status_date) anchor = new Date(trackingStatus.status_date);
              } else if (raw === "TRANSIT" || raw === "PRE_TRANSIT") {
                bucket = "transit";
                statusLabel = raw === "PRE_TRANSIT" ? "Etiqueta gerada, aguardando coleta" : "Em trânsito";
              }
            }
          } catch {
            // Live tracking unavailable (network hiccup, carrier lookup failed, etc.) —
            // keep the baseline from order.status above instead of losing the order.
          }

          const sinceDays = daysSince(anchor);
          if (bucket === "delivered" && sinceDays > DELIVERED_VISIBLE_DAYS) return null;

          const row: TrackedOrder = {
            id: o.id,
            numero_pedido_canal: o.numero_pedido_canal,
            canal: o.canal,
            status: o.status,
            shipping_tracking: o.shipping_tracking,
            carrier: o.carrier,
            data_pedido: o.data_pedido,
            clientName: o.clients?.nome_razao ?? null,
            bucket,
            sinceDays,
            statusLabel,
          };
          return row;
        })
      );

      if (cancelled) return;
      const rows = results
        .filter((r): r is PromiseFulfilledResult<TrackedOrder | null> => r.status === "fulfilled")
        .map((r) => r.value)
        .filter((r): r is TrackedOrder => r !== null);

      setOrders(rows);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const g: Record<Bucket, TrackedOrder[]> = { transit: [], delivered: [], problem: [] };
    for (const o of orders) g[o.bucket].push(o);
    return g;
  }, [orders]);

  if (loading) {
    return (
      <div className="flex gap-3 flex-wrap animate-pulse">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex-1 min-w-[220px] h-[64px] rounded-lg border bg-muted/40" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        Não foi possível carregar o acompanhamento de envios: {loadError}
      </div>
    );
  }

  const chips: { bucket: Bucket; label: string; icon: typeof Truck; iconClass: string; countClass: string }[] = [
    { bucket: "transit", label: "A caminho", icon: Truck, iconClass: "bg-blue-50 text-blue-600", countClass: "" },
    { bucket: "delivered", label: `Entregues (últimos ${DELIVERED_VISIBLE_DAYS} dias)`, icon: CheckCircle2, iconClass: "bg-green-50 text-green-600", countClass: "" },
    { bucket: "problem", label: "Com problema", icon: AlertTriangle, iconClass: "bg-destructive/10 text-destructive", countClass: "text-destructive" },
  ];

  return (
    <div>
      <div className="flex gap-3 flex-wrap">
        {chips.map((c) => {
          const Icon = c.icon;
          const items = grouped[c.bucket];
          const isOpen = openBucket === c.bucket;
          return (
            <button
              key={c.bucket}
              type="button"
              onClick={() => setOpenBucket(isOpen ? null : c.bucket)}
              aria-expanded={isOpen}
              className={cn(
                "flex-1 min-w-[220px] flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:border-muted-foreground/30",
                isOpen && "border-muted-foreground/40 shadow-sm"
              )}
            >
              <span className={cn("h-[34px] w-[34px] rounded-lg flex items-center justify-center shrink-0", c.iconClass)}>
                <Icon className="h-[17px] w-[17px]" />
              </span>
              <span className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">{c.label}</div>
                <div className={cn("text-xl font-bold", c.countClass)}>{items.length}</div>
              </span>
              <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground/60 transition-transform shrink-0", isOpen && "rotate-180")} />
            </button>
          );
        })}
      </div>

      {openBucket && (
        <div className="mt-2.5 border rounded-lg overflow-hidden bg-card">
          {grouped[openBucket].length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">Nenhum pedido nesta categoria</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Pedido</th>
                  <th className="text-left font-medium px-4 py-2">Cliente</th>
                  <th className="text-left font-medium px-4 py-2">Canal</th>
                  <th className="text-left font-medium px-4 py-2">Rastreio</th>
                  <th className="text-right font-medium px-4 py-2">
                    {openBucket === "delivered" ? "Entregue há" : openBucket === "problem" ? "Desde" : "Trânsito"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {grouped[openBucket].map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="px-4 py-2 font-medium tabular-nums">#{o.numero_pedido_canal ?? o.id.slice(0, 8)}</td>
                    <td className="px-4 py-2">{o.clientName ?? "—"}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{o.canal}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {o.carrier ?? detectCarrier(o.shipping_tracking) ?? ""} · {o.statusLabel}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">
                      {o.sinceDays === 0 ? "hoje" : `${o.sinceDays} dia${o.sinceDays > 1 ? "s" : ""}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
