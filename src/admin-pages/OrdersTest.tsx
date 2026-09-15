"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SalesChannelBadge } from "@/components/SalesChannelBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, horizontalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Eye, ExternalLink, Package, GripVertical, Columns3, RefreshCw,
  Search, ArrowUpDown, Settings, Plus, Trash2, Loader2,
  CheckCircle2, Link2, Download, Printer,
} from "lucide-react";
import { getCarrierLogo, getTrackingUrl, detectCarrier } from "@/lib/carrier-utils";
import { parseLocalDate, formatShortDate } from "@/lib/date-utils";
import { isInteractiveClickTarget } from "@/lib/utils";
import { subDays, subMonths, isAfter, startOfDay } from "date-fns";
import BuyLabelDialog from "@/components/shipping/BuyLabelDialog";
import { BoxManagerDialog } from "@/components/shipping/BoxManagerDialog";
import { loadBoxes, type BoxPreset, type ShippoTx } from "@/lib/shippo-types";
import { authedFetch } from "@/lib/admin-fetch";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { ColumnViewButtons } from "@/components/table/ColumnViewButtons";

// ─── Types ────────────────────────────────────────────────────────────────────
type ShippoRawStatus = "DELIVERED" | "TRANSIT" | "PRE_TRANSIT" | "UNKNOWN" | "RETURNED" | "FAILURE" | null;
type DotStatus = "delivered" | "transit" | "not_shipped";

type Order = {
  id: string;
  data_pedido: string;
  numero_pedido_canal: string | null;
  canal: string | null;
  status: string | null;
  total: number | null;
  frete_total: number | null;
  custo_total_shipping: number | null;
  impostos: number | null;
  shipping_tracking: string | null;
  carrier: string | null;
  country: string | null;
  clients: {
    nome_razao: string;
    endereco_rua: string | null;
    endereco_cidade: string | null;
    endereco_estado: string | null;
    endereco_cep: string | null;
    endereco_pais: string | null;
  } | null;
  order_items: {
    quantidade: number;
    preco_unitario: number;
    products: { name: string; image_url: string | null; vin: string | null } | null;
  }[];
};

type RenderCtx = {
  order: Order;
  calc: { qtd: number; primeiraImagem: string | null };
  shippoStatus: ShippoRawStatus;
  labelTx: ShippoTx | null;
  openView: (o: Order) => void;
  openLabel: (o: Order) => void;
};

