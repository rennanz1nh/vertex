import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, ShoppingCart, Download, CalendarIcon, Store, CreditCard, Globe, DollarSign, Package, FileText, FileSpreadsheet, GripVertical, Eye, Truck, Wallet, Receipt, PartyPopper, RefreshCw, XCircle } from 'lucide-react';
import type { ShippoTx } from '@/lib/shippo-types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { authedFetch } from '@/lib/admin-fetch';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { format, isAfter, isBefore, startOfDay, endOfDay, subDays, startOfYear, endOfYear, subYears, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { parseLocalDate } from '@/lib/date-utils';
import { calcularPedidoFromDbOrder } from '@/lib/order-calc';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ShipmentTrackingStrip } from '@/components/admin/ShipmentTrackingStrip';

const amazonLogo = '/images/sales-channels/Amazon.png';
const ebayLogo = '/images/sales-channels/Ebay.png';
const etsyLogo = '/images/sales-channels/Etsy.png';
const tiktokLogo = '/images/sales-channels/TikTok.png';
const zelleLogo = '/images/sales-channels/Zelle.png';
const whatsappLogo = '/images/sales-channels/Whatsapp.png';
const cosmeticMpLogo = '/images/sales-channels/Vertex_Rental_Cars.png';

const channelOptions = [
  { value: 'all', label: 'Todos os Canais', icon: null },
  { value: 'Presencial', label: 'Presencial', icon: <Store className="h-4 w-4" /> },
  { value: 'Amazon', label: 'Amazon', icon: <img src={amazonLogo} alt="Amazon" className="h-5 w-5 object-contain" /> },
  { value: 'eBay', label: 'eBay', icon: <img src={ebayLogo} alt="eBay" className="h-5 w-5 object-contain" /> },
  { value: 'Etsy', label: 'Etsy', icon: <img src={etsyLogo} alt="Etsy" className="h-5 w-5 object-contain" /> },
  { value: 'TikTok', label: 'TikTok', icon: <img src={tiktokLogo} alt="TikTok" className="h-5 w-5 object-contain" /> },
  { value: 'Vertex Rental Cars', label: 'Cosmetic MP', icon: <img src={cosmeticMpLogo} alt="Cosmetic MP" className="h-5 w-5 object-contain" /> },
  { value: 'Credit Card', label: 'Credit Card', icon: <CreditCard className="h-4 w-4" /> },
  { value: 'Zelle', label: 'Zelle', icon: <img src={zelleLogo} alt="Zelle" className="h-5 w-5 object-contain" /> },
  { value: 'Online', label: 'Online', icon: <Globe className="h-4 w-4" /> },
  { value: 'WhatsApp', label: 'WhatsApp', icon: <img src={whatsappLogo} alt="WhatsApp" className="h-5 w-5 object-contain" /> },
  { value: 'Outro', label: 'Outro', icon: null },
];

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  '#f59e0b',
  '#10b981',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#f97316',
];

// Logo shown next to each channel's name in "Receita por Canal" — same asset paths as channelOptions.
const channelLogos: Record<string, string> = {
  Amazon: amazonLogo,
  eBay: ebayLogo,
  Etsy: etsyLogo,
  TikTok: tiktokLogo,
  'Vertex Rental Cars': cosmeticMpLogo,
  Zelle: zelleLogo,
  WhatsApp: whatsappLogo,
};

// Ordinal opacity ramp for monthly chart data: most recent month renders solid, older
// months fade toward the surface (same floor as the eBay report charts' month gradient).
const MIN_MONTH_OPACITY = 0.35;
function monthOpacityByIndex(idx: number, total: number): number {
  if (total <= 1) return 1;
  return MIN_MONTH_OPACITY + (idx / (total - 1)) * (1 - MIN_MONTH_OPACITY);
}

type TopProductsPeriod = '7d' | '30d' | '90d' | 'all';
const TOP_PRODUCTS_PERIODS: { value: TopProductsPeriod; label: string }[] = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: 'all', label: 'Tempo Todo' },
];

type DashboardPreset = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'this_year' | 'last_year' | 'all';
const DASHBOARD_PRESETS: { value: DashboardPreset; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: 'this_year', label: 'Esse Ano' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'all', label: 'Tempo Todo' },
];

