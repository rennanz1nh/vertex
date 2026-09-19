import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, Download, CalendarIcon, Gauge, DollarSign, FileText, FileSpreadsheet, GripVertical, Eye, RefreshCw, XCircle, Car as CarIcon, CalendarClock, PartyPopper } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { format, isAfter, isBefore, startOfDay, endOfDay, subDays, startOfYear, endOfYear, subYears, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { parseLocalDate } from '@/lib/date-utils';
import {
  type VehicleClass,
  VEHICLE_CLASS_LABEL,
  VEHICLE_CLASS_COLOR,
  NEUTRAL_VEHICLE_COLOR,
  vehicleClassOf,
} from '@/lib/vehicle-classes';
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
import { TimelineView, addDays } from '@/components/admin/BookingTimeline';

type BookingStatus = 'pending_payment' | 'confirmed' | 'cancelled' | 'completed';

type Booking = {
  id: string;
  car_id: string;
  status: BookingStatus;
  pickup_date: string;
  pickup_time: string;
  return_date: string;
  return_time: string;
  driver_full_name: string | null;
  estimated_total: number;
  customer_name: string | null;
  customer_email: string | null;
  created_at: string;
};

type CarRow = {
  id: string;
  name: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  image_url: string | null;
  store_categories: string[] | null;
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending_payment: 'Aguardando pagamento',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  completed: 'Concluída',
};

const statusOptions: { value: 'all' | BookingStatus; label: string }[] = [
  { value: 'all', label: 'Todos os Status' },
  { value: 'pending_payment', label: STATUS_LABEL.pending_payment },
  { value: 'confirmed', label: STATUS_LABEL.confirmed },
  { value: 'completed', label: STATUS_LABEL.completed },
];

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  '#f59e0b',
  '#10b981',
  '#8b5cf6',
  '#ef4444',
];

// Ordinal opacity ramp for monthly chart data: most recent month renders solid, older
// months fade toward the surface.
const MIN_MONTH_OPACITY = 0.35;
function monthOpacityByIndex(idx: number, total: number): number {
  if (total <= 1) return 1;
  return MIN_MONTH_OPACITY + (idx / (total - 1)) * (1 - MIN_MONTH_OPACITY);
}

function carLabel(car: CarRow | undefined): string {
  if (!car) return 'Veículo removido';
  return car.name || [car.year, car.make, car.model].filter(Boolean).join(' ') || 'Vehicle';
}