type ColDef = {
  id: string; label: string; sortable?: boolean;
  headerClassName?: string;
  render: (ctx: RenderCtx) => React.ReactNode;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

function calcOrder(order: Order) {
  const items = order.order_items || [];
  const qtd = items.reduce((s, i) => s + (i.quantidade || 0), 0);
  const primeiraImagem = items.find(i => i.products?.image_url)?.products?.image_url ?? null;
  return { qtd, primeiraImagem };
}

function toDot(status: ShippoRawStatus, hasTracking: boolean): DotStatus {
  if (!hasTracking) return "not_shipped";
  if (status === "DELIVERED") return "delivered";
  // Having a tracking number is proof the order shipped, even when Shippo's live
  // status comes back null/UNKNOWN (carrier lag, rate limit, etc.) — that's never
  // "aguardando envio", so it must not fall back to the same red as no-tracking-at-all.
  return "transit";
}

function dotColor(d: DotStatus) {
  return d === "delivered" ? "bg-green-500" : d === "transit" ? "bg-yellow-400" : "bg-red-500";
}

function dotLabel(d: DotStatus) {
  return d === "delivered" ? "Entregue" : d === "transit" ? "A Caminho" : "Aguardando Envio";
}

// ─── StatusDot ────────────────────────────────────────────────────────────────
function StatusDot({ status, hasTracking, withLabel }: { status: ShippoRawStatus; hasTracking: boolean; withLabel?: boolean }) {
  const d = toDot(status, hasTracking);
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-3 h-3 rounded-full shrink-0 ${dotColor(d)}`} title={dotLabel(d)} />
      {withLabel && <span className="text-xs">{dotLabel(d)}</span>}
    </span>
  );
}

// ─── SortableHeader ───────────────────────────────────────────────────────────
function SortableHeader({ col, children }: { col: ColDef; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id });
  return (
    <TableHead
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={`bg-card ${col.headerClassName ?? ""}`}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          {...attributes} {...listeners}
          aria-label="Arrastar coluna"
        >
          <GripVertical className="h-3 w-3" />
        </button>
        {children}
      </div>
    </TableHead>
  );
}

// ─── ViewDialog (Eye) ─────────────────────────────────────────────────────────

function ViewDialog({ order, labelTx, open, onOpenChange }: {
  order: Order | null; labelTx: ShippoTx | null; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setData(null);
    if (!open || !order?.shipping_tracking) return;
    const controller = new AbortController();
    setLoading(true);
    const carrier = detectCarrier(order.shipping_tracking)?.toLowerCase() ?? order.carrier?.toLowerCase() ?? "usps";
    authedFetch(`/api/shippo/details?tracking=${encodeURIComponent(order.shipping_tracking)}&carrier=${carrier}`, { signal: controller.signal })
      .then(r => r.json()).then(setData)
      .catch(e => { if (e.name !== "AbortError") setData(null); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [open, order]);

  if (!order) return null;
  const calc = calcOrder(order);
  const tracking    = data?.tracking;
  // Use API transaction data when available, fall back to the pre-fetched labelTx
  const transaction = data?.transaction ?? (labelTx ? {
    object_id:             labelTx.object_id,
    status:                labelTx.status,
    tracking_number:       labelTx.tracking_number,
    label_url:             labelTx.label_url,
    tracking_url_provider: labelTx.tracking_url_provider,
    object_created:        labelTx.created,
    rate: {
      provider:        labelTx.carrier,
      servicelevel:    { name: labelTx.service },
      amount:          labelTx.amount,
      currency:        labelTx.currency,
    },
  } : null);
  const rate        = data?.rate;
  const shipment    = data?.shipment;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Detalhes Shippo — {order.clients?.nome_razao || "—"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 text-sm">

          {/* ── Quick label download banner ── */}
          {labelTx?.label_url && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <div className="text-sm">
                <p className="font-semibold text-green-700 dark:text-green-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />Etiqueta disponível
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {labelTx.carrier && <span>{labelTx.carrier} · </span>}
                  {labelTx.service && <span>{labelTx.service} · </span>}
                  {labelTx.amount && <span>{labelTx.currency} {labelTx.amount}</span>}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" asChild>
                  <a href={labelTx.label_url} target="_blank" rel="noopener noreferrer">
                    <Download className="mr-2 h-3.5 w-3.5" />Baixar Etiqueta
                  </a>
                </Button>
                {labelTx.tracking_url_provider && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={labelTx.tracking_url_provider} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />Rastrear
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ── Order Summary ── */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Resumo do Pedido</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <p><span className="text-muted-foreground">Cliente:</span> <strong>{order.clients?.nome_razao || "—"}</strong></p>
                <p><span className="text-muted-foreground">Endereço:</span>{" "}
                  {[order.clients?.endereco_rua, order.clients?.endereco_cidade, order.clients?.endereco_estado, order.clients?.endereco_pais].filter(Boolean).join(", ") || "—"}
                </p>
                <p><span className="text-muted-foreground">Canal:</span> {order.canal || "—"}</p>
                <p><span className="text-muted-foreground">Nº Pedido:</span> {order.numero_pedido_canal || "—"}</p>
              </div>
              <div className="space-y-1.5">
                <p><span className="text-muted-foreground">Total:</span> <strong>{fmt(order.total || 0)}</strong></p>
                <p>
                  <span className="text-muted-foreground">Valor pago pelo envio:</span>{" "}
                  {order.custo_total_shipping
                    ? fmt(order.custo_total_shipping)
                    : labelTx?.amount
                      ? <strong>{labelTx.currency || "USD"} {parseFloat(labelTx.amount).toFixed(2)}</strong>
                      : rate?.amount
                        ? <strong>{rate.currency || "USD"} {parseFloat(rate.amount).toFixed(2)}</strong>
                        : "—"}
                </p>
                <p><span className="text-muted-foreground">Tracking:</span>{" "}
                  <code className="font-mono bg-muted px-1 rounded text-xs">{order.shipping_tracking || "—"}</code>
                </p>
                <p><span className="text-muted-foreground">Itens:</span> {calc.qtd}</p>
              </div>
            </div>
            {order.order_items.length > 0 && (
              <div className="mt-3 border rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted"><tr>
                    <th className="text-left p-2 font-medium">Produto</th>
                    <th className="text-center p-2 font-medium">Qtd</th>
                    <th className="text-right p-2 font-medium">Preço Unit.</th>
                  </tr></thead>
                  <tbody>
                    {order.order_items.flatMap((item, i) =>
                      Array.from({ length: item.quantidade || 1 }, (_, j) => (
                        <tr key={`${i}-${j}`} className="border-t">
                          <td className="p-2 flex items-center gap-2">
                            {item.products?.image_url && (
                              <img src={item.products.image_url} className="h-8 w-8 rounded object-scale-down bg-muted shrink-0" alt="" />
                            )}
                            {item.products?.name || "—"}
                          </td>
                          <td className="p-2 text-center">1</td>
                          <td className="p-2 text-right">{fmt(item.preco_unitario)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── No tracking ── */}
          {!order.shipping_tracking && (
            <div className="p-4 rounded-lg bg-muted/50 text-muted-foreground text-center text-xs">
              Este pedido não possui tracking number — dados Shippo indisponíveis.
            </div>
          )}

          {/* ── Loading ── */}
          {order.shipping_tracking && loading && (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Carregando dados Shippo…</span>
            </div>
          )}

          {/* ── Tracking ── */}
          {tracking && !tracking._error && (
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Rastreio</p>
              <code className="text-[10px] text-muted-foreground mb-3 block">GET /tracks/{"{carrier}"}/{"{tracking_number}"}</code>
              <div className="p-3 rounded-lg border space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  {(() => {
                    const s: ShippoRawStatus = tracking.tracking_status?.status ?? null;
                    const d = toDot(s, true);
                    return (
                      <>
                        <span className={`inline-block w-3 h-3 rounded-full shrink-0 ${dotColor(d)}`} />
                        <span className="font-semibold">{s || "—"}</span>
                        <span className="text-xs text-muted-foreground">({dotLabel(d)})</span>
                      </>
                    );
                  })()}
                  {tracking.eta && <span className="text-xs text-muted-foreground ml-auto">ETA: {new Date(tracking.eta).toLocaleDateString("en-US")}</span>}
                  <span className="text-xs text-muted-foreground">Carrier: <strong>{tracking.carrier}</strong></span>
                </div>
                {tracking.tracking_status?.status_details && (
                  <p className="text-xs text-muted-foreground">{tracking.tracking_status.status_details}</p>
                )}
                {tracking.tracking_history?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Histórico</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {tracking.tracking_history.map((h: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className={`inline-block w-2 h-2 rounded-full mt-1 shrink-0 ${h.status === "DELIVERED" ? "bg-green-500" : h.status === "TRANSIT" ? "bg-yellow-400" : "bg-gray-300"}`} />
                          <div>
                            <span className="font-medium">{h.status}</span>
                            {h.status_details && <span className="text-muted-foreground"> — {h.status_details}</span>}
                            {h.location?.city && <span className="text-muted-foreground"> · {h.location.city}{h.location.state ? `, ${h.location.state}` : ""}</span>}
                            {h.status_date && <span className="text-muted-foreground ml-2">{new Date(h.status_date).toLocaleString("en-US")}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Transaction ── */}
          {transaction && (
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Transação / Label</p>
              <code className="text-[10px] text-muted-foreground mb-3 block">GET /transactions · GET /transactions/{"{id}"}</code>
              <div className="p-3 rounded-lg border space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <p><span className="text-muted-foreground">ID:</span> <code className="font-mono text-xs bg-muted px-1 rounded">{transaction.object_id}</code></p>
                  <p><span className="text-muted-foreground">Status:</span>{" "}
                    <Badge variant={transaction.status === "SUCCESS" ? "default" : "destructive"} className="text-xs">{transaction.status}</Badge>
                  </p>
                  <p><span className="text-muted-foreground">Carrier:</span> {transaction.rate?.provider || "—"}</p>
                  <p><span className="text-muted-foreground">Serviço:</span> {transaction.rate?.servicelevel?.name || "—"}</p>
                  <p><span className="text-muted-foreground">Tracking:</span> <code className="font-mono text-xs">{transaction.tracking_number || "—"}</code></p>
                  <p><span className="text-muted-foreground">Criado:</span> {transaction.object_created ? new Date(transaction.object_created).toLocaleString("en-US") : "—"}</p>
                </div>
                <div className="flex gap-2 pt-1 flex-wrap">
                  {transaction.label_url && (
                    <Button size="sm" asChild>
                      <a href={transaction.label_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-3.5 w-3.5" />Abrir Label PDF
                      </a>
                    </Button>
                  )}
                  {transaction.tracking_url_provider && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={transaction.tracking_url_provider} target="_blank" rel="noopener noreferrer">Rastrear</a>
                    </Button>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ── Rate ── */}
          {rate && !rate._error && (
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Tarifa Utilizada</p>
              <code className="text-[10px] text-muted-foreground mb-3 block">GET /rates/{"{id}"}</code>
              <div className="p-3 rounded-lg border">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <p><span className="text-muted-foreground">Carrier:</span> <strong>{rate.provider || "—"}</strong></p>
                  <p><span className="text-muted-foreground">Serviço:</span> {rate.servicelevel?.name || "—"}</p>
                  <p><span className="text-muted-foreground">Preço:</span> <strong>{rate.currency} {rate.amount}</strong></p>
                  <p><span className="text-muted-foreground">Prazo:</span> {rate.estimated_days != null ? `${rate.estimated_days} dia(s)` : "—"}</p>
                  {rate.duration_terms && <p className="col-span-2 text-muted-foreground text-xs">{rate.duration_terms}</p>}
                </div>
              </div>
            </section>
          )}

          {/* ── Shipment ── */}
          {shipment && !shipment._error && shipment.parcels?.[0] && (
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Pacote</p>
              <div className="p-3 rounded-lg border">
                <p className="text-muted-foreground text-xs">
                  {shipment.parcels[0].length} × {shipment.parcels[0].width} × {shipment.parcels[0].height} {shipment.parcels[0].distance_unit}
                  {" · "}{shipment.parcels[0].weight} {shipment.parcels[0].mass_unit}
                </p>
              </div>
            </section>
          )}

        </div>

        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function OrdersTest() {
  const [orders, setOrders]                       = useState<Order[]>([]);
  const [loading, setLoading]                     = useState(true);
  const [refreshing, setRefreshing]               = useState(false);
  const [shippoStatuses, setShippoStatuses]       = useState<Record<string, ShippoRawStatus>>({});
  const [loadingStatuses, setLoadingStatuses]     = useState(false);
  const [shippoTxMap, setShippoTxMap]             = useState<Record<string, ShippoTx>>({});
  const [loadingLabels, setLoadingLabels]         = useState(false);
  const [searchTerm, setSearchTerm]           = useState("");
  const [periodFilter, setPeriodFilter]       = useState("all");
  const [statusFilter, setStatusFilter]       = useState("all");
  const [sortOrder, setSortOrder]             = useState<"asc" | "desc">("desc");
  const [viewOrder, setViewOrder]             = useState<Order | null>(null);
  const [labelOrder, setLabelOrder]           = useState<Order | null>(null);
  const [showBoxManager, setShowBoxManager]   = useState(false);
  const [boxes, setBoxes]                     = useState<BoxPreset[]>([]);
  const { toast } = useToast();

  useEffect(() => { loadBoxes(authedFetch).then(setBoxes); fetchOrders(); fetchShippoTransactions(); }, []);

  async function fetchOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id, data_pedido, numero_pedido_canal, canal, status, total, frete_total, custo_total_shipping, impostos,
        shipping_tracking, carrier, country,
        clients (nome_razao, endereco_rua, endereco_cidade, endereco_estado, endereco_cep, endereco_pais),
        order_items (quantidade, preco_unitario, products (name, image_url, vin))
      `)
      .order("data_pedido", { ascending: false })
      .limit(50);

    if (!error) {
      const fetched = (data as any) || [];
      setOrders(fetched);
      fetchShippoStatuses(fetched);
    }
    setLoading(false);
  }

  async function fetchShippoTransactions() {
    setLoadingLabels(true);
    try {
      const res = await authedFetch("/api/shippo/transactions-list");
      const data = await res.json();
      if (data.transactions) {
        const map: Record<string, ShippoTx> = {};
        (data.transactions as ShippoTx[]).forEach(tx => {
          if (tx.tracking_number) map[tx.tracking_number] = tx;
        });
        setShippoTxMap(map);
      }
    } catch {
      // silently fail — labels column will show "—"
    } finally {
      setLoadingLabels(false);
    }
  }

  async function fetchShippoStatuses(list: Order[]) {
    const withTracking = list.filter(o => o.shipping_tracking);
    if (!withTracking.length) return;
    setLoadingStatuses(true);
    const results = await Promise.allSettled(
      withTracking.map(async o => {
        const carrier = detectCarrier(o.shipping_tracking!)?.toLowerCase() ?? o.carrier?.toLowerCase() ?? "usps";
        const res = await authedFetch(`/api/shippo/track?carrier=${carrier}&tracking=${encodeURIComponent(o.shipping_tracking!)}`);
        if (!res.ok) return { key: o.shipping_tracking!, status: null as ShippoRawStatus };
        const d = await res.json();
        return { key: o.shipping_tracking!, status: (d.tracking_status?.status ?? null) as ShippoRawStatus };
      })
    );
    const map: Record<string, ShippoRawStatus> = {};
    results.forEach(r => { if (r.status === "fulfilled") map[r.value.key] = r.value.status; });
    setShippoStatuses(map);
    setLoadingStatuses(false);
  }

  async function refresh() {
    setRefreshing(true);
    await Promise.all([fetchOrders(), fetchShippoTransactions()]);
    setRefreshing(false);
    toast({ title: "Atualizado", description: "Lista, status e etiquetas Shippo recarregados." });
  }

  const getDateStart = () => {
    const today = startOfDay(new Date());
    if (periodFilter === "7days")   return subDays(today, 7);
    if (periodFilter === "30days")  return subDays(today, 30);
    if (periodFilter === "1month")  return subMonths(today, 1);
    if (periodFilter === "6months") return subMonths(today, 6);
    return null;
  };

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return orders
      .filter(o => {
        if (term && !o.clients?.nome_razao?.toLowerCase().includes(term) && !o.numero_pedido_canal?.toLowerCase().includes(term) && !o.shipping_tracking?.toLowerCase().includes(term)) return false;
        if (statusFilter !== "all") {
          const dot = toDot(o.shipping_tracking ? (shippoStatuses[o.shipping_tracking] ?? null) : null, !!o.shipping_tracking);
          if (statusFilter !== dot) return false;
        }
        const start = getDateStart();
        if (start && !isAfter(parseLocalDate(o.data_pedido), start)) return false;
        return true;
      })
      .sort((a, b) => {
        const da = parseLocalDate(a.data_pedido).getTime();
        const db = parseLocalDate(b.data_pedido).getTime();
        return sortOrder === "asc" ? da - db : db - da;
      });
  }, [orders, searchTerm, statusFilter, periodFilter, sortOrder, shippoStatuses]);

  // eBay (and most other channels) don't expose a "packing slip" document via API —
  // it's a Seller Hub-only feature — so we render our own from the order data we
  // already have, in the same visual style as the Invoice generator (logo, channel
  // logo, carrier logo), then open the browser print dialog.
  async function handlePrintPackingSlip(order: Order, labelTx: ShippoTx | null) {
    const { printPackingSlip } = await import("@/lib/packing-slip-pdf");
    const c = order.clients;
    const address = [
      c?.endereco_rua,
      [c?.endereco_cidade, c?.endereco_estado, c?.endereco_cep].filter(Boolean).join(", "),
      c?.endereco_pais,
    ].filter(Boolean).join(", ");
    try {
      await printPackingSlip({
        clientName: c?.nome_razao || "Cliente",
        clientAddress: address || undefined,
        orderDate: order.data_pedido,
        orderNumber: order.numero_pedido_canal || order.id.slice(0, 8),
        channel: order.canal,
        items: (order.order_items || []).map((i) => ({
          sku: i.products?.vin,
          name: i.products?.name || "Produto",
          quantity: i.quantidade,
          unitPrice: i.preco_unitario,
          imageUrl: i.products?.image_url,
        })),
        taxes: order.impostos,
        shippingFee: order.frete_total,
        total: order.total,
        shippingTracking: order.shipping_tracking,
        carrier: order.carrier,
        service: labelTx?.service,
      });
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao gerar packing slip", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  }

  // ── Column definitions ────────────────────────────────────────────────────
  const columns: ColDef[] = useMemo(() => [
    {
      id: "data", label: "Data", sortable: true,
      render: ({ order }) => (
        <TableCell className="whitespace-nowrap">
          {formatShortDate(parseLocalDate(order.data_pedido))}
        </TableCell>
      ),
    },
    {
      id: "status", label: "Status",
      render: ({ order, shippoStatus }) => (
        <TableCell className="text-center px-2">
          <StatusDot status={shippoStatus} hasTracking={!!order.shipping_tracking} />
        </TableCell>
      ),
    },
    {
      id: "label", label: "Comprar Etiqueta",
      render: ({ order, labelTx, openLabel }) => (
        <TableCell className="text-center px-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => openLabel(order)}
            title={labelTx ? "Etiqueta já comprada" : "Comprar etiqueta"}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={labelTx ? "/Labelok.png" : "/Label.png"}
              alt={labelTx ? "Etiqueta comprada" : "Comprar etiqueta"}
              className="h-6 w-6 object-contain"
            />
          </Button>
        </TableCell>
      ),
    },
    {
      id: "produto_img", label: "Produto",
      render: ({ calc }) => (
        <TableCell className="p-2 text-center">
          <div className="relative inline-block">
            {calc.primeiraImagem
              ? <img src={calc.primeiraImagem} alt="" className="w-[40px] h-[40px] rounded-md object-scale-down bg-muted" />
              : <div className="w-[40px] h-[40px] rounded-md bg-muted flex items-center justify-center text-muted-foreground font-bold text-[10px]">N/A</div>
            }
            {calc.qtd > 1 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
                {calc.qtd}
              </span>
            )}
          </div>
        </TableCell>
      ),
    },
    {
      id: "qtd", label: "Qtd.",
      render: ({ calc }) => <TableCell className="text-center">{calc.qtd}</TableCell>,
    },
    {
      id: "unit_price", label: "Preço Unit.",
      render: ({ order }) => {
        const totalQty = (order.order_items || []).reduce((s: number, i: any) => s + (i.quantidade || 0), 0);
        const price = totalQty === 1 ? order.order_items[0]?.preco_unitario : null;
        return (
          <TableCell className="text-right whitespace-nowrap">
            {price != null && price > 0
              ? fmt(price)
              : <span className="text-muted-foreground text-xs">—</span>}
          </TableCell>
        );
      },
    },
    {
      id: "cliente", label: "Cliente",
      render: ({ order }) => <TableCell className="whitespace-nowrap font-medium">{order.clients?.nome_razao || "—"}</TableCell>,
    },
    {
      id: "endereco", label: "Endereço",
      render: ({ order }) => {
        const c = order.clients;
        const addr = [c?.endereco_cidade, c?.endereco_estado, c?.endereco_pais].filter(Boolean).join(", ");
        return <TableCell className="max-w-[160px] truncate text-muted-foreground" title={addr}>{addr || "—"}</TableCell>;
      },
    },
    {
      id: "custo_ship", label: "Valor pago pelo envio",
      render: ({ order, labelTx }) => {
        const cost = order.custo_total_shipping
          ? order.custo_total_shipping
          : labelTx?.amount ? parseFloat(labelTx.amount) : null;
        return (
          <TableCell className="text-center whitespace-nowrap text-[#7e7e02]">
            {cost != null ? fmt(cost) : <span className="text-muted-foreground text-xs">—</span>}
          </TableCell>
        );
      },
    },
    {
      id: "carrier", label: "Carrier",
      render: ({ order }) => (
        <TableCell className="text-center">
          {(() => {
            const logo = getCarrierLogo(order.carrier, order.shipping_tracking);
            const lbl = (order.shipping_tracking ? detectCarrier(order.shipping_tracking) : null) ?? order.carrier ?? "";
            return logo
              ? <img src={logo} alt={lbl} className="h-6 w-auto object-contain mx-auto" title={lbl} />
              : <span className="text-muted-foreground text-xs">{lbl || "—"}</span>;
          })()}
        </TableCell>
      ),
    },
    {
      id: "tracking", label: "Shipping Tracking",
      render: ({ order }) => (
        <TableCell className="whitespace-nowrap">
          {order.shipping_tracking ? (
            <div className="flex items-center gap-1 max-w-[130px]">
              <span className="text-[11px] font-mono truncate" title={order.shipping_tracking}>{order.shipping_tracking}</span>
              <Button
                variant="ghost" size="icon" className="h-5 w-5 shrink-0"
                onClick={() => window.open(getTrackingUrl(order.shipping_tracking!, order.carrier), "_blank")}
                title="Rastrear"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          ) : "—"}
        </TableCell>
      ),
    },
    {
      id: "link_plat", label: "Link Plataforma",
      render: ({ order }) => {
        let url: string | null = null;
        if (order.canal === "eBay" && order.numero_pedido_canal)
          url = `https://www.ebay.com/mesh/ord/details?orderId=${encodeURIComponent(order.numero_pedido_canal)}`;
        else if (order.canal === "Amazon" && order.numero_pedido_canal)
          url = `https://sellercentral.amazon.com/orders-v3/order/${order.numero_pedido_canal}`;
        return (
          <TableCell className="text-center px-2">
            {url
              ? <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(url!, "_blank")} title={`Abrir na ${order.canal}`}><Link2 className="h-4 w-4 text-blue-500" /></Button>
              : <span className="text-muted-foreground">—</span>}
          </TableCell>
        );
      },
    },
    {
      id: "shippo_id", label: "Shippo ID",
      render: ({ labelTx }) => (
        <TableCell className="whitespace-nowrap">
          {labelTx?.object_id
            ? <code className="font-mono text-[10px] text-muted-foreground bg-muted px-1 rounded" title={labelTx.object_id}>{labelTx.object_id.slice(0, 8)}…</code>
            : <span className="text-muted-foreground text-xs">—</span>}
        </TableCell>
      ),
    },
    {
      id: "baixar_etiqueta", label: "Baixar Etiqueta",
      render: ({ labelTx }) => {
        if (!labelTx?.label_url) {
          return <TableCell className="text-center px-2"><span className="text-muted-foreground text-xs">—</span></TableCell>;
        }
        return (
          <TableCell className="text-center px-2">
            <div className="flex items-center justify-center gap-1">
              <Button
                variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700"
                onClick={() => window.open(labelTx.label_url!, "_blank")}
                title="Abrir / Baixar Etiqueta (PDF)"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </TableCell>
        );
      },
    },
    {
      id: "pack_slip", label: "Pack Slip",
      render: ({ order, labelTx }) => (
        <TableCell className="text-center px-2">
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => handlePrintPackingSlip(order, labelTx)}
            title="Imprimir Packing Slip"
          >
            <Printer className="h-4 w-4" />
          </Button>
        </TableCell>
      ),
    },
  ], []);

  const defaultOrder = useMemo(() => columns.map(c => c.id), [columns]);
  const {
    columnVisibility: colVis, setColumnVisibility: setColVis, handleDragEnd,
    reset: resetColumns, saveView, isDirty, visibleOrderedIds,
  } = useColumnPreferences('shippo', defaultOrder);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const orderedCols = useMemo(() => {
    const map = new Map(columns.map(c => [c.id, c]));
    return visibleOrderedIds.map(id => map.get(id)).filter((c): c is ColDef => !!c);
  }, [columns, visibleOrderedIds]);

  if (loading) return <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/shippo.png" alt="Shippo" className="h-8 w-auto" />Shipping&apos;s
          </h1>
          <p className="text-muted-foreground mt-1">Geração de etiquetas e rastreio via Shippo API.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="bg-black hover:bg-black/80 text-white" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Atualizando…" : "Atualizar"}
          </Button>
          <Button className="bg-black hover:bg-black/80 text-white" onClick={() => setShowBoxManager(true)}>
            <Settings className="mr-2 h-4 w-4" />Caixas ({boxes.length})
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimos 50 pedidos</CardTitle>
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar pedidos…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="max-w-sm" />
            </div>
            {/* Period */}
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Período" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="7days">Últimos 7 dias</SelectItem>
                <SelectItem value="30days">Últimos 30 dias</SelectItem>
                <SelectItem value="1month">Último mês</SelectItem>
                <SelectItem value="6months">Últimos 6 meses</SelectItem>
              </SelectContent>
            </Select>
            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[190px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="delivered">
                  <span className="flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />Entregue</span>
                </SelectItem>
                <SelectItem value="transit">
                  <span className="flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0" />A Caminho</span>
                </SelectItem>
                <SelectItem value="not_shipped">
                  <span className="flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />Aguardando Envio</span>
                </SelectItem>
              </SelectContent>
            </Select>
            {/* Columns */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm"><Columns3 className="mr-2 h-4 w-4" />Colunas</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-[400px] overflow-y-auto w-56 bg-popover">
                <DropdownMenuLabel>Mostrar colunas</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columns.map(col => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={colVis[col.id] !== false}
                    onCheckedChange={v => setColVis(p => ({ ...p, [col.id]: !!v }))}
                    onSelect={e => e.preventDefault()}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <ColumnViewButtons isDirty={isDirty} onSave={saveView} onReset={resetColumns} />
            {(loadingStatuses || loadingLabels) && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {loadingLabels ? "Carregando etiquetas Shippo…" : "Consultando status Shippo…"}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Dica: arraste o ícone <GripVertical className="inline h-3 w-3" /> ao lado de cada coluna para reordenar.
          </p>
        </CardHeader>
        <CardContent>
          <div className="relative w-full max-h-[calc(100vh-320px)] overflow-x-scroll overflow-y-auto scrollbar-always">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <Table>
                <TableHeader className="sticky top-0 bg-card z-20 shadow-sm">
                  <TableRow className="border-b-2 text-xs">
                    <SortableContext items={orderedCols.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                      {orderedCols.map(col => (
                        <SortableHeader key={col.id} col={col}>
                          {col.sortable
                            ? <button type="button" className="flex items-center gap-1" onClick={() => setSortOrder(s => s === "asc" ? "desc" : "asc")}>
                                {col.label}<ArrowUpDown className="h-3 w-3 text-primary" />
                              </button>
                            : <span>{col.label}</span>}
                        </SortableHeader>
                      ))}
                    </SortableContext>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(order => {
                    const calc = calcOrder(order);
                    const shippoStatus = order.shipping_tracking ? (shippoStatuses[order.shipping_tracking] ?? null) : null;
                    const labelTx = order.shipping_tracking ? (shippoTxMap[order.shipping_tracking] ?? null) : null;
                    return (
                      <TableRow
                        key={order.id}
                        className="text-xs cursor-pointer"
                        onClick={(e) => { if (!isInteractiveClickTarget(e)) setViewOrder(order); }}
                      >
                        {orderedCols.map(col => (
                          <React.Fragment key={col.id}>
                            {col.render({ order, calc, shippoStatus, labelTx, openView: setViewOrder, openLabel: setLabelOrder })}
                          </React.Fragment>
                        ))}
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={orderedCols.length} className="text-center py-10 text-muted-foreground">
                        Nenhum pedido encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </DndContext>
          </div>
        </CardContent>
      </Card>

      <BoxManagerDialog open={showBoxManager} onOpenChange={setShowBoxManager} boxes={boxes} onChange={setBoxes} />
      <BuyLabelDialog
        order={labelOrder}
        labelTx={labelOrder?.shipping_tracking ? (shippoTxMap[labelOrder.shipping_tracking] ?? null) : null}
        open={!!labelOrder}
        onOpenChange={v => { if (!v) setLabelOrder(null); }}
        onSuccess={fetchOrders}
      />
      <ViewDialog
        order={viewOrder}
        labelTx={viewOrder?.shipping_tracking ? (shippoTxMap[viewOrder.shipping_tracking] ?? null) : null}
        open={!!viewOrder}
        onOpenChange={v => { if (!v) setViewOrder(null); }}
      />
    </div>
  );
}
