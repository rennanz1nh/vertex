import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Trash2, CheckSquare, Edit, ArrowUpDown, CreditCard, ExternalLink, Columns3, GripVertical, RefreshCw, DollarSign, Link2, Download, Printer, Settings, AlertTriangle } from 'lucide-react';
import BuyLabelDialog from '@/components/shipping/BuyLabelDialog';
import { BoxManagerDialog } from '@/components/shipping/BoxManagerDialog';
import { loadBoxes, type BoxPreset, type ShippoTx } from '@/lib/shippo-types';
import { authedFetch } from '@/lib/admin-fetch';
import { calcularPedidoFromDbOrder } from '@/lib/order-calc';
import { AmazonOrderUploadDialog } from '@/components/orders/AmazonOrderUploadDialog';
import { startEbayReconnect } from '@/components/ebay/EbayConnectionButton';

import { SquareFlag } from '@/components/SquareFlag';

// Uniform flag: every flag sits in the same fixed rectangle (contain, no crop/distortion).
function CountryFlag({ code }: { code: string }) {
  return <SquareFlag code={code} className="h-4 w-6" />;
}

// ─── Shippo-based status dot (same source/logic as the Shipping's page) ──────────────
type ShippoRawStatus = "DELIVERED" | "TRANSIT" | "PRE_TRANSIT" | "UNKNOWN" | "RETURNED" | "FAILURE" | null;
type ShippoDotStatus = "delivered" | "transit" | "not_shipped";

function shippoToDot(status: ShippoRawStatus, hasTracking: boolean): ShippoDotStatus {
  if (!hasTracking) return "not_shipped";
  if (status === "DELIVERED") return "delivered";
  if (status === "TRANSIT" || status === "PRE_TRANSIT") return "transit";
  return "not_shipped";
}
function shippoDotColor(d: ShippoDotStatus) {
  return d === "delivered" ? "bg-green-500" : d === "transit" ? "bg-yellow-400" : "bg-red-500";
}
function shippoDotLabel(d: ShippoDotStatus) {
  return d === "delivered" ? "Entregue" : d === "transit" ? "A Caminho" : "Aguardando Envio";
}
/** Fallback for orders with no Shippo tracking (e.g. Amazon imports, which carry a
 *  fulfillment status but no label of ours): colour the dot by the order's own status
 *  instead of always showing red, which read as "nothing shipped" for every such order. */
function orderStatusToDot(orderStatus: string | null | undefined): { dot: ShippoDotStatus; label: string } {
  switch (orderStatus) {
    case 'Entregue': return { dot: 'delivered', label: 'Entregue' };
    case 'Enviado': return { dot: 'delivered', label: 'Enviado' };
    // "Pronto para Envio"/"Pago" mean a label may exist but nothing has actually shipped
    // yet — that's "Aguardando Envio" (red), not "A Caminho" (yellow, reserved for a real
    // in-transit shipment).
    case 'Pronto para Envio': return { dot: 'not_shipped', label: 'Pronto para Envio' };
    case 'Pago': return { dot: 'not_shipped', label: 'Pago' };
    case 'Cancelado': return { dot: 'not_shipped', label: 'Cancelado' };
    case 'Orçado': return { dot: 'not_shipped', label: 'Orçado' };
    default: return { dot: 'not_shipped', label: 'Aguardando Envio' };
  }
}
/** Shippo only has a real opinion when it returned one of these — DELIVERED/TRANSIT/
 *  PRE_TRANSIT (a live shipment) or FAILURE/RETURNED (a real problem). `null`/`UNKNOWN`
 *  just means Shippo has nothing (old order past its retention window, malformed tracking
 *  number, etc.) — not "not shipped", so it must NOT force a red dot on its own. */
function hasRealShippoSignal(status: ShippoRawStatus): boolean {
  return status === 'DELIVERED' || status === 'TRANSIT' || status === 'PRE_TRANSIT' || status === 'FAILURE' || status === 'RETURNED';
}
function resolveDot(status: ShippoRawStatus, hasTracking: boolean, orderStatus?: string | null): { dot: ShippoDotStatus; label: string } {
  if (hasTracking && hasRealShippoSignal(status)) {
    const d = shippoToDot(status, true);
    return { dot: d, label: shippoDotLabel(d) };
  }
  // No real live signal (or no tracking at all) — trust our own order status instead
  // of showing a misleading red "not shipped" for something we already know shipped.
  return orderStatusToDot(orderStatus);
}
function ShippoStatusDot({ status, hasTracking, orderStatus }: { status: ShippoRawStatus; hasTracking: boolean; orderStatus?: string | null }) {
  const { dot, label } = resolveDot(status, hasTracking, orderStatus);
  return <span title={label} className={`inline-block w-3 h-3 rounded-full shrink-0 ${shippoDotColor(dot)}`} />;
}
import { getCarrierLogo, getTrackingUrl, detectCarrier } from '@/lib/carrier-utils';
const amazonLogo = '/images/sales-channels/Amazon.png';
const ebayLogo = '/images/sales-channels/Ebay.png';
const etsyLogo = '/images/sales-channels/Etsy.png';
const tiktokLogo = '/images/sales-channels/TikTok.png';
const zelleLogo = '/images/sales-channels/Zelle.png';
const whatsappLogo = '/images/sales-channels/Whatsapp.png';
const cosmeticMpLogo = '/images/sales-channels/Vertex_Rental_Cars.png';
import { SalesChannelBadge } from '@/components/SalesChannelBadge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { OrderForm } from '@/components/OrderForm';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { subDays, subMonths, isAfter, startOfDay } from 'date-fns';
import { parseLocalDate, formatShortDate } from '@/lib/date-utils';
import { triggerAutomaticEmail } from '@/lib/automatic-emails-client';
import { isInteractiveClickTarget, cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useColumnPreferences } from '@/hooks/useColumnPreferences';
import { ColumnViewButtons } from '@/components/table/ColumnViewButtons';