function tripDays(pickupDate: string, returnDate: string): number {
  const start = parseLocalDate(pickupDate);
  const end = parseLocalDate(returnDate);
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

type TopCarsPeriod = '7d' | '30d' | '90d' | 'all';
const TOP_CARS_PERIODS: { value: TopCarsPeriod; label: string }[] = [
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

function presetRange(preset: DashboardPreset): { from: Date | undefined; to: Date | undefined } {
  const now = startOfDay(new Date());
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

const bookingsChartConfig = {
  bookings: { label: 'Reservas', color: 'hsl(var(--secondary))' },
};

const rentalDaysChartConfig = {
  days: { label: 'Diárias', color: 'hsl(var(--primary))' },
};

// Section definitions
const ALL_SECTIONS = [
  { id: 'stats', label: 'Cards de Resumo' },
  { id: 'charts', label: 'Gráficos (Receita, Reservas, Diárias, Categoria)' },
  { id: 'topCars', label: 'Carros Mais Reservados' },
] as const;

type SectionId = typeof ALL_SECTIONS[number]['id'];

const DEFAULT_ORDER: SectionId[] = ALL_SECTIONS.map(s => s.id);

function loadPrefs() {
  try {
    const stored = localStorage.getItem('dashboard.sectionPrefs.v2');
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
  localStorage.setItem('dashboard.sectionPrefs.v2', JSON.stringify({ order, visibility }));
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
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [cars, setCars] = useState<CarRow[]>([]);
  const [totalClients, setTotalClients] = useState(0);

  // "Reservas de Hoje": every booking created today, seeded on load and kept live via
  // Realtime so a brand-new "Request to Book" shows up here without a refresh.
  type TodayBooking = Booking;
  const [todayBookings, setTodayBookings] = useState<TodayBooking[] | null>(null);
  const visibleTodayBookings = useMemo(
    () => (todayBookings ?? []).filter((b) => b.status !== 'cancelled'),
    [todayBookings]
  );
  const todayBookingsTotal = useMemo(
    () => visibleTodayBookings.reduce((s, b) => s + (Number(b.estimated_total) || 0), 0),
    [visibleTodayBookings]
  );
  const [justBookedId, setJustBookedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  // Timeline calendar embedded right below "Reservas de Hoje" — same component as the
  // Calendário page, just fed from this page's own already-loaded bookings/cars.
  const timelineToday = useMemo(() => startOfDay(new Date()), []);
  const [timelineStart, setTimelineStart] = useState(() => addDays(timelineToday, -1));
  const activeBookings = useMemo(() => bookings.filter((b) => b.status !== 'cancelled'), [bookings]);

  // Section preferences
  const [sectionOrder, setSectionOrder] = useState<SectionId[]>(() => loadPrefs().order);
  const [sectionVisibility, setSectionVisibility] = useState<Record<SectionId, boolean>>(() => loadPrefs().visibility);

  // Filters
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all');
  const [activePreset, setActivePreset] = useState<DashboardPreset | null>(null);

  // Independent period filter for the "Carros Mais Reservados" card.
  const [topCarsPeriod, setTopCarsPeriod] = useState<TopCarsPeriod>('all');

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

  const BOOKING_SELECT = 'id, car_id, status, pickup_date, pickup_time, return_date, return_time, driver_full_name, estimated_total, customer_name, customer_email, created_at';

  const fetchTodayBookings = async () => {
    const startOfToday = startOfDay(new Date()).toISOString();
    const { data, error } = await supabase
      .from('bookings')
      .select(BOOKING_SELECT)
      .gte('created_at', startOfToday)
      .order('created_at', { ascending: false });
    if (error) { console.error('Error fetching today\'s bookings:', error); return; }
    setTodayBookings((data as Booking[]) || []);
  };

  useEffect(() => {
    fetchTodayBookings();

    const channel = supabase
      .channel('admin-dashboard-new-bookings')
      .on('postgres_changes', { event: 'INSERT', schema: 'vertex', table: 'bookings' }, (payload) => {
        const newBookingId = (payload.new as { id: string }).id;
        // Realtime's INSERT payload is the bare row — simpler to just refetch than to
        // reshape it by hand.
        fetchTodayBookings();
        setJustBookedId(newBookingId);
        setTimeout(() => setJustBookedId((id) => (id === newBookingId ? null : id)), 5000);
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    try {
      const [bookingsRes, carsRes, clientsRes] = await Promise.all([
        supabase.from('bookings').select(BOOKING_SELECT),
        supabase.from('products').select('id, name, make, model, year, image_url, store_categories'),
        supabase.from('clients').select('id', { count: 'exact', head: true }),
      ]);
      setBookings((bookingsRes.data as Booking[]) || []);
      setCars((carsRes.data as CarRow[]) || []);
      setTotalClients(clientsRes.count || 0);
    } catch (e) {
      console.error('Error fetching report data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchData(), fetchTodayBookings()]);
      toast({ title: 'Dashboard atualizado' });
    } finally {
      setRefreshing(false);
    }
  };

  const carById = useMemo(() => new Map(cars.map((c) => [c.id, c])), [cars]);

  // Shared date/status guard so filteredBookings and cancelledBookings don't each
  // reimplement the same comparison — only the status condition differs between the two.
  const matchesDateStatus = useCallback((b: Booking) => {
    const date = parseLocalDate(b.pickup_date);
    if (dateFrom && isBefore(date, startOfDay(dateFrom))) return false;
    if (dateTo && isAfter(date, endOfDay(dateTo))) return false;
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    return true;
  }, [dateFrom, dateTo, statusFilter]);

  // Cancelled bookings are excluded from every dashboard metric — they never happened as
  // far as revenue/occupancy is concerned, and are surfaced separately below instead.
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => matchesDateStatus(b) && b.status !== 'cancelled');
  }, [bookings, matchesDateStatus]);

  const cancelledBookings = useMemo(() => {
    return bookings.filter((b) => matchesDateStatus(b) && b.status === 'cancelled');
  }, [bookings, matchesDateStatus]);
  const cancelledCount = cancelledBookings.length;
  const cancelledTotal = useMemo(() => cancelledBookings.reduce((s, b) => s + (Number(b.estimated_total) || 0), 0), [cancelledBookings]);

  const totalRevenue = useMemo(() => filteredBookings.reduce((s, b) => s + (Number(b.estimated_total) || 0), 0), [filteredBookings]);
  const totalBookingsCount = filteredBookings.length;
  const avgBookingValue = totalBookingsCount > 0 ? totalRevenue / totalBookingsCount : 0;
  const totalRentalDays = useMemo(
    () => filteredBookings.reduce((s, b) => s + tripDays(b.pickup_date, b.return_date), 0),
    [filteredBookings]
  );

  // "Right now" snapshot, independent of the date-range filter above: of the whole fleet,
  // how many cars have a non-cancelled booking covering today.
  const occupancyRate = useMemo(() => {
    if (cars.length === 0) return 0;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const bookedCarIds = new Set(
      bookings
        .filter((b) => b.status !== 'cancelled' && b.pickup_date <= todayStr && b.return_date >= todayStr)
        .map((b) => b.car_id)
    );
    return (bookedCarIds.size / cars.length) * 100;
  }, [bookings, cars]);

  const monthlyRevenueData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredBookings.forEach((b) => {
      const d = parseLocalDate(b.pickup_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + (Number(b.estimated_total) || 0);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([m, revenue]) => ({
      month: parseLocalDate(m + '-01').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
      revenue,
    }));
  }, [filteredBookings]);

  const monthlyBookingsData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredBookings.forEach((b) => {
      const d = parseLocalDate(b.pickup_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([m, bookings]) => ({
      month: parseLocalDate(m + '-01').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
      bookings,
    }));
  }, [filteredBookings]);

  const monthlyRentalDaysData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredBookings.forEach((b) => {
      const d = parseLocalDate(b.pickup_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + tripDays(b.pickup_date, b.return_date);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([m, days]) => ({
      month: parseLocalDate(m + '-01').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
      days,
    }));
  }, [filteredBookings]);

  const revenueByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredBookings.forEach((b) => {
      const cls = vehicleClassOf(carById.get(b.car_id)?.store_categories);
      const label = cls ? VEHICLE_CLASS_LABEL[cls] : 'Sem categoria';
      map[label] = (map[label] || 0) + (Number(b.estimated_total) || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredBookings, carById]);

  function categoryColor(name: string, idx: number): string {
    const cls = (Object.entries(VEHICLE_CLASS_LABEL).find(([, label]) => label === name)?.[0]) as VehicleClass | undefined;
    if (cls) return VEHICLE_CLASS_COLOR[cls];
    if (name === 'Sem categoria') return NEUTRAL_VEHICLE_COLOR;
    return COLORS[idx % COLORS.length];
  }

  // "Carros Mais Reservados" has its own period filter (7d/30d/90d/tempo todo), independent
  // of the Data Inicial/Final pickers above — it still respects the status filter, though.
  const topCarsBookings = useMemo(() => {
    const statusMatch = (b: Booking) => (statusFilter === 'all' || b.status === statusFilter) && b.status !== 'cancelled';
    if (topCarsPeriod === 'all') return bookings.filter(statusMatch);
    const days = topCarsPeriod === '7d' ? 7 : topCarsPeriod === '30d' ? 30 : 90;
    const cutoff = startOfDay(subDays(new Date(), days - 1));
    return bookings.filter((b) => statusMatch(b) && !isBefore(parseLocalDate(b.pickup_date), cutoff));
  }, [bookings, statusFilter, topCarsPeriod]);

  const topCars = useMemo(() => {
    const map: Record<string, { car: CarRow | undefined; count: number; revenue: number }> = {};
    topCarsBookings.forEach((b) => {
      if (!map[b.car_id]) map[b.car_id] = { car: carById.get(b.car_id), count: 0, revenue: 0 };
      map[b.car_id].count += 1;
      map[b.car_id].revenue += Number(b.estimated_total) || 0;
    });
    // Ranqueado por receita, do maior para o menor; a contagem de reservas só desempata.
    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue || b.count - a.count)
      .slice(0, 10);
  }, [topCarsBookings, carById]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

  const handleExportCSV = () => {
    const headers = ['Data', 'Carro', 'Cliente', 'Status', 'Total'];
    const rows = filteredBookings.map((b) => [
      b.pickup_date, carLabel(carById.get(b.car_id)), b.customer_name || '', STATUS_LABEL[b.status], Number(b.estimated_total) || 0,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-reservas-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(18);
    doc.text('Relatório de Reservas', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(10);
    const dateRange = [dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Início', dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Hoje'].join(' - ');
    const statusLabel = statusOptions.find((s) => s.value === statusFilter)?.label || 'Todos os Status';
    doc.text(`Período: ${dateRange}  |  Status: ${statusLabel}`, pageWidth / 2, 28, { align: 'center' });
    doc.setFontSize(12);
    doc.text('Resumo', 14, 40);
    doc.setFontSize(10);
    doc.text(`Receita Total: ${formatCurrency(totalRevenue)}`, 14, 48);
    doc.text(`Total de Reservas: ${totalBookingsCount}`, 14, 55);
    doc.text(`Diárias Reservadas: ${totalRentalDays}`, 14, 62);
    doc.text(`Ticket Médio: ${formatCurrency(avgBookingValue)}`, 14, 69);
    const tableData = filteredBookings.map((b) => [
      b.pickup_date, carLabel(carById.get(b.car_id)), b.customer_name || '-', STATUS_LABEL[b.status], formatCurrency(Number(b.estimated_total) || 0),
    ]);
    autoTable(doc, { startY: 78, head: [['Data', 'Carro', 'Cliente', 'Status', 'Total']], body: tableData, styles: { fontSize: 8 }, headStyles: { fillColor: [41, 128, 185] } });
    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 78;
    if (finalY + 40 < doc.internal.pageSize.getHeight()) {
      doc.setFontSize(12);
      doc.text('Carros Mais Reservados', 14, finalY + 15);
      const carData = topCars.map((c, i) => [String(i + 1), carLabel(c.car), String(c.count), formatCurrency(c.revenue)]);
      autoTable(doc, { startY: finalY + 20, head: [['#', 'Carro', 'Reservas', 'Receita']], body: carData, styles: { fontSize: 8 }, headStyles: { fillColor: [41, 128, 185] } });
    }
    doc.save(`relatorio-reservas-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const clearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setStatusFilter('all');
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
                <CardTitle className="text-sm font-medium">Total de Carros</CardTitle>
                <CarIcon className="h-4 w-4 text-[#994a00]" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-primary">{cars.length}</div></CardContent>
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
                <CardTitle className="text-sm font-medium">Total de Reservas</CardTitle>
                <CalendarClock className="h-4 w-4 text-[#3f01a2]" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-primary">{totalBookingsCount}</div></CardContent>
            </Card>
            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Reservas Canceladas</CardTitle>
                <XCircle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{cancelledCount}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(cancelledTotal)}</p>
              </CardContent>
            </Card>
            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Diárias Reservadas</CardTitle>
                <CalendarIcon className="h-4 w-4 text-[#028d5c]" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-primary">{totalRentalDays}</div></CardContent>
            </Card>
            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                <TrendingUp className="h-4 w-4 text-[#eb7100]" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-primary">{formatCurrency(avgBookingValue)}</div></CardContent>
            </Card>
            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Ocupação Hoje</CardTitle>
                <Gauge className="h-4 w-4 text-[#c2185b]" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-primary">{occupancyRate.toFixed(0)}%</div></CardContent>
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
              <CardHeader><CardTitle>Reservas por Mês</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={bookingsChartConfig} className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyBookingsData}>
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      {/* A thin line loses legibility if faded per-month like the bar charts, so
                          it stays solid — only the bars get the recency gradient. */}
                      <Line
                        type="monotone"
                        dataKey="bookings"
                        stroke="var(--color-bookings)"
                        strokeWidth={2}
                        dot={{ fill: "var(--color-bookings)" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card className="min-w-0 overflow-hidden">
              <CardHeader><CardTitle>Diárias Reservadas por Mês</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={rentalDaysChartConfig} className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyRentalDaysData}>
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="days" radius={[4, 4, 0, 0]}>
                        {monthlyRentalDaysData.map((_, idx) => (
                          <Cell key={idx} fill="var(--color-days)" fillOpacity={monthOpacityByIndex(idx, monthlyRentalDaysData.length)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card className="min-w-0 overflow-hidden">
              <CardHeader><CardTitle>Receita por Categoria de Veículo</CardTitle></CardHeader>
              <CardContent>
                {revenueByCategory.length > 0 ? (
                  <div className="space-y-4">
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={revenueByCategory} cx="50%" cy="50%" innerRadius="45%" outerRadius="70%" dataKey="value">
                            {revenueByCategory.map((entry, idx) => (<Cell key={idx} fill={categoryColor(entry.name, idx)} />))}
                          </Pie>
                          <ChartTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      {revenueByCategory.map((cat, idx) => {
                        const total = revenueByCategory.reduce((s, c) => s + c.value, 0);
                        const pct = total > 0 ? (cat.value / total) * 100 : 0;
                        return (
                          <div key={cat.name} className="flex items-center gap-2 text-sm min-w-0">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: categoryColor(cat.name, idx) }} />
                            <span className="flex-1 truncate">{cat.name}</span>
                            <span className="text-muted-foreground shrink-0">{pct.toFixed(0)}%</span>
                            <span className="font-medium whitespace-nowrap shrink-0">{formatCurrency(cat.value)}</span>
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
      case 'topCars':
        return (
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[#00a305]" />
                Carros Mais Reservados no Período
              </CardTitle>
              <div className="flex flex-wrap gap-1.5">
                {TOP_CARS_PERIODS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setTopCarsPeriod(p.value)}
                    className={cn(
                      "h-8 px-3 rounded-md text-xs font-medium border transition-colors",
                      topCarsPeriod === p.value
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
              {topCars.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum dado disponível para o período selecionado.</p>
              ) : (
                <div className="space-y-3">
                  {topCars.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <span className="text-sm font-bold text-muted-foreground w-5 text-center">{idx + 1}</span>
                      <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                        {c.car?.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.car.image_url} alt={carLabel(c.car)} className="h-full w-full object-cover" />
                        ) : (
                          <CarIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{carLabel(c.car)}</p>
                        <p className="text-xs text-muted-foreground">{c.count} reserva{c.count > 1 ? 's' : ''}</p>
                      </div>
                      <span className="text-sm font-semibold whitespace-nowrap">{formatCurrency(c.revenue)}</span>
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
          <Button variant="outline" className="gap-2" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
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

      {todayBookings && (
        <Card
          role="button"
          tabIndex={0}
          onClick={() => router.push('/admin/calendar')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push('/admin/calendar'); } }}
          className="border-2 border-[#029720]/30 cursor-pointer transition-colors hover:bg-[#029720]/5"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <PartyPopper className="h-5 w-5 text-[#029720]" />
              Reservas de Hoje
            </CardTitle>
            {visibleTodayBookings.length > 0 && (
              <span className="text-sm font-semibold text-[#029720]">
                {visibleTodayBookings.length} reserva{visibleTodayBookings.length > 1 ? 's' : ''} · {formatCurrency(todayBookingsTotal)}
              </span>
            )}
          </CardHeader>
          <CardContent>
            {visibleTodayBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma reserva hoje ainda.</p>
            ) : (
              <div className="space-y-2">
                {visibleTodayBookings.map((booking) => {
                  const car = carById.get(booking.car_id);
                  return (
                    <div
                      key={booking.id}
                      className={cn(
                        "flex items-center gap-3 rounded-md p-2 transition-colors duration-500",
                        justBookedId === booking.id ? "bg-[#029720]/10" : "bg-transparent"
                      )}
                    >
                      <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {car?.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={car.image_url} alt={carLabel(car)} className="h-full w-full object-cover" />
                        ) : (
                          <CarIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{carLabel(car)} · {booking.customer_name || 'Guest'}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(booking.created_at), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold whitespace-nowrap">{formatCurrency(Number(booking.estimated_total) || 0)}</p>
                        <p className="text-xs text-muted-foreground whitespace-nowrap">{STATUS_LABEL[booking.status]}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {cars.length > 0 && (
        <TimelineView
          cars={cars}
          bookings={activeBookings}
          today={timelineToday}
          rangeStart={timelineStart}
          days={14}
          onPrev={() => setTimelineStart((s) => addDays(s, -7))}
          onNext={() => setTimelineStart((s) => addDays(s, 7))}
          onToday={() => setTimelineStart(addDays(timelineToday, -1))}
        />
      )}

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
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | BookingStatus)}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
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