// `orders.data_pedido` is written using the business's timezone (America/New_York, see
// ebay-sync/amazon-order-import), not the viewer's. "Hoje"/"Ontem" need to anchor on that
// same timezone — otherwise a seller browsing from Brazil (or anywhere else) sees today's
// sales fall off the "Hoje" filter, or yesterday's linger in it, depending on the hour.
function nowInBusinessTimezone(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const [y, m, d] = parts.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function presetRange(preset: DashboardPreset): { from: Date | undefined; to: Date | undefined } {
  const now = nowInBusinessTimezone();
  switch (preset) {
    case 'today':
      return { from: now, to: now };
    case 'yesterday': {
      const y = subDays(now, 1);
      return { from: y, to: y };
    }
    case '7d':
      return { from: subDays(now, 6), to: now };
    case '30d':
      return { from: subDays(now, 29), to: now };
    case '90d':
      return { from: subDays(now, 89), to: now };
    case 'this_year':
      return { from: startOfYear(now), to: endOfYear(now) };
    case 'last_year': {
      const ly = subYears(now, 1);
      return { from: startOfYear(ly), to: endOfYear(ly) };
    }
    case 'all':
      return { from: undefined, to: undefined };
  }
}

const revenueChartConfig = {
  revenue: { label: 'Receita', color: 'hsl(var(--primary))' },
};

const ordersChartConfig = {
  orders: { label: 'Pedidos', color: 'hsl(var(--secondary))' },
};

const quantityChartConfig = {
  quantity: { label: 'Quantidade', color: 'hsl(var(--primary))' },
};

// Section definitions
const ALL_SECTIONS = [
  { id: 'stats', label: 'Cards de Resumo' },
  { id: 'charts', label: 'Gráficos (Receita, Pedidos, Quantidade, Canal)' },
  { id: 'topProducts', label: 'Produtos Mais Vendidos' },
] as const;

type SectionId = typeof ALL_SECTIONS[number]['id'];

const DEFAULT_ORDER: SectionId[] = ALL_SECTIONS.map(s => s.id);

function loadPrefs() {
  try {
    const stored = localStorage.getItem('dashboard.sectionPrefs.v1');
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        order: parsed.order as SectionId[],
        visibility: parsed.visibility as Record<SectionId, boolean>,
      };
    }
  } catch {}
  return {
    order: [...DEFAULT_ORDER],
    visibility: Object.fromEntries(DEFAULT_ORDER.map(id => [id, true])) as Record<SectionId, boolean>,
  };
}

function savePrefs(order: SectionId[], visibility: Record<SectionId, boolean>) {
  localStorage.setItem('dashboard.sectionPrefs.v1', JSON.stringify({ order, visibility }));
}

// Sortable wrapper
function SortableSection({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <button
        type="button"
        className="absolute top-2 left-2 z-10 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 rounded p-1"
        {...attributes}
        {...listeners}
        aria-label="Arrastar seção"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </div>
  );
}