type ColumnDef = {
  id: string;
  label: string;
  sortable?: 'data' | 'canal';
  headerClassName?: string;
  render: (ctx: {
    order: any;
    calculated: ReturnType<any>;
    valorUnitarioMedio: number;
    formatCurrency: (v: number) => string;
    openOrderView: (id: string) => void;
    shippoStatus: ShippoRawStatus;
    labelTx: ShippoTx | null;
    openLabel: (order: any) => void;
    printPackingSlip: (order: any, labelTx: ShippoTx | null) => void;
  }) => React.ReactNode;
  cellClassName?: string;
};

// Sortable header cell
function SortableHeader({
  col,
  children,
}: {
  col: ColumnDef;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <TableHead ref={setNodeRef} style={style} className={`bg-card ${col.headerClassName || ''}`}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-muted-foreground font-bold hover:text-foreground touch-none"
          {...attributes}
          {...listeners}
          aria-label="Arrastar coluna"
        >
          <GripVertical className="h-3 w-3" />
        </button>
        {children}
      </div>
    </TableHead>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [ebayConnected, setEbayConnected] = useState<boolean | null>(null);
  const [shippoStatuses, setShippoStatuses] = useState<Record<string, ShippoRawStatus>>({});
  const [shippoTxMap, setShippoTxMap] = useState<Record<string, ShippoTx>>({});
  const [loadingLabels, setLoadingLabels] = useState(false);
  const [labelOrder, setLabelOrder] = useState<any>(null);
  const [amazonUploadOpen, setAmazonUploadOpen] = useState(false);
  const [boxes, setBoxes] = useState<BoxPreset[]>([]);
  const [showBoxManager, setShowBoxManager] = useState(false);

  useEffect(() => {
    loadBoxes(authedFetch).then(setBoxes);
    checkEbayConnection();
    const params = new URLSearchParams(window.location.search);
    if (params.get('ebay_connected') === 'true') {
      toast({ title: 'eBay conectado!', description: 'Sua conta eBay foi autorizada com sucesso.' });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('ebay_error')) {
      toast({ title: 'Erro ao conectar eBay', description: decodeURIComponent(params.get('ebay_error')!), variant: 'destructive' });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Mirrors EbayConnectionButton's own check (connected AND no active refresh error) —
  // a row existing isn't enough, since a broken/downgraded token still leaves the row in
  // place. Previously this only checked row presence, so a stale-but-present token never
  // routed back into reconnect from here.
  const checkEbayConnection = async () => {
    try {
      const res = await authedFetch('/api/ebay/status');
      const d = await res.json();
      setEbayConnected(!!d.connected && !d.lastRefreshError);
    } catch {
      setEbayConnected(false);
    }
  };

  // Filter states
  const [sortBy, setSortBy] = useState<'data' | 'canal'>('data');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const channelOptions = [
    { value: 'all', label: 'Todos os Canais', icon: null },
    // Marketplaces primeiro
    { value: 'Amazon', label: 'Amazon', icon: <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Amazon_logo.svg/1280px-Amazon_logo.svg.png" alt="Amazon" className="h-5 w-5 object-contain" /> },
    { value: 'eBay', label: 'eBay', icon: <img src={ebayLogo} alt="eBay" className="h-5 w-5 object-contain" /> },
    { value: 'Etsy', label: 'Etsy', icon: <img src={etsyLogo} alt="Etsy" className="h-5 w-5 object-contain" /> },
    { value: 'TikTok', label: 'TikTok', icon: <img src={tiktokLogo} alt="TikTok" className="h-5 w-5 object-contain" /> },
    { value: 'Vertex Rental Cars', label: 'Cosmetic MP', icon: <img src={cosmeticMpLogo} alt="Vertex Rental Cars" className="h-5 w-5 object-contain" /> },
    // Não-marketplace por último
    { value: 'Zelle', label: 'Zelle', icon: <img src={zelleLogo} alt="Zelle" className="h-5 w-5 object-contain" /> },
    { value: 'WhatsApp', label: 'WhatsApp', icon: <img src={whatsappLogo} alt="WhatsApp" className="h-5 w-5 object-contain" /> },
    { value: 'Credit Card / Presencial', label: 'Credit Card / Presencial', icon: <CreditCard className="h-4 w-4" /> },
    { value: 'Money / Presencial', label: 'Money / Presencial', icon: <DollarSign className="h-4 w-4" /> },
    { value: 'Outro', label: 'Outro', icon: null },
  ];
  const mapTrackingStatusToOrderStatus = (trackingStatus: string) => {
    switch (trackingStatus) {
      case 'Delivered':
        return 'Entregue';
      case 'Pre-Shipment':
        return 'Pago';
      case 'In Transit':
      case 'Out for Delivery':
        return 'Enviado';
      default:
        return null;
    }
  };

  const checkTrackingStatuses = async (ordersToCheck: any[]) => {
    const ordersWithTracking = ordersToCheck.filter(
      (o: any) => o.shipping_tracking && o.status !== 'Entregue' && o.status !== 'Cancelado' && detectCarrier(o.shipping_tracking) === 'USPS'
    );
    if (ordersWithTracking.length === 0) return;

    const updates: { id: string; newStatus: string }[] = [];

    await Promise.all(
      ordersWithTracking.map(async (order: any) => {
        try {
          const { data, error } = await supabase.functions.invoke('usps-tracking', {
            body: { tracking_number: order.shipping_tracking },
          });
          if (error || !data || data.status === 'error') {
            return;
          }
          // USPS's legacy TrackV2 API is unreliable for tracking numbers created moments
          // ago — it can report "Delivered" with zero supporting scan events, which is a
          // false positive (no scan happened yet, the API just returned junk). Only trust
          // a status when there's at least one real event backing it up.
          if (!Array.isArray(data.events) || data.events.length === 0) {
            return;
          }
          const mappedStatus = mapTrackingStatusToOrderStatus(data.status);
          if (mappedStatus && mappedStatus !== order.status) {
            updates.push({ id: order.id, newStatus: mappedStatus });
          } else if (!mappedStatus) {
            console.warn('Unmapped USPS status', data.status, 'for', order.shipping_tracking);
          }
        } catch (e) {
          console.error('Tracking check failed for', order.shipping_tracking, e);
        }
      })
    );

    if (updates.length > 0) {
      await Promise.all(
        updates.map(({ id, newStatus }) =>
          supabase.from('orders').update({ status: newStatus as any }).eq('id', id)
        )
      );
      toast({
        title: "Status atualizado",
        description: `${updates.length} pedido(s) tiveram o rastreio atualizado automaticamente`,
      });
      await fetchOrders();
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchClients();
    fetchShippoTransactions();
    // Refresh orders every 5 minutes (shipping status doesn't change fast, and each
    // refresh fires the whole Shippo-check burst), and pause entirely while the tab is
    // hidden so a backgrounded admin tab doesn't keep hitting the API (and Vercel).
    let intervalId: number | null = null;
    const start = () => { if (intervalId === null) intervalId = window.setInterval(() => fetchOrders(), 300000); };
    const stop = () => { if (intervalId !== null) { window.clearInterval(intervalId); intervalId = null; } };
    const onVisibility = () => { if (document.hidden) stop(); else { fetchOrders(); start(); } };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  const fetchShippoTransactions = async () => {
    setLoadingLabels(true);
    try {
      const res = await authedFetch('/api/shippo/transactions-list');
      const data = await res.json();
      if (data.transactions) {
        const map: Record<string, ShippoTx> = {};
        (data.transactions as ShippoTx[]).forEach((tx) => {
          if (tx.tracking_number) map[tx.tracking_number] = tx;
        });
        setShippoTxMap(map);
      }
    } catch {
      // silently fail — label-related columns just show "—"
    } finally {
      setLoadingLabels(false);
    }
  };
  const fetchClients = async () => {
    try {
      const { data, error } = await supabase.from('clients').select('id, nome_razao').order('nome_razao');
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };
  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase.from('orders').select(`
          *,
          clients (nome_razao, telefone, email, endereco_rua, endereco_cidade, endereco_estado, endereco_cep, endereco_pais),
          order_items (
            quantidade,
            preco_unitario,
            custo_unitario,
            products (
              "Produto Nome",
              "Marca",
              image_url,
              "SKU",
              "ASIN"
            )
          )
        `).order('data_pedido', { ascending: false });
      if (error) throw error;
      setOrders(data || []);
      if (data && data.length > 0) {
        checkTrackingStatuses(data);
        fetchShippoStatuses(data);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  // Live shipment status straight from Shippo (same source/logic as the Shipping's page) —
  // separate from `order.status` (eBay-derived) and from the USPS-only checkTrackingStatuses above.
  // Only polls orders that can still change (skips Entregue/Cancelado): once an order is
  // resolved we trust our own status forever, which also avoids the false red dot Shippo
  // produces for old orders that dropped out of its tracking-history retention window.
  const fetchShippoStatuses = async (list: any[]) => {
    // Also bounded to the last 60 days — polling every ancient "Enviado" order on every
    // page load fires dozens of parallel Shippo requests (most for tracking numbers too
    // old for Shippo's retention to even have data for), which risks rate-limiting the
    // handful of genuinely recent/active ones sharing the same Promise.allSettled batch.
    const trackingCutoff = new Date();
    trackingCutoff.setDate(trackingCutoff.getDate() - 60);
    const withTracking = list.filter(o =>
      o.shipping_tracking && o.status !== 'Entregue' && o.status !== 'Cancelado' &&
      parseLocalDate(o.data_pedido) >= trackingCutoff
    );
    if (!withTracking.length) return;
    // Capped concurrency instead of firing every request at once: browsers queue same-origin
    // connections anyway (~6 at a time), so a burst of dozens doesn't finish any faster — it
    // just saturates the pool and stalls every other request the page needs (images, other
    // API calls), which is what was making pages feel like they never finished loading.
    const CONCURRENCY = 6;
    const queue = [...withTracking];
    const shippoResults: { id: string; key: string; status: ShippoRawStatus }[] = [];
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        let o: any;
        while ((o = queue.shift())) {
          const carrier = detectCarrier(o.shipping_tracking)?.toLowerCase() ?? o.carrier?.toLowerCase() ?? 'usps';
          try {
            const res = await authedFetch(`/api/shippo/track?carrier=${carrier}&tracking=${encodeURIComponent(o.shipping_tracking)}`);
            const status = res.ok ? ((await res.json())?.tracking_status?.status ?? null) : null;
            shippoResults.push({ id: o.id, key: o.shipping_tracking as string, status });
          } catch {
            shippoResults.push({ id: o.id, key: o.shipping_tracking as string, status: null });
          }
        }
      })
    );
    const results = shippoResults.map(r => ({ status: 'fulfilled' as const, value: r }));
    const byId = new Map(withTracking.map((o: any) => [o.id, o]));
    const map: Record<string, ShippoRawStatus> = {};
    const deliveredIds: string[] = [];
    const shippedIds: string[] = [];
    // A label being bought (Orçado/Pronto para Envio/Pago) never advances `status` to
    // "Enviado" by itself — only the carrier actually picking up the package proves it
    // shipped, which is exactly what a live TRANSIT/PRE_TRANSIT reading confirms.
    const preShipStatuses = new Set(['Orçado', 'Pronto para Envio', 'Pago']);
    results.forEach(r => {
      if (r.status !== 'fulfilled') return;
      map[r.value.key] = r.value.status;
      if (r.value.status === 'DELIVERED') deliveredIds.push(r.value.id);
      else if (
        (r.value.status === 'TRANSIT' || r.value.status === 'PRE_TRANSIT') &&
        preShipStatuses.has(byId.get(r.value.id)?.status)
      ) {
        shippedIds.push(r.value.id);
      }
    });
    setShippoStatuses(prev => ({ ...prev, ...map }));

    // Any carrier, not just USPS (checkTrackingStatuses above only covers USPS) — the
    // carrier confirmed delivery/pickup, so our own status field should reflect it too.
    if (deliveredIds.length > 0) {
      const res = await Promise.all(deliveredIds.map(id => supabase.from('orders').update({ status: 'Entregue' as any }).eq('id', id)));
      res.forEach((r, i) => { if (r.error) console.error('Failed to sync order to Entregue', deliveredIds[i], r.error); });
      setOrders((prev: any[]) => prev.map(o => (deliveredIds.includes(o.id) ? { ...o, status: 'Entregue' } : o)));
      deliveredIds.forEach(id => triggerAutomaticEmail('order_delivered', id));
    }
    if (shippedIds.length > 0) {
      const res = await Promise.all(shippedIds.map(id => supabase.from('orders').update({ status: 'Enviado' as any }).eq('id', id)));
      res.forEach((r, i) => { if (r.error) console.error('Failed to sync order to Enviado', shippedIds[i], r.error); });
      setOrders((prev: any[]) => prev.map(o => (shippedIds.includes(o.id) ? { ...o, status: 'Enviado' } : o)));
      shippedIds.forEach(id => triggerAutomaticEmail('order_shipped', id));
    }
    if (deliveredIds.length > 0 || shippedIds.length > 0) {
      const parts = [];
      if (shippedIds.length) parts.push(`${shippedIds.length} para Enviado`);
      if (deliveredIds.length) parts.push(`${deliveredIds.length} para Entregue`);
      toast({
        title: "Status atualizado",
        description: `${parts.join(', ')} (confirmado pela transportadora)`,
      });
    }
  };

  const toggleSelection = (orderId: string) => {
    setSelectedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };
  const handleDeleteSelected = async () => {
    if (selectedOrders.size === 0) return;
    try {
      const deletePromises = Array.from(selectedOrders).map(id => supabase.from('orders').delete().eq('id', id));
      await Promise.all(deletePromises);
      toast({ title: "Sucesso", description: `${selectedOrders.size} pedido(s) deletado(s)` });
      setSelectedOrders(new Set());
      setSelectionMode(false);
      await fetchOrders();
    } catch (error) {
      console.error('Error deleting orders:', error);
      toast({ title: "Erro", description: "Erro ao deletar pedidos", variant: "destructive" });
    }
  };
  const getDateFilterStart = () => {
    const today = startOfDay(new Date());
    switch (periodFilter) {
      case '7days': return subDays(today, 7);
      case '30days': return subDays(today, 30);
      case '1month': return subMonths(today, 1);
      case '6months': return subMonths(today, 6);
      default: return null;
    }
  };
  const filteredAndSortedOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let result = orders.filter((order: any) => {
      if (!term) return true;
      return (
        order.clients?.nome_razao?.toLowerCase().includes(term) ||
        order.numero_pedido_canal?.toLowerCase().includes(term)
      );
    });
    if (channelFilter !== 'all') {
      result = result.filter((order: any) => order.canal === channelFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter((order: any) => {
        const rawStatus = order.shipping_tracking ? (shippoStatuses[order.shipping_tracking] ?? null) : null;
        const { dot } = resolveDot(rawStatus, !!order.shipping_tracking, order.status);
        return statusFilter === dot;
      });
    }
    const filterStart = getDateFilterStart();
    if (filterStart) {
      result = result.filter((order: any) => isAfter(parseLocalDate(order.data_pedido), filterStart));
    }
    result.sort((a: any, b: any) => {
      if (sortBy === 'data') {
        const dateA = parseLocalDate(a.data_pedido).getTime();
        const dateB = parseLocalDate(b.data_pedido).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      } else {
        const canalA = a.canal || '';
        const canalB = b.canal || '';
        return sortOrder === 'asc' ? canalA.localeCompare(canalB) : canalB.localeCompare(canalA);
      }
    });
    return result;
  }, [orders, searchTerm, sortBy, sortOrder, periodFilter, channelFilter, statusFilter, shippoStatuses]);
  const toggleSort = (column: 'data' | 'canal') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };
  const calculateOrderValues = (order: any) => {
    const items = order.order_items || [];
    const qtdProdutos = items.reduce((sum: number, item: any) => sum + (item.quantidade || 0), 0);
    // Single source of truth for the money math (shared with the order form). TAX is
    // informational only; profit and total never include it. Also flags orders whose
    // stored total doesn't reconcile with the sum of their parts (see order-calc.ts).
    // Falls back to the matching Shippo transaction's amount when custo_total_shipping
    // was never persisted — same fallback the "Valor pago pelo envio" column already
    // uses, so the two never disagree on this order's shipping cost again.
    const shippoFallback = order.shipping_tracking ? shippoTxMap[order.shipping_tracking]?.amount : null;
    const calc = calcularPedidoFromDbOrder(order, shippoFallback);
    const produtosNomes = items.map((item: any) => item.products?.["Produto Nome"] || 'N/A').join(', ');
    const marcas = [...new Set(items.map((item: any) => item.products?.["Marca"] || 'N/A'))].join(', ');
    const asins = [...new Set(items.map((item: any) => item.products?.["ASIN"]).filter(Boolean))].join(', ');
    const primeiraImagem = items.find((item: any) => item.products?.image_url)?.products?.image_url || null;
    return {
      qtdProdutos,
      valorProdutos: calc.valorProdutos,
      valorCusto: calc.valorCusto,
      lucroFinal: calc.lucroFinal,
      percentualLucro: calc.percentualLucro,
      totalDivergente: calc.totalDivergente,
      diferencaTotal: calc.diferencaTotal,
      produtoNaoIdentificado: calc.produtoNaoIdentificado,
      precisaConferir: calc.precisaConferir,
      produtosNomes, marcas, asins, primeiraImagem,
    };
  };
  const handleEbaySync = async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('https://wlynwymobvcwxjpozkqi.supabase.co/functions/v1/ebay-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndseW53eW1vYnZjd3hqcG96a3FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMTM4MDAsImV4cCI6MjA3MTc4OTgwMH0.9XEf9aqJsBsboqwLqqBXcxajKHAaxQl9z2S-pLMasLQ',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || `HTTP ${res.status}`);
      const novos = data?.new_orders ?? 0;
      const atualizados = data?.updated_orders ?? 0;
      // DEBUG: log full response to browser console so we can inspect the eBay structure
      console.log('[eBay Sync Debug]', JSON.stringify(data?.debug_sample, null, 2));
      toast({
        title: 'eBay sincronizado',
        description: `${novos} novo(s) · ${atualizados} atualizado(s) de ${data?.total_from_ebay ?? 0} pedidos. Ver console (F12) para debug.`,
      });
      await fetchOrders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // The sync function itself asks for reconnection when the stored refresh_token is
      // missing/invalid — fall straight into the OAuth flow instead of a dead-end error.
      if (/conectar ebay|re-authorize/i.test(msg)) {
        toast({ title: 'Conexão eBay expirada', description: 'Reautorizando automaticamente...' });
        startEbayReconnect(toast);
        return;
      }
      toast({ title: 'Erro ao sincronizar eBay', description: msg, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  // Single entry point for the merged button: sync already refreshes its own access token
  // via the stored refresh_token, so "reconnect" is only needed when there's no token yet
  // (or handleEbaySync detects it's invalid and falls back to handleEbayConnect above).
  const handleEbaySyncOrConnect = () => {
    if (!ebayConnected) {
      startEbayReconnect(toast);
      return;
    }
    handleEbaySync();
  };

  const openOrderView = async (orderId: string) => {
    const { data } = await supabase.from('orders').select(`
        *,
        clients (nome_razao, telefone, email, endereco_cidade, endereco_pais, endereco_estado, endereco_cep, endereco_rua),
        order_items (
          *,
          products (*)
        )
      `).eq('id', orderId).single();
    setEditingOrder(data);
    setShowOrderForm(true);
  };

  // eBay (and most other channels) don't expose a "packing slip" document via API — it's a
  // Seller Hub-only feature — so we render our own from the order data we already have, same
  // as the Shipping's page does, then open the browser print dialog.
  const handlePrintPackingSlip = async (order: any, labelTx: ShippoTx | null) => {
    const { printPackingSlip } = await import('@/lib/packing-slip-pdf');
    const c = order.clients;
    const address = [
      c?.endereco_rua,
      [c?.endereco_cidade, c?.endereco_estado, c?.endereco_cep].filter(Boolean).join(', '),
      c?.endereco_pais,
    ].filter(Boolean).join(', ');
    try {
      await printPackingSlip({
        clientName: c?.nome_razao || 'Cliente',
        clientAddress: address || undefined,
        orderDate: order.data_pedido,
        orderNumber: order.numero_pedido_canal || order.id.slice(0, 8),
        channel: order.canal,
        items: (order.order_items || []).map((i: any) => ({
          sku: i.products?.SKU,
          name: i.products?.['Produto Nome'] || 'Produto',
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
    } catch (error) {
      console.error(error);
      toast({ title: 'Erro ao gerar packing slip', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    }
  };

  // ===== Column definitions =====
  const columns: ColumnDef[] = useMemo(() => [
    {
      id: 'conferir', label: '',
      render: ({ order, calculated }) => (
        <TableCell className="px-1 text-center whitespace-nowrap">
          {calculated.precisaConferir && (
            <span
              title={
                calculated.produtoNaoIdentificado
                  ? "Este pedido tem produto não identificado (N/A) — vincule o produto correto à mão."
                  : `O total informado ($${(order.total || 0).toFixed(2)}) não bate com a soma dos itens — diferença de $${Math.abs(calculated.diferencaTotal).toFixed(2)}. Confira à mão.`
              }
              className="inline-block"
            >
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </span>
          )}
        </TableCell>
      ),
    },
    {
      id: 'data', label: 'Data', sortable: 'data',
      render: ({ order }) => (
        <TableCell className="whitespace-nowrap">
          {formatShortDate(parseLocalDate(order.data_pedido))}
        </TableCell>
      ),
    },
    {
      id: 'ebay_status', label: 'Status',
      render: ({ order, shippoStatus }) => (
        <TableCell className="text-center px-2">
          <ShippoStatusDot status={shippoStatus} hasTracking={!!order.shipping_tracking} orderStatus={order.status} />
        </TableCell>
      ),
    },
    {
      id: 'pais', label: 'País',
      render: ({ order }) => (
        <TableCell className="text-center px-2">
          {order.country
            ? <CountryFlag code={order.country} />
            : <span className="text-muted-foreground text-xs">—</span>}
        </TableCell>
      ),
    },
    {
      id: 'canal', label: 'Canal de Venda', sortable: 'canal',
      render: ({ order }) => (
        <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0 border-primary-foreground rounded-none shadow-none px-0 py-0 text-center">
          <SalesChannelBadge canal={order.canal} />
        </TableCell>
      ),
    },
    {
      id: 'numero_pedido', label: 'Nº Pedido',
      render: ({ order }) => <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0 border-primary-foreground rounded-none shadow-none px-0 py-0 text-center whitespace-nowrap">{order.numero_pedido_canal || '-'}</TableCell>,
    },
    {
      id: 'cliente', label: 'Nome do Cliente',
      render: ({ order }) => <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0 border-primary-foreground rounded-none shadow-none px-0 py-0 text-center font-medium whitespace-nowrap">{order.clients?.nome_razao || '-'}</TableCell>,
    },
    {
      id: 'produto', label: 'Produto Vendido',
      render: ({ calculated }) => <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0 border-primary-foreground rounded-none shadow-none px-0 py-0 text-center max-w-[150px] truncate">{calculated.produtosNomes || '-'}</TableCell>,
    },
    {
      id: 'previa_produtos', label: 'Previa Produtos Vendidos',
      render: ({ calculated }) => (
        <TableCell className="p-2 align-middle text-center">
          <div className="relative inline-block">
            {calculated.primeiraImagem ? (
              <img
                src={calculated.primeiraImagem}
                alt="Prévia produto"
                className="w-[40px] h-[40px] rounded-md object-scale-down bg-muted"
              />
            ) : (
              <div className="w-[40px] h-[40px] rounded-md bg-muted flex items-center justify-center text-muted-foreground font-bold text-[10px]">
                N/A
              </div>
            )}
            {calculated.qtdProdutos > 1 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
                {calculated.qtdProdutos}
              </span>
            )}
          </div>
        </TableCell>
      ),
    },
    {
      id: 'qtd', label: 'Qtd. Produtos',
      render: ({ calculated }) => <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0 border-primary-foreground rounded-none shadow-none px-0 py-0 text-center">{calculated.qtdProdutos}</TableCell>,
    },
    {
      id: 'marca', label: 'Marca',
      render: ({ calculated }) => <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0 border-primary-foreground rounded-none shadow-none px-0 py-0 text-center whitespace-nowrap text-left">{calculated.marcas || '-'}</TableCell>,
    },
    {
      id: 'asin', label: 'ASIN',
      render: ({ calculated }) => <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0 border-primary-foreground rounded-none shadow-none px-0 py-0 text-center whitespace-nowrap">{calculated.asins || '-'}</TableCell>,
    },
    {
      id: 'valor_unit', label: 'Valor Vendido Unit. ($)',
      render: ({ order, calculated, formatCurrency }) => {
        const price = calculated.qtdProdutos === 1 ? order.order_items?.[0]?.preco_unitario : null;
        return <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0 border-primary-foreground rounded-none shadow-none px-0 py-0 text-center whitespace-nowrap text-center">
          {price != null && price > 0 ? formatCurrency(price) : <span className="text-muted-foreground">—</span>}
        </TableCell>;
      },
    },
    {
      id: 'valor_produtos', label: 'Valor Produtos Somados',
      render: ({ calculated, formatCurrency }) => <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0 border-primary-foreground rounded-none shadow-none px-0 py-0 text-center whitespace-nowrap text-center">{formatCurrency(calculated.valorProdutos)}</TableCell>,
    },
    {
      id: 'shipping_pago', label: 'Shipping Pago Cliente',
      render: ({ order, formatCurrency }) => <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0 border-primary-foreground rounded-none shadow-none px-0 py-0 text-center whitespace-nowrap text-center text-[#928302]">{formatCurrency(order.frete_total || 0)}</TableCell>,
    },
    {
      id: 'custo_shipping', label: 'Valor pago pelo envio',
      render: ({ order, labelTx, formatCurrency }) => {
        const cost = order.custo_total_shipping || (labelTx?.amount ? parseFloat(labelTx.amount) : null);
        return (
          <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0 border-primary-foreground rounded-none shadow-none px-0 py-0 text-center whitespace-nowrap text-[#7e7e02] text-center">
            {cost != null ? formatCurrency(cost) : '-'}
          </TableCell>
        );
      },
    },
    {
      id: 'label', label: 'Comprar Etiqueta',
      render: ({ order, labelTx, openLabel }) => (
        <TableCell className="text-center px-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => openLabel(order)}
            title={labelTx ? 'Etiqueta já comprada' : 'Comprar etiqueta'}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={labelTx ? '/Labelok.png' : '/Label.png'}
              alt={labelTx ? 'Etiqueta comprada' : 'Comprar etiqueta'}
              className="h-6 w-6 object-contain"
            />
          </Button>
        </TableCell>
      ),
    },
    {
      id: 'baixar_etiqueta', label: 'Baixar Etiqueta',
      render: ({ labelTx }) => {
        if (!labelTx?.label_url) {
          return <TableCell className="text-center px-2"><span className="text-muted-foreground text-xs">-</span></TableCell>;
        }
        return (
          <TableCell className="text-center px-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-600 hover:text-green-700"
              onClick={() => window.open(labelTx.label_url!, '_blank')}
              title="Abrir / Baixar Etiqueta (PDF)"
            >
              <Download className="h-4 w-4" />
            </Button>
          </TableCell>
        );
      },
    },
    {
      id: 'pack_slip', label: 'Pack Slip',
      render: ({ order, labelTx, printPackingSlip }) => (
        <TableCell className="text-center px-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => printPackingSlip(order, labelTx)}
            title="Imprimir Packing Slip"
          >
            <Printer className="h-4 w-4" />
          </Button>
        </TableCell>
      ),
    },
    {
      id: 'tax', label: 'TAX (U$)',
      render: ({ order, formatCurrency }) => <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0 border-primary-foreground rounded-none shadow-none px-0 py-0 text-center text-right whitespace-nowrap">{formatCurrency(order.impostos || 0)}</TableCell>,
    },
    {
      // Column name is historical (eBay came first); the field now holds the marketplace
      // fee for any channel — eBay's reported fee, Amazon's 15% referral fee, etc.
      id: 'comissao_ebay', label: 'Comissão Venda (Plataforma)',
      render: ({ order, formatCurrency }) => <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0 border-primary-foreground rounded-none shadow-none px-0 py-0 text-center whitespace-nowrap text-center text-destructive">{formatCurrency(order.comissao_ebay || 0)}</TableCell>,
    },
    {
      id: 'promoted_listings', label: 'Promoted Listings',
      render: ({ order, formatCurrency }) => <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0 border-primary-foreground rounded-none shadow-none px-0 py-0 text-center whitespace-nowrap text-center text-destructive">{formatCurrency(order.promoted_listings || 0)}</TableCell>,
    },
    {
      id: 'total', label: 'Valor Total Venda',
      render: ({ order, formatCurrency }) => <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0 border-primary-foreground rounded-none shadow-none px-0 py-0 text-center text-right whitespace-nowrap font-medium">{formatCurrency(order.total || 0)}</TableCell>,
    },
    {
      id: 'valor_custo', label: 'Valor de Custo',
      render: ({ calculated, formatCurrency }) => <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0 border-primary-foreground rounded-none shadow-none px-0 py-0 text-center whitespace-nowrap text-destructive text-center">{formatCurrency(calculated.valorCusto)}</TableCell>,
    },
    {
      id: 'desconto', label: 'Desconto (U$)',
      render: ({ order, formatCurrency }) => <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0 border-primary-foreground rounded-none shadow-none px-0 py-0 text-center whitespace-nowrap text-center text-destructive">{formatCurrency(order.descontos || 0)}</TableCell>,
    },
    {
      id: 'lucro', label: 'Lucro Final',
      render: ({ calculated, formatCurrency }) => <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0 border-primary-foreground rounded-none shadow-none px-0 py-0 text-center whitespace-nowrap font-medium text-[#029720] text-center">{formatCurrency(calculated.lucroFinal)}</TableCell>,
    },
    {
      id: 'pct_lucro', label: '% Lucro Final',
      render: ({ calculated }) => <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0 border-primary-foreground rounded-none shadow-none px-0 py-0 text-center whitespace-nowrap text-center">{calculated.percentualLucro.toFixed(2)}%</TableCell>,
    },
    {
      id: 'tracking', label: 'Shipping Tracking',
      render: ({ order }) => (
        <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0 border-primary-foreground rounded-none shadow-none px-0 py-0 text-center whitespace-nowrap">
          {order.shipping_tracking ? (
            <div className="flex items-center gap-1 max-w-[130px]">
              <span
                className="text-[11px] font-mono truncate"
                title={order.shipping_tracking}
              >
                {order.shipping_tracking}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={() => window.open(getTrackingUrl(order.shipping_tracking, order.carrier), '_blank')}
                title="Rastrear pacote"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          ) : '-'}
        </TableCell>
      ),
    },
    {
      id: 'carrier', label: 'Carrier',
      render: ({ order }) => (
        <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0 border-primary-foreground rounded-none shadow-none px-0 py-0 text-center whitespace-nowrap">
          {(() => {
            const logo = getCarrierLogo(order.carrier, order.shipping_tracking);
            const label = (order.shipping_tracking ? detectCarrier(order.shipping_tracking) : null) ?? order.carrier ?? '';
            return logo ? (
              <img src={logo} alt={label} className="h-6 w-auto object-contain mx-auto" title={label} />
            ) : '-';
          })()}
        </TableCell>
      ),
    },
    {
      id: 'link_plataforma', label: 'Link da Plataforma',
      render: ({ order }) => {
        let url: string | null = null;
        if (order.canal === 'eBay' && order.numero_pedido_canal) {
          url = `https://www.ebay.com/mesh/ord/details?orderId=${encodeURIComponent(order.numero_pedido_canal)}`;
        } else if (order.canal === 'Amazon' && order.numero_pedido_canal) {
          url = `https://sellercentral.amazon.com/orders-v3/order/${order.numero_pedido_canal}`;
        }
        return (
          <TableCell className="text-center px-2">
            {url ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => window.open(url!, '_blank')}
                title={`Abrir pedido na ${order.canal}`}
              >
                <Link2 className="h-4 w-4 text-blue-500" />
              </Button>
            ) : '-'}
          </TableCell>
        );
      },
    },
    {
      id: 'obs', label: 'OBS',
      render: ({ order }) => <TableCell className="max-w-[150px] truncate">{order.observacoes || '-'}</TableCell>,
    },
  ], []);

  const defaultOrder = useMemo(() => columns.map(c => c.id), [columns]);
  const { columnOrder, columnVisibility, setColumnVisibility, handleDragEnd, reset: resetColumns, saveView, isDirty, visibleOrderedIds } =
    useColumnPreferences('orders', defaultOrder);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Build ordered + visible columns
  const orderedColumns = useMemo(() => {
    const map = new Map(columns.map(c => [c.id, c]));
    return visibleOrderedIds.map(id => map.get(id)).filter((c): c is ColumnDef => !!c);
  }, [columns, visibleOrderedIds]);

  if (loading) {
    return <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>;
  }
  return <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-muted-foreground font-bold">
            Gerencie todos os pedidos
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleEbaySyncOrConnect} disabled={syncing}>
            {ebayConnected ? (
              <>
                <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando...' : (
                  <span className="flex items-center gap-1.5">
                    Sincronizar
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/sales-channels/Ebay.png" alt="eBay" className="h-4 w-auto object-contain" />
                  </span>
                )}
              </>
            ) : (
              <>
                <Link2 className="mr-2 h-4 w-4" />
                Conectar eBay
              </>
            )}
          </Button>
          <Button variant="outline" onClick={fetchShippoTransactions} disabled={loadingLabels}>
            <span className="flex items-center gap-1.5">
              <RefreshCw className={`h-4 w-4 ${loadingLabels ? 'animate-spin' : ''}`} />
              Sincronizar
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/shippo.png" alt="Shippo" className="h-4 w-auto object-contain" />
            </span>
          </Button>
          {/* Amazon has no live sync (SP-API needs a Professional seller plan), so orders
              come in from the Seller Central report instead — see AmazonOrderUploadDialog. */}
          <Button variant="outline" onClick={() => setAmazonUploadOpen(true)}>
            <span className="flex items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={amazonLogo} alt="Amazon" className="h-4 w-auto object-contain" />
              Upload Vendas
            </span>
          </Button>
          {/* Same box presets as the Shipping's page — shared via the DB (box_presets). */}
          <Button variant="outline" onClick={() => setShowBoxManager(true)}>
            <Settings className="mr-2 h-4 w-4" />Caixas ({boxes.length})
          </Button>
          {user && <>
              <Button variant={selectionMode ? "destructive" : "outline"} onClick={() => {
            setSelectionMode(!selectionMode);
            setSelectedOrders(new Set());
          }}>
                <CheckSquare className="mr-2 h-4 w-4" />
                {selectionMode ? 'Cancelar' : 'Selecionar'}
              </Button>
              {selectionMode && selectedOrders.size > 0 && <Button variant="destructive" onClick={handleDeleteSelected}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Deletar ({selectedOrders.size})
                </Button>}
            </>}
          <Button onClick={() => setShowOrderForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Pedido
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Pedidos</CardTitle>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground font-bold" />
              <Input placeholder="Buscar pedidos..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="max-w-sm" />
            </div>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="7days">Últimos 7 dias</SelectItem>
                <SelectItem value="30days">Últimos 30 dias</SelectItem>
                <SelectItem value="1month">Último mês</SelectItem>
                <SelectItem value="6months">Últimos 6 meses</SelectItem>
              </SelectContent>
            </Select>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Canal de Venda" />
              </SelectTrigger>
              <SelectContent>
                {channelOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className="flex items-center gap-2">
                      {option.icon}
                      {option.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns3 className="mr-2 h-4 w-4" />
                  Colunas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-[400px] overflow-y-auto w-56 bg-popover">
                <DropdownMenuLabel>Mostrar colunas</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columns.map(col => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={columnVisibility[col.id] !== false}
                    onCheckedChange={(checked) =>
                      setColumnVisibility(prev => ({ ...prev, [col.id]: !!checked }))
                    }
                    onSelect={(e) => e.preventDefault()}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <ColumnViewButtons isDirty={isDirty} onSave={saveView} onReset={resetColumns} />
            {loadingLabels && (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/shippo.png" alt="Shippo" className="h-4 w-auto object-contain" />
                Carregando etiquetas Shippo…
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-bold mt-1">
            Dica: arraste o ícone <GripVertical className="inline h-3 w-3" /> ao lado de cada coluna para reordenar.
          </p>
        </CardHeader>
        <CardContent>
          <div className="relative w-full max-h-[calc(100vh-320px)] overflow-x-scroll overflow-y-auto scrollbar-always">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <Table>
                <TableHeader className="sticky top-0 bg-card z-20 shadow-sm">
                  <TableRow className="border-b-2 text-xs">
                    {selectionMode && <TableHead className="bg-card w-12"></TableHead>}
                    <SortableContext items={orderedColumns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                      {orderedColumns.map(col => (
                        <SortableHeader key={col.id} col={col}>
                          {col.sortable ? (
                            <button
                              type="button"
                              className="flex items-center gap-1"
                              onClick={() => toggleSort(col.sortable!)}
                            >
                              {col.label}
                              <ArrowUpDown className={`h-3 w-3 ${sortBy === col.sortable ? 'text-primary' : 'text-muted-foreground font-bold'}`} />
                            </button>
                          ) : (
                            <span>{col.label}</span>
                          )}
                        </SortableHeader>
                      ))}
                    </SortableContext>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedOrders.map((order: any) => {
                    const calculated = calculateOrderValues(order);
                    const valorUnitarioMedio = calculated.qtdProdutos > 0 ? calculated.valorProdutos / calculated.qtdProdutos : 0;
                    return (
                      <TableRow
                        key={order.id}
                        className={cn("text-xs cursor-pointer", order.status === 'Cancelado' && "bg-muted text-muted-foreground hover:bg-muted/90 grayscale")}
                        onClick={(e) => { if (!isInteractiveClickTarget(e)) openOrderView(order.id); }}
                      >
                        {selectionMode && <TableCell>
                          <div className="flex items-center gap-2">
                            <Checkbox checked={selectedOrders.has(order.id)} onCheckedChange={() => toggleSelection(order.id)} />
                            <Button variant="ghost" size="icon" onClick={() => openOrderView(order.id)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>}
                        {orderedColumns.map(col => (
                          <React.Fragment key={col.id}>
                            {col.render({
                              order, calculated, valorUnitarioMedio, formatCurrency, openOrderView,
                              shippoStatus: shippoStatuses[order.shipping_tracking] ?? null,
                              labelTx: order.shipping_tracking ? (shippoTxMap[order.shipping_tracking] ?? null) : null,
                              openLabel: setLabelOrder,
                              printPackingSlip: handlePrintPackingSlip,
                            })}
                          </React.Fragment>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </DndContext>
          </div>
        </CardContent>
      </Card>

      <OrderForm open={showOrderForm} onOpenChange={open => {
        setShowOrderForm(open);
        if (!open) setEditingOrder(null);
      }} onSuccess={fetchOrders} editingOrder={editingOrder} />

      <BuyLabelDialog
        order={labelOrder}
        labelTx={labelOrder?.shipping_tracking ? (shippoTxMap[labelOrder.shipping_tracking] ?? null) : null}
        open={!!labelOrder}
        onOpenChange={(open) => { if (!open) setLabelOrder(null); }}
        onSuccess={() => { fetchOrders(); fetchShippoTransactions(); }}
      />

      <AmazonOrderUploadDialog
        open={amazonUploadOpen}
        onOpenChange={setAmazonUploadOpen}
        onImported={fetchOrders}
      />

      <BoxManagerDialog open={showBoxManager} onOpenChange={setShowBoxManager} boxes={boxes} onChange={setBoxes} />
    </div>;
}