export default function Reports() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalClients, setTotalClients] = useState(0);
  const [shippoTxMap, setShippoTxMap] = useState<Record<string, ShippoTx>>({});

  // "Vendas de Hoje": every order recorded today, seeded on load and kept live via
  // Realtime so a brand-new order (any channel — eBay sync, Amazon sync, TikTok Shop,
  // site checkout, manual entry) shows up here without a refresh. Keyed off created_at
  // (when the row was actually inserted), not data_pedido — that field holds whatever
  // order date was entered/imported and is often backdated, so it doesn't track "today".
  type TodaySale = {
    id: string; canal: string; total: number; created_at: string; status: string | null;
    frete_total: number | null; custo_total_shipping: number | null; comissao_ebay: number | null;
    promoted_listings: number | null; descontos: number | null; impostos: number | null;
    order_items?: { quantidade: number; preco_unitario: number; custo_unitario: number; product_id: string | null; products: unknown | null }[] | null;
  };
  const [todaySales, setTodaySales] = useState<TodaySale[] | null>(null);

  // Cancelled orders never happened as far as today's sales go; profit per sale reuses
  // the same calc as the rest of the app (order-calc.ts) so the number always agrees with
  // what Pedidos/Reports would compute for the same order.
  const visibleTodaySales = useMemo(() => {
    return (todaySales ?? [])
      .filter((s) => s.status !== 'Cancelado')
      .map((s) => ({ ...s, lucro: calcularPedidoFromDbOrder(s as any).lucroFinal }));
  }, [todaySales]);
  const todaySalesProfit = useMemo(() => visibleTodaySales.reduce((sum, s) => sum + s.lucro, 0), [visibleTodaySales]);
  const [justSoldId, setJustSoldId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  // Section preferences
  const [sectionOrder, setSectionOrder] = useState<SectionId[]>(() => loadPrefs().order);
  const [sectionVisibility, setSectionVisibility] = useState<Record<SectionId, boolean>>(() => loadPrefs().visibility);

  // Filters
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [channelFilter, setChannelFilter] = useState('all');
  const [activePreset, setActivePreset] = useState<DashboardPreset | null>(null);

  // Independent period filter for the "Produtos Mais Vendidos" card.
  const [topProductsPeriod, setTopProductsPeriod] = useState<TopProductsPeriod>('all');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    savePrefs(sectionOrder, sectionVisibility);
  }, [sectionOrder, sectionVisibility]);

  useEffect(() => {
    fetchData();
  }, []);

  // order_items is fetched alongside so profit can be computed per sale (calcularPedidoFromDbOrder);
  // status is fetched so cancelled orders can be excluded from the list and totals.
  const TODAY_SALES_SELECT = 'id, canal, total, created_at, status, frete_total, custo_total_shipping, comissao_ebay, promoted_listings, descontos, impostos, order_items(quantidade, preco_unitario, custo_unitario, product_id, products:product_id (id))';

  const fetchTodaySales = async () => {
    const startOfToday = startOfDay(new Date()).toISOString();
    const { data, error } = await supabase
      .from('orders')
      .select(TODAY_SALES_SELECT)
      .gte('created_at', startOfToday)
      .order('created_at', { ascending: false });
    if (error) { console.error('Error fetching today\'s sales:', error); return; }
    setTodaySales((data as unknown as TodaySale[]) || []);
  };

  useEffect(() => {
    fetchTodaySales();

    const channel = supabase
      .channel('admin-dashboard-new-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const newOrderId = (payload.new as { id: string }).id;
        // Realtime's INSERT payload doesn't include related order_items, so instead of
        // building the row from the payload we just refetch — simpler than a second join.
        fetchTodaySales();
        setJustSoldId(newOrderId);
        setTimeout(() => setJustSoldId((id) => (id === newOrderId ? null : id)), 5000);
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    try {
      const [ordersRes, itemsRes, productsRes, clientsRes, shippoRes] = await Promise.all([
        supabase.from('orders').select('id, data_pedido, canal, total, status, impostos, frete_total, descontos, client_id, custo_total_shipping, shipping_tracking, comissao_ebay, comissao_tiktok, promoted_listings'),
        supabase.from('order_items').select('order_id, product_id, quantidade, preco_unitario, custo_unitario, products:product_id ("Produto Nome", image_url)'),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        authedFetch('/api/shippo/transactions-list').then((r) => r.json()).catch(() => ({ transactions: [] })),
      ]);
      setOrders(ordersRes.data || []);
      setOrderItems(itemsRes.data || []);
      setTotalProducts(productsRes.count || 0);
      setTotalClients(clientsRes.count || 0);
      const map: Record<string, ShippoTx> = {};
      (shippoRes.transactions as ShippoTx[] | undefined ?? []).forEach((tx) => {
        if (tx.tracking_number) map[tx.tracking_number] = tx;
      });
      setShippoTxMap(map);
    } catch (e) {
      console.error('Error fetching report data:', e);
    } finally {
      setLoading(false);
    }
  };

  // Runs the same eBay order sync the 4h cron does (see /api/cron/ebay-sync), then reloads
  // every dashboard query — lets someone pull fresh sales on demand instead of waiting up
  // to 4h for the next scheduled run.
  // Amazon sync is intentionally left out here: the integration isn't in use yet, and
  // calling it just surfaces a "secrets not set" error on every refresh.
  const syncChannel = async (fn: 'ebay-sync', accessToken: string | undefined) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const [ebayResult] = await Promise.allSettled([
        syncChannel('ebay-sync', session?.access_token),
      ]);

      await Promise.all([fetchData(), fetchTodaySales()]);

      const parts: string[] = [];
      if (ebayResult.status === 'fulfilled') {
        parts.push(`eBay: ${ebayResult.value?.new_orders ?? 0} novo(s)`);
      } else {
        parts.push(`eBay falhou: ${ebayResult.reason instanceof Error ? ebayResult.reason.message : String(ebayResult.reason)}`);
      }

      const hadError = ebayResult.status === 'rejected';
      toast({
        title: hadError ? 'Dashboard atualizado (com erros)' : 'Dashboard atualizado',
        description: parts.join(' · '),
        variant: hadError ? 'destructive' : undefined,
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Shared date/channel guard so filteredOrders and cancelledOrders don't each reimplement
  // the same comparison — only the status condition differs between the two.
  const matchesDateChannel = useCallback((o: any) => {
    const date = parseLocalDate(o.data_pedido);
    if (dateFrom && isBefore(date, startOfDay(dateFrom))) return false;
    if (dateTo && isAfter(date, endOfDay(dateTo))) return false;
    if (channelFilter !== 'all' && o.canal !== channelFilter) return false;
    return true;
  }, [dateFrom, dateTo, channelFilter]);

  // Cancelled orders are excluded from every dashboard metric — they never happened as
  // far as revenue/profit/units are concerned, and are surfaced separately below instead.
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => matchesDateChannel(o) && o.status !== 'Cancelado');
  }, [orders, matchesDateChannel]);

  const cancelledOrders = useMemo(() => {
    return orders.filter((o) => matchesDateChannel(o) && o.status === 'Cancelado');
  }, [orders, matchesDateChannel]);
  const cancelledCount = cancelledOrders.length;
  const cancelledTotal = useMemo(() => cancelledOrders.reduce((s, o) => s + (Number(o.total) || 0), 0), [cancelledOrders]);

  const filteredOrderIds = useMemo(() => new Set(filteredOrders.map((o) => o.id)), [filteredOrders]);

  const filteredItems = useMemo(() => {
    return orderItems.filter((i) => filteredOrderIds.has(i.order_id));
  }, [orderItems, filteredOrderIds]);

  const totalRevenue = useMemo(() => filteredOrders.reduce((s, o) => s + (Number(o.total) || 0), 0), [filteredOrders]);
  const totalOrders = filteredOrders.length;
  const totalUnitsSold = useMemo(() => filteredItems.reduce((s, i) => s + (Number(i.quantidade) || 0), 0), [filteredItems]);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  // Same "real Shippo amount" fallback used on the Pedidos/Shipping's "Valor pago pelo
  // envio" column — custo_total_shipping is only saved once a label is bought through us,
  // so orders shipped some other way fall back to the matching Shippo transaction amount.
  const totalShippingCost = useMemo(() => {
    return filteredOrders.reduce((s, o) => {
      const tx = o.shipping_tracking ? shippoTxMap[o.shipping_tracking] : null;
      const cost = o.custo_total_shipping || (tx?.amount ? parseFloat(tx.amount) : 0);
      return s + (Number(cost) || 0);
    }, 0);
  }, [filteredOrders, shippoTxMap]);

  // Custo dos produtos de cada pedido (quantidade x custo_unitario), insumo do Lucro Final.
  const productCostByOrder = useMemo(() => {
    const map: Record<string, number> = {};
    filteredItems.forEach((i) => {
      map[i.order_id] = (map[i.order_id] || 0) + (Number(i.quantidade) || 0) * (Number(i.custo_unitario) || 0);
    });
    return map;
  }, [filteredItems]);

  // Soma do Lucro Final dos pedidos do período — mesma fórmula/fallback de order-calc.ts
  // (usado pela tela de Pedidos e pelo formulário): TAX é só informativo e nunca desconta
  // do lucro, e custo_total_shipping cai no fallback da transação Shippo quando o pedido
  // teve etiqueta comprada mas o valor nunca foi persistido na order (só grava ao salvar
  // o formulário) — mesmo fallback já usado no card "Gasto com Shipping" acima.
  const totalLucroFinal = useMemo(() => {
    return filteredOrders.reduce((s, o) => {
      const custoProdutos = productCostByOrder[o.id] || 0;
      const tx = o.shipping_tracking ? shippoTxMap[o.shipping_tracking] : null;
      const custoEnvio = Number(o.custo_total_shipping) || (tx?.amount ? parseFloat(tx.amount) : 0);
      return s
        + (Number(o.total) || 0)
        - custoProdutos
        - custoEnvio
        - (Number(o.comissao_ebay) || 0)
        - (Number(o.promoted_listings) || 0);
    }, 0);
  }, [filteredOrders, productCostByOrder, shippoTxMap]);

  // Comissões Plataformas: soma das três taxas que cada canal descontou da venda —
  // comissão eBay, comissão TikTok Shop e Promoted Listings (ads do eBay).
  const totalComissoesPlataformas = useMemo(() => {
    return filteredOrders.reduce((s, o) => {
      return s
        + (Number(o.comissao_ebay) || 0)
        + (Number(o.comissao_tiktok) || 0)
        + (Number(o.promoted_listings) || 0);
    }, 0);
  }, [filteredOrders]);

  const totalTax = useMemo(() => {
    return filteredOrders.reduce((s, o) => s + (Number(o.impostos) || 0), 0);
  }, [filteredOrders]);

  const monthlyRevenueData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredOrders.forEach((o) => {
      const d = parseLocalDate(o.data_pedido);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + (Number(o.total) || 0);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([m, revenue]) => ({
      month: parseLocalDate(m + '-01').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
      revenue,
    }));
  }, [filteredOrders]);

  const monthlyOrdersData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredOrders.forEach((o) => {
      const d = parseLocalDate(o.data_pedido);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([m, orders]) => ({
      month: parseLocalDate(m + '-01').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
      orders,
    }));
  }, [filteredOrders]);

  const revenueByChannel = useMemo(() => {
    const map: Record<string, number> = {};
    filteredOrders.forEach((o) => { map[o.canal] = (map[o.canal] || 0) + (Number(o.total) || 0); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredOrders]);

  // "Produtos Mais Vendidos" has its own period filter (7d/30d/90d/tempo todo), independent
  // of the Data Inicial/Final pickers above — it still respects the platform filter, though.
  const topProductsOrders = useMemo(() => {
    const channelMatch = (o: any) => (channelFilter === 'all' || o.canal === channelFilter) && o.status !== 'Cancelado';
    if (topProductsPeriod === 'all') return orders.filter(channelMatch);
    const days = topProductsPeriod === '7d' ? 7 : topProductsPeriod === '30d' ? 30 : 90;
    const cutoff = startOfDay(subDays(new Date(), days - 1));
    return orders.filter((o) => channelMatch(o) && !isBefore(parseLocalDate(o.data_pedido), cutoff));
  }, [orders, channelFilter, topProductsPeriod]);

  const topProductsOrderIds = useMemo(() => new Set(topProductsOrders.map((o) => o.id)), [topProductsOrders]);

  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; imageUrl: string | null; qty: number; revenue: number }> = {};
    orderItems.filter((i) => topProductsOrderIds.has(i.order_id)).forEach((i) => {
      const pid = i.product_id;
      if (!map[pid]) {
        map[pid] = { name: i.products?.["Produto Nome"] || 'Sem nome', imageUrl: i.products?.image_url || null, qty: 0, revenue: 0 };
      }
      map[pid].qty += Number(i.quantidade) || 0;
      map[pid].revenue += (Number(i.quantidade) || 0) * (Number(i.preco_unitario) || 0);
    });
    // Ranqueado por valor vendido (o número exibido à direita de cada linha), do maior
    // para o menor; a quantidade só desempata produtos que renderam o mesmo valor.
    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue || b.qty - a.qty)
      .slice(0, 10);
  }, [orderItems, topProductsOrderIds]);

  const monthlyQuantityData = useMemo(() => {
    const orderDateMap: Record<string, string> = {};
    filteredOrders.forEach((o) => { orderDateMap[o.id] = o.data_pedido; });
    const map: Record<string, number> = {};
    filteredItems.forEach((i) => {
      const dp = orderDateMap[i.order_id];
      if (!dp) return;
      const d = parseLocalDate(dp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + (Number(i.quantidade) || 0);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([m, quantity]) => ({
      month: parseLocalDate(m + '-01').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
      quantity,
    }));
  }, [filteredOrders, filteredItems]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

  const handleExportCSV = () => {
    const headers = ['Data', 'Canal', 'Status', 'Total', 'Impostos', 'Frete', 'Descontos'];
    const rows = filteredOrders.map((o) => [o.data_pedido, o.canal, o.status, Number(o.total) || 0, Number(o.impostos) || 0, Number(o.frete_total) || 0, Number(o.descontos) || 0]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-vendas-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(18);
    doc.text('Relatório de Vendas', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(10);
    const dateRange = [dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Início', dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Hoje'].join(' - ');
    const channelLabel = channelFilter === 'all' ? 'Todos os canais' : channelFilter;
    doc.text(`Período: ${dateRange}  |  Canal: ${channelLabel}`, pageWidth / 2, 28, { align: 'center' });
    doc.setFontSize(12);
    doc.text('Resumo', 14, 40);
    doc.setFontSize(10);
    doc.text(`Receita Total: ${formatCurrency(totalRevenue)}`, 14, 48);
    doc.text(`Total de Pedidos: ${totalOrders}`, 14, 55);
    doc.text(`Unidades Vendidas: ${totalUnitsSold}`, 14, 62);
    doc.text(`Ticket Médio: ${formatCurrency(avgOrderValue)}`, 14, 69);
    const tableData = filteredOrders.map((o) => [o.data_pedido, o.canal, o.status, formatCurrency(Number(o.total) || 0), formatCurrency(Number(o.impostos) || 0), formatCurrency(Number(o.frete_total) || 0), formatCurrency(Number(o.descontos) || 0)]);
    autoTable(doc, { startY: 78, head: [['Data', 'Canal', 'Status', 'Total', 'Impostos', 'Frete', 'Descontos']], body: tableData, styles: { fontSize: 8 }, headStyles: { fillColor: [41, 128, 185] } });
    const finalY = (doc as any).lastAutoTable?.finalY || 78;
    if (finalY + 40 < doc.internal.pageSize.getHeight()) {
      doc.setFontSize(12);
      doc.text('Produtos Mais Vendidos', 14, finalY + 15);
      const prodData = topProducts.map((p, i) => [String(i + 1), p.name, String(p.qty), formatCurrency(p.revenue)]);
      autoTable(doc, { startY: finalY + 20, head: [['#', 'Produto', 'Qtd. Vendida', 'Receita']], body: prodData, styles: { fontSize: 8 }, headStyles: { fillColor: [41, 128, 185] } });
    }
    doc.save(`relatorio-vendas-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const clearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setChannelFilter('all');
    setActivePreset(null);
  };

  const handlePreset = (preset: DashboardPreset) => {
    const { from, to } = presetRange(preset);
    setDateFrom(from);
    setDateTo(to);
    setActivePreset(preset);
  };

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSectionOrder(prev => {
      const oldIdx = prev.indexOf(active.id as SectionId);
      const newIdx = prev.indexOf(over.id as SectionId);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const toggleSection = (id: SectionId) => {
    setSectionVisibility(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const visibleSections = sectionOrder.filter(id => sectionVisibility[id] !== false);

  // Render each section
  const renderSection = (id: SectionId) => {
    switch (id) {
      case 'stats':
        return (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            <Card className="min-w-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
                <Package className="h-4 w-4 text-[#994a00]" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-primary">{totalProducts}</div></CardContent>
            </Card>
            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
                <Users className="h-4 w-4 text-[#0563e6]" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-primary">{totalClients}</div></CardContent>
            </Card>
            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
                <DollarSign className="h-4 w-4 text-[#008512]" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-primary">{formatCurrency(totalRevenue)}</div></CardContent>
            </Card>
            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
                <ShoppingCart className="h-4 w-4 text-[#3f01a2]" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-primary">{totalOrders}</div></CardContent>
            </Card>
            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pedidos Cancelados</CardTitle>
                <XCircle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{cancelledCount}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(cancelledTotal)}</p>
              </CardContent>
            </Card>
            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unidades Vendidas</CardTitle>
                <Package className="h-4 w-4 text-[#028d5c]" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-primary">{totalUnitsSold}</div></CardContent>
            </Card>
            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                <TrendingUp className="h-4 w-4 text-[#eb7100]" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-primary">{formatCurrency(avgOrderValue)}</div></CardContent>
            </Card>
            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gasto com Shipping</CardTitle>
                <Truck className="h-4 w-4 text-[#c2185b]" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-primary">{formatCurrency(totalShippingCost)}</div></CardContent>
            </Card>
            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lucro Final</CardTitle>
                <Wallet className="h-4 w-4 text-[#029720]" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-[#029720]">{formatCurrency(totalLucroFinal)}</div></CardContent>
            </Card>
            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Comissões Plataformas</CardTitle>
                <CreditCard className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-destructive">{formatCurrency(totalComissoesPlataformas)}</div></CardContent>
            </Card>
            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tax</CardTitle>
                <Receipt className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-destructive">{formatCurrency(totalTax)}</div></CardContent>
            </Card>
          </div>
        );
      case 'charts':
        return (
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            <Card className="min-w-0 overflow-hidden">
              <CardHeader><CardTitle>Receita por Mês</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={revenueChartConfig} className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyRevenueData}>
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                        {monthlyRevenueData.map((_, idx) => (
                          <Cell key={idx} fill="var(--color-revenue)" fillOpacity={monthOpacityByIndex(idx, monthlyRevenueData.length)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card className="min-w-0 overflow-hidden">
              <CardHeader><CardTitle>Pedidos por Mês</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={ordersChartConfig} className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyOrdersData}>
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      {/* A thin line loses legibility if faded per-month like the bar charts, so
                          it stays solid — only the bars get the recency gradient. */}
                      <Line
                        type="monotone"
                        dataKey="orders"
                        stroke="var(--color-orders)"
                        strokeWidth={2}
                        dot={{ fill: "var(--color-orders)" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card className="min-w-0 overflow-hidden">
              <CardHeader><CardTitle>Quantidade Vendida por Mês</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={quantityChartConfig} className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyQuantityData}>
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="quantity" radius={[4, 4, 0, 0]}>
                        {monthlyQuantityData.map((_, idx) => (
                          <Cell key={idx} fill="var(--color-quantity)" fillOpacity={monthOpacityByIndex(idx, monthlyQuantityData.length)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card className="min-w-0 overflow-hidden">
              <CardHeader><CardTitle>Receita por Canal</CardTitle></CardHeader>
              <CardContent>
                {revenueByChannel.length > 0 ? (
                  <div className="space-y-4">
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={revenueByChannel} cx="50%" cy="50%" innerRadius="45%" outerRadius="70%" dataKey="value">
                            {revenueByChannel.map((_, idx) => (<Cell key={idx} fill={COLORS[idx % COLORS.length]} />))}
                          </Pie>
                          <ChartTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      {revenueByChannel.map((ch, idx) => {
                        const total = revenueByChannel.reduce((s, c) => s + c.value, 0);
                        const pct = total > 0 ? (ch.value / total) * 100 : 0;
                        const logo = channelLogos[ch.name];
                        return (
                          <div key={ch.name} className="flex items-center gap-2 text-sm min-w-0">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                            {logo && <img src={logo} alt={ch.name} className="h-4 w-4 object-contain shrink-0" />}
                            <span className="flex-1 truncate">{ch.name}</span>
                            <span className="text-muted-foreground shrink-0">{pct.toFixed(0)}%</span>
                            <span className="font-medium whitespace-nowrap shrink-0">{formatCurrency(ch.value)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Sem dados para o período</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      case 'topProducts':
        return (
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[#00a305]" />
                Produtos Mais Vendidos no Período
              </CardTitle>
              <div className="flex flex-wrap gap-1.5">
                {TOP_PRODUCTS_PERIODS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setTopProductsPeriod(p.value)}
                    className={cn(
                      "h-8 px-3 rounded-md text-xs font-medium border transition-colors",
                      topProductsPeriod === p.value
                        ? "bg-black text-white border-black"
                        : "bg-background text-muted-foreground border-input hover:bg-muted"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum dado disponível para o período selecionado.</p>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <span className="text-sm font-bold text-muted-foreground w-5 text-center">{idx + 1}</span>
                      <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.qty} unid. vendidas</p>
                      </div>
                      <span className="text-sm font-semibold whitespace-nowrap">{formatCurrency(p.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do seu negócio</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={handleRefreshAll} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            {refreshing ? 'Atualizando...' : 'Refresh'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2">
                <Download className="h-4 w-4" />
                Exportar Relatório
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4" />
                Exportar como CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF} className="gap-2 cursor-pointer">
                <FileText className="h-4 w-4" />
                Exportar como PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {todaySales && (
        <Card
          role="button"
          tabIndex={0}
          onClick={() => router.push('/admin/orders')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push('/admin/orders'); } }}
          className="border-2 border-[#029720]/30 cursor-pointer transition-colors hover:bg-[#029720]/5"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <PartyPopper className="h-5 w-5 text-[#029720]" />
              Vendas de Hoje
            </CardTitle>
            {visibleTodaySales.length > 0 && (
              <span className="text-sm font-semibold text-[#029720]">
                {visibleTodaySales.length} venda{visibleTodaySales.length > 1 ? 's' : ''} · {formatCurrency(visibleTodaySales.reduce((s, o) => s + (Number(o.total) || 0), 0))}
                {' '}<span className="text-muted-foreground font-normal">(Lucro {formatCurrency(todaySalesProfit)})</span>
              </span>
            )}
          </CardHeader>
          <CardContent>
            {visibleTodaySales.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma venda hoje ainda.</p>
            ) : (
              <div className="space-y-2">
                {visibleTodaySales.map((sale) => (
                  <div
                    key={sale.id}
                    className={cn(
                      "flex items-center gap-3 rounded-md p-2 transition-colors duration-500",
                      justSoldId === sale.id ? "bg-[#029720]/10" : "bg-transparent"
                    )}
                  >
                    {channelLogos[sale.canal] ? (
                      <img src={channelLogos[sale.canal]} alt={sale.canal} className="h-6 w-6 object-contain shrink-0" />
                    ) : (
                      <Store className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">Venda no {sale.canal}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(sale.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold whitespace-nowrap">{formatCurrency(Number(sale.total) || 0)}</p>
                      <p className="text-xs text-[#029720] whitespace-nowrap">Lucro {formatCurrency(sale.lucro)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ShipmentTrackingStrip />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-full space-y-1">
              <label className="text-sm font-medium">Período rápido</label>
              <div className="flex flex-wrap gap-1.5">
                {DASHBOARD_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => handlePreset(p.value)}
                    className={cn(
                      "h-9 px-3 rounded-md text-sm font-medium border transition-colors",
                      activePreset === p.value
                        ? "bg-black text-white border-black"
                        : "bg-background text-muted-foreground border-input hover:bg-muted"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1 w-full sm:w-auto">
              <label className="text-sm font-medium">Data Inicial    </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full sm:w-[180px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4 text-[#ff0000]" />
                    {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setActivePreset(null); }} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1 w-full sm:w-auto">
              <label className="text-sm font-medium">Data Final  </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full sm:w-[180px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4 text-[#ff0000]" />
                    {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setActivePreset(null); }} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1 w-full sm:w-auto">
              <label className="text-sm font-medium">Plataforma</label>
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Plataforma" />
                </SelectTrigger>
                <SelectContent>
                  {channelOptions.map((ch) => (
                    <SelectItem key={ch.value} value={ch.value}>
                      <div className="flex items-center gap-2">
                        {ch.icon}
                        <span>{ch.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="ghost" onClick={clearFilters} className="text-sm">
              Limpar Filtros
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Eye className="h-4 w-4" />
                  Seções
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Visibilidade das Seções</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ALL_SECTIONS.map(s => (
                  <DropdownMenuCheckboxItem
                    key={s.id}
                    checked={sectionVisibility[s.id] !== false}
                    onCheckedChange={() => toggleSection(s.id)}
                  >
                    {s.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Draggable Sections */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
        <SortableContext items={visibleSections} strategy={verticalListSortingStrategy}>
          {visibleSections.map(id => (
            <SortableSection key={id} id={id}>
              {renderSection(id)}
            </SortableSection>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
