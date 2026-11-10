import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRouter } from 'next/navigation';
import { authedFetch } from '@/lib/admin-fetch';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Trash2, CheckSquare, Columns3, GripVertical, Image as ImageIcon, Download, Loader2 } from 'lucide-react';
import BookingModal from '@/components/admin/BookingModal';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { parseLocalDate, formatShortDate, formatUsDate } from '@/lib/date-utils';
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_COLOR, type BookingStatus } from '@/lib/booking-status';
import { isInteractiveClickTarget } from '@/lib/utils';
import { downloadRentalAgreementPdf } from '@/lib/rental-agreement-pdf';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableHeader } from '@/components/table/SortableHeader';
import { ColumnViewButtons } from '@/components/table/ColumnViewButtons';
import { useColumnPreferences } from '@/hooks/useColumnPreferences';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { damageHoldReleaseAt } from '@/lib/booking-payment-plan';
import { MobilePageHeader, MobileSearch, ChipRow, Chip, ChipSelect, MobileList, MobileRow, RowAvatar, RowBadge, MobileFab, tinyDate } from '@/components/admin-v2/mobile';

type CarOption = { id: string; name: string | null; make: string | null; model: string | null; year: number | null; image_url: string | null; daily_rate: string | null; min_driver_age: number };

type BookingRow = {
  id: string;
  car_id: string;
  status: string;
  pickup_date: string;
  pickup_time: string;
  return_date: string;
  return_time: string;
  daily_rate: number;
  estimated_total: number;
  customer_name: string | null;
  customer_email: string | null;
  driver_full_name: string;
  driver_date_of_birth: string;
  driver_license_number: string;
  driver_license_state: string;
  driver_license_expiration: string;
  rental_agreement_signed_at: string | null;
  rental_agreement_signature_path: string | null;
  rental_agreement_version: string | null;
  turo_blocked_at: string | null;
  payment_plan: 'deposit_balance' | 'full' | null;
  deposit_amount: number | null;
  deposit_paid_at: string | null;
  balance_amount: number | null;
  balance_due_date: string | null;
  balance_status: 'none' | 'scheduled' | 'processing' | 'paid' | 'failed';
  balance_last_error: string | null;
  damage_hold_amount: number | null;
  damage_hold_status: 'none' | 'scheduled' | 'processing' | 'held' | 'failed' | 'released' | 'captured';
  damage_hold_expires_at: string | null;
  damage_hold_last_error: string | null;
  damage_hold_released_at: string | null;
  damage_charged_amount: number | null;
  damage_charge_note: string | null;
  returned_at: string | null;
  created_at: string;
  /** "turo" rows come from turo_trips (read-only here); everything else is ours. */
  source?: 'site' | 'turo';
  turo?: { tripId: string; vehicle: string; image: string | null; hostEarned: number | null; turoFee: number | null; rawStatus: string };
};

type TuroTripRow = {
  id: string;
  turo_trip_id: string;
  status: string;
  guest_name: string | null;
  product_id: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_image_url: string | null;
  pickup_date: string | null;
  return_date: string | null;
  location_timezone: string | null;
  earnings_amount: number | null;
  updated_at: string;
};

type TuroReceiptRow = { reservation_id: string; trip_total: number | null; host_earned: number | null; turo_fee: number | null };

function localParts(iso: string, timeZone: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return { date, time };
}

/** A Turo trip shaped like one of our bookings, so both live in the same table. */
function turoTripToRow(t: TuroTripRow, receipt: TuroReceiptRow | undefined): BookingRow | null {
  if (!t.pickup_date || !t.return_date) return null;
  const tz = t.location_timezone || 'America/New_York';
  const start = localParts(t.pickup_date, tz);
  const end = localParts(t.return_date, tz);
  const cancelled = /cancel/i.test(t.status);
  const finished = /complete/i.test(t.status) || new Date(t.return_date).getTime() < Date.now();
  const total = receipt?.trip_total ?? t.earnings_amount ?? 0;
  const days = Math.max(1, Math.round((new Date(t.return_date).getTime() - new Date(t.pickup_date).getTime()) / 86_400_000));
  return {
    id: `turo:${t.id}`,
    car_id: t.product_id ?? '',
    status: cancelled ? 'cancelled' : finished ? 'completed' : 'confirmed',
    pickup_date: start.date,
    pickup_time: start.time,
    return_date: end.date,
    return_time: end.time,
    daily_rate: total ? Number(total) / days : 0,
    estimated_total: Number(total) || 0,
    customer_name: t.guest_name || 'Hóspede Turo',
    customer_email: null,
    driver_full_name: t.guest_name || '',
    driver_date_of_birth: '',
    driver_license_number: '',
    driver_license_state: '',
    driver_license_expiration: '',
    rental_agreement_signed_at: null,
    rental_agreement_signature_path: null,
    rental_agreement_version: null,
    turo_blocked_at: null,
    payment_plan: null,
    deposit_amount: null,
    deposit_paid_at: null,
    balance_amount: null,
    balance_due_date: null,
    balance_status: 'none',
    balance_last_error: null,
    damage_hold_amount: null,
    damage_hold_status: 'none',
    damage_hold_expires_at: null,
    damage_hold_last_error: null,
    damage_hold_released_at: null,
    damage_charged_amount: null,
    damage_charge_note: null,
    returned_at: null,
    created_at: t.updated_at,
    source: 'turo',
    turo: {
      tripId: t.id,
      vehicle: [t.vehicle_year, t.vehicle_make, t.vehicle_model].filter(Boolean).join(' ') || 'Carro Turo',
      image: t.vehicle_image_url,
      hostEarned: receipt?.host_earned ?? null,
      turoFee: receipt?.turo_fee ?? null,
      rawStatus: t.status,
    },
  };
}

type ColumnDef = {
  id: string;
  label: string;
  headerClassName?: string;
  render: (booking: BookingRow, car: CarOption | undefined) => React.ReactNode;
};

const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);

function statusBadge(status: string) {
  const s = (BOOKING_STATUS_LABEL[status as BookingStatus] && status) as BookingStatus | undefined;
  const label = s ? BOOKING_STATUS_LABEL[s] : status;
  const color = s ? BOOKING_STATUS_COLOR[s] : { fg: '#64748b', bg: '#eef1f6', border: '#64748b59' };
  return (
    <span
      className="inline-block text-xs font-medium px-2 py-0.5 rounded-full border"
      style={{ color: color.fg, backgroundColor: color.bg, borderColor: color.border }}
    >
      {label}
    </span>
  );
}

const EMPTY_BOOKING: Record<string, unknown> = {};

/** One-line payment summary for phone rows (the full breakdown lives in the booking modal / desktop column). */
function paymentLine(b: BookingRow): { text: string; tone: 'muted' | 'green' | 'amber' | 'red' | 'blue' } {
  if (b.source === 'turo') return { text: 'Pago na Turo', tone: 'muted' };
  if (!b.payment_plan) return { text: 'Manual', tone: 'muted' };
  if (!b.deposit_paid_at) return { text: 'Aguardando cartão', tone: 'amber' };
  if (b.payment_plan === 'full') return { text: 'Pago 100%', tone: 'green' };
  if (b.balance_status === 'paid') return { text: 'Pago 100%', tone: 'green' };
  if (b.balance_status === 'failed') return { text: 'Saldo falhou', tone: 'red' };
  if (b.balance_status === 'processing') return { text: 'Cobrando saldo', tone: 'blue' };
  return { text: `Sinal pago · saldo ${tinyDate(b.balance_due_date)}`, tone: 'green' };
}

export default function Bookings() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [cars, setCars] = useState<CarOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'site' | 'turo'>('all');
  const router = useRouter();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [viewBooking, setViewBooking] = useState<Record<string, unknown> | null>(null);
  const [downloadingAgreementId, setDownloadingAgreementId] = useState<string | null>(null);

  const { profile } = useAuth();
  const { toast } = useToast();
  const isAdmin = profile?.role === 'admin';

  const handleDownloadAgreement = useCallback(async (booking: BookingRow, car: CarOption | undefined) => {
    if (!booking.rental_agreement_signature_path) return;
    setDownloadingAgreementId(booking.id);
    try {
      const { data, error } = await supabase.storage
        .from('vertex-rental-agreements')
        .createSignedUrl(booking.rental_agreement_signature_path, 300);
      if (error || !data?.signedUrl) throw error || new Error('Não foi possível gerar o link da assinatura.');
      await downloadRentalAgreementPdf({
        bookingId: booking.id,
        carName: car ? (car.name || [car.year, car.make, car.model].filter(Boolean).join(' ')) : 'Vehicle',
        pickupDate: formatUsDate(booking.pickup_date),
        pickupTime: booking.pickup_time,
        returnDate: formatUsDate(booking.return_date),
        returnTime: booking.return_time,
        driverFullName: booking.driver_full_name,
        driverDateOfBirth: formatUsDate(booking.driver_date_of_birth),
        driverLicenseNumber: booking.driver_license_number,
        driverLicenseState: booking.driver_license_state,
        driverLicenseExpiration: formatUsDate(booking.driver_license_expiration),
        signedAt: booking.rental_agreement_signed_at ? new Date(booking.rental_agreement_signed_at).toLocaleString('en-US') : '',
        agreementVersion: booking.rental_agreement_version,
        signatureUrl: data.signedUrl,
      });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao gerar PDF', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setDownloadingAgreementId(null);
    }
  }, [toast]);

  const [chargingId, setChargingId] = useState<string | null>(null);
  const chargeBalanceNow = useCallback(async (booking: BookingRow) => {
    if (!confirm(`Cobrar agora o saldo de ${formatCurrency(Number(booking.balance_amount))} no cartão salvo do cliente?`)) return;
    setChargingId(booking.id);
    try {
      const res = await authedFetch(`/api/admin/bookings/${booking.id}/charge-balance`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (data.ok) toast({ title: 'Saldo cobrado', description: formatCurrency(Number(booking.balance_amount)) });
      else toast({ title: 'Cobrança não realizada', description: data.reason || 'Erro', variant: 'destructive' });
      await fetchData();
    } finally {
      setChargingId(null);
    }
  }, [toast]);

  const paymentCell = useCallback((b: BookingRow) => {
    if (b.source === 'turo') {
      return (
        <div className="flex flex-col gap-0.5 text-xs">
          <span className="text-muted-foreground">Pago na Turo</span>
          {b.turo?.hostEarned != null && <span className="text-green-700">Você recebe {formatCurrency(Number(b.turo.hostEarned))}</span>}
        </div>
      );
    }
    if (!b.payment_plan) return <span className="text-muted-foreground text-xs">Manual</span>;
    if (!b.deposit_paid_at) return <span className="text-xs text-amber-700">Aguardando cartão</span>;
    if (b.payment_plan === 'full') return <span className="text-xs text-green-700">Pago 100%</span>;
    const due = b.balance_due_date ? formatShortDate(parseLocalDate(b.balance_due_date)) : '—';
    const bal = formatCurrency(Number(b.balance_amount));
    const canCharge = b.status === 'confirmed' && (b.balance_status === 'scheduled' || b.balance_status === 'failed');
    return (
      <div className="flex flex-col gap-0.5 text-xs">
        <span className="text-green-700">Sinal {formatCurrency(Number(b.deposit_amount))} pago</span>
        {b.balance_status === 'paid' && <span className="text-green-700">Saldo {bal} pago</span>}
        {b.balance_status === 'scheduled' && <span className="text-muted-foreground">Saldo {bal} em {due}</span>}
        {b.balance_status === 'processing' && <span className="text-blue-700">Cobrando saldo {bal}…</span>}
        {b.balance_status === 'failed' && (
          <span className="text-red-700" title={b.balance_last_error ?? ''}>Saldo {bal} falhou · tenta de novo em 24h</span>
        )}
        {canCharge && (
          <button
            type="button"
            className="self-start text-[11px] font-medium underline disabled:opacity-50"
            disabled={chargingId === b.id}
            onClick={() => chargeBalanceNow(b)}
          >
            {chargingId === b.id ? 'Cobrando…' : 'Cobrar saldo agora'}
          </button>
        )}
      </div>
    );
  }, [chargingId, chargeBalanceNow]);

  // ===== $99 damage deposit (hold placed on pick-up day, released 3 days after return) =====
  const [holdBusyId, setHoldBusyId] = useState<string | null>(null);
  const [damageFor, setDamageFor] = useState<BookingRow | null>(null);
  const [damageAmount, setDamageAmount] = useState('');
  const [damageNote, setDamageNote] = useState('');

  const holdAction = useCallback(async (booking: BookingRow, body: Record<string, unknown>, okTitle: string) => {
    setHoldBusyId(booking.id);
    try {
      const res = await authedFetch(`/api/admin/bookings/${booking.id}/damage-hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) toast({ title: okTitle });
      else toast({ title: 'Não foi possível', description: data.reason || data.error || 'Erro', variant: 'destructive' });
      await fetchData();
      return !!data.ok;
    } finally {
      setHoldBusyId(null);
    }
  }, [toast]);

  const markReturned = useCallback((b: BookingRow) => {
    const release = damageHoldReleaseAt({ returned_at: new Date().toISOString(), return_date: b.return_date });
    if (!confirm(`Marcar o carro como devolvido agora?\n\nA caução será liberada automaticamente em ${release.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}, a menos que você clique em "Cobrar dano" antes.`)) return;
    holdAction(b, { action: 'returned' }, 'Carro marcado como devolvido');
  }, [holdAction]);

  const holdCell = useCallback((b: BookingRow) => {
    if (b.source === 'turo' || !Number(b.damage_hold_amount) || b.damage_hold_status === 'none') {
      return <span className="text-muted-foreground text-xs">—</span>;
    }
    const amount = formatCurrency(Number(b.damage_hold_amount));
    const releaseAt = damageHoldReleaseAt({ returned_at: b.returned_at, return_date: b.return_date, return_time: b.return_time });
    const releaseLabel = releaseAt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const busy = holdBusyId === b.id;
    const s = b.damage_hold_status;
    const active = b.status !== 'cancelled' && ['scheduled', 'held', 'failed'].includes(s);
    const linkBtn = 'self-start text-[11px] font-medium underline disabled:opacity-50';
    return (
      <div className="flex flex-col gap-0.5 text-xs min-w-[170px]">
        {s === 'scheduled' && <span className="text-muted-foreground">{amount} bloqueia na retirada ({formatShortDate(parseLocalDate(b.pickup_date))})</span>}
        {s === 'processing' && <span className="text-blue-700">Processando {amount}…</span>}
        {s === 'held' && <span className="text-green-700">{amount} bloqueado no cartão</span>}
        {s === 'failed' && <span className="text-red-700" title={b.damage_hold_last_error ?? ''}>Bloqueio de {amount} falhou · tenta de novo em 24h</span>}
        {s === 'released' && <span className="text-muted-foreground">{amount} liberado{b.damage_hold_released_at ? ` em ${formatShortDate(new Date(b.damage_hold_released_at))}` : ''}</span>}
        {s === 'captured' && (
          <span className="text-amber-700" title={b.damage_charge_note ?? ''}>Dano cobrado: {formatCurrency(Number(b.damage_charged_amount))}</span>
        )}
        {s === 'held' && b.damage_hold_last_error && <span className="text-amber-700" title={b.damage_hold_last_error}>⚠ {b.damage_hold_last_error}</span>}
        {b.returned_at && <span className="text-muted-foreground">Devolvido em {formatShortDate(new Date(b.returned_at))}</span>}
        {active && (s === 'held' || s === 'scheduled' || s === 'failed') && (
          <span className="text-muted-foreground">{b.returned_at ? 'Libera' : 'Libera (sem devolução marcada)'} em {releaseLabel}</span>
        )}
        {b.status !== 'cancelled' && !b.returned_at && (b.status === 'confirmed' || b.status === 'completed') && (
          <Button size="sm" variant="outline" className="h-7 mt-1 self-start text-xs" disabled={busy} onClick={() => markReturned(b)}>
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Carro devolvido'}
          </Button>
        )}
        {active && (
          <div className="flex flex-wrap gap-x-3">
            {(s === 'held' || s === 'failed') && (
              <button type="button" className={`${linkBtn} text-red-700`} disabled={busy} onClick={() => { setDamageFor(b); setDamageAmount(String(Number(b.damage_hold_amount))); setDamageNote(''); }}>
                Cobrar dano
              </button>
            )}
            {s === 'held' && (
              <button type="button" className={linkBtn} disabled={busy}
                onClick={() => confirm(`Liberar agora os ${amount} bloqueados no cartão do cliente? Depois disso não dá mais para cobrar dano pela caução.`) && holdAction(b, { action: 'release' }, 'Caução liberada')}>
                Liberar agora
              </button>
            )}
            {s === 'failed' && (
              <button type="button" className={linkBtn} disabled={busy} onClick={() => holdAction(b, { action: 'retry' }, `${amount} bloqueado`)}>
                Tentar de novo
              </button>
            )}
          </div>
        )}
      </div>
    );
  }, [holdBusyId, holdAction, markReturned]);

  const [turoSavingId, setTuroSavingId] = useState<string | null>(null);
  const toggleTuroBlocked = useCallback(async (booking: BookingRow) => {
    const next = booking.turo_blocked_at ? null : new Date().toISOString();
    setTuroSavingId(booking.id);
    // turo_blocked_at is newer than the generated Database types.
    const { error } = await supabase.from('bookings').update({ turo_blocked_at: next } as never).eq('id', booking.id);
    setTuroSavingId(null);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, turo_blocked_at: next } : b)));
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // turo_trips / turo_receipts aren't in the generated Database types.
      const untyped = supabase as unknown as { from: (t: string) => { select: (c: string) => Promise<{ data: unknown[] | null; error: unknown }> } };
      const [{ data: bookingsData, error: bookingsError }, { data: carsData, error: carsError }, turoRes, receiptsRes] = await Promise.all([
        supabase.from('bookings').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('id, name, make, model, year, image_url, daily_rate, min_driver_age'),
        untyped.from('turo_trips').select('id, turo_trip_id, status, guest_name, product_id, vehicle_make, vehicle_model, vehicle_year, vehicle_image_url, pickup_date, return_date, location_timezone, earnings_amount, updated_at'),
        untyped.from('turo_receipts').select('reservation_id, trip_total, host_earned, turo_fee'),
      ]);

      if (bookingsError) throw bookingsError;
      if (carsError) throw carsError;
      // Turo is a bonus here: if it can't be read (no access, table missing) the site bookings still show.
      if (turoRes.error) console.error('Error fetching Turo trips:', turoRes.error);

      const receipts = new Map(((receiptsRes.data ?? []) as TuroReceiptRow[]).map((r) => [String(r.reservation_id), r]));
      const turoRows = ((turoRes.data ?? []) as TuroTripRow[])
        .map((t) => turoTripToRow(t, receipts.get(String(t.turo_trip_id))))
        .filter((r): r is BookingRow => !!r);
      const siteRows = ((bookingsData || []) as unknown as BookingRow[]).map((b) => ({ ...b, source: 'site' as const }));
      // Newest trip first, whichever side it came from.
      setBookings([...siteRows, ...turoRows].sort((a, b) => (b.pickup_date || '').localeCompare(a.pickup_date || '')));
      setCars((carsData || []) as CarOption[]);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const carsById = useMemo(() => new Map(cars.map((c) => [c.id, c])), [cars]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const car = carsById.get(booking.car_id);
      const carLabel = car ? (car.name || [car.year, car.make, car.model].filter(Boolean).join(' ')) : (booking.turo?.vehicle ?? '');
      const matchesSearch =
        (booking.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (booking.customer_email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        carLabel.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
      const matchesSource = sourceFilter === 'all' || (booking.source ?? 'site') === sourceFilter;

      return matchesSearch && matchesStatus && matchesSource;
    });
  }, [bookings, carsById, searchTerm, statusFilter, sourceFilter]);

  const toggleSelection = (bookingId: string) => {
    setSelectedBookings((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(bookingId)) newSet.delete(bookingId);
      else newSet.add(bookingId);
      return newSet;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedBookings.size === 0) return;
    setSaving(true);
    try {
      const idsToDelete = Array.from(selectedBookings);
      const { error } = await supabase.from('bookings').delete().in('id', idsToDelete);
      if (error) throw error;
      toast({ title: 'Sucesso!', description: `${idsToDelete.length} reserva(s) excluída(s) com sucesso.` });
      setSelectedBookings(new Set());
      setSelectionMode(false);
      fetchData();
    } catch (error) {
      console.error('Error deleting bookings:', error);
      toast({ title: 'Erro ao excluir', description: 'Ocorreu um erro ao excluir as reservas.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };


  // ===== Column definitions =====
  const columns: ColumnDef[] = useMemo(() => [
    {
      id: 'source', label: 'Origem',
      render: (booking) => (
        <TableCell>
          {booking.source === 'turo' ? (
            <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full border" style={{ color: '#593cfb', backgroundColor: '#efecff', borderColor: '#593cfb59' }}>Turo</span>
          ) : (
            <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full border border-gray-300 text-gray-700 bg-gray-50">Site</span>
          )}
        </TableCell>
      ),
    },
    {
      id: 'car', label: 'Carro',
      render: (booking, car) => {
        const image = car?.image_url || booking.turo?.image || null;
        const name = car ? (car.name || [car.year, car.make, car.model].filter(Boolean).join(' ')) : (booking.turo?.vehicle ?? '—');
        return (
          <TableCell>
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded overflow-hidden bg-muted flex items-center justify-center shrink-0">
                {image ? <img src={image} alt={name} className="w-full h-full object-cover" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
              </div>
              <span className="font-medium">{name}</span>
            </div>
          </TableCell>
        );
      },
    },
    {
      id: 'customer', label: 'Cliente',
      render: (booking) => (
        <TableCell>
          <div className="flex flex-col">
            <span className="font-medium">{booking.customer_name || '—'}</span>
            <span className="text-xs text-muted-foreground">{booking.source === 'turo' ? 'Hóspede Turo' : booking.customer_email || '—'}</span>
          </div>
        </TableCell>
      ),
    },
    {
      id: 'dates', label: 'Datas',
      render: (booking) => (
        <TableCell>
          {booking.pickup_date ? formatShortDate(parseLocalDate(booking.pickup_date)) : '—'}
          {' → '}
          {booking.return_date ? formatShortDate(parseLocalDate(booking.return_date)) : '—'}
        </TableCell>
      ),
    },
    {
      id: 'status', label: 'Status',
      render: (booking) => <TableCell>{statusBadge(booking.status)}</TableCell>,
    },
    {
      // Turo has no API to block dates, so every site booking is blocked there by hand.
      id: 'turo_block', label: 'Turo', headerClassName: 'text-center',
      render: (booking) => (
        <TableCell className="text-center">
          {booking.status === 'cancelled' || booking.source === 'turo' ? (
            <span className="text-muted-foreground text-xs">—</span>
          ) : booking.turo_blocked_at ? (
            <button
              type="button"
              className="text-xs font-medium text-green-700 hover:underline"
              title={`Bloqueado na Turo em ${formatShortDate(new Date(booking.turo_blocked_at))} — clique para desfazer`}
              disabled={turoSavingId === booking.id}
              onClick={() => toggleTuroBlocked(booking)}
            >
              Bloqueado
            </button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-amber-400 text-amber-700 text-xs"
              title="Bloqueie estas datas no calendário da Turo e clique aqui"
              disabled={turoSavingId === booking.id}
              onClick={() => toggleTuroBlocked(booking)}
            >
              {turoSavingId === booking.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Marcar bloqueado'}
            </Button>
          )}
        </TableCell>
      ),
    },
    {
      // Online payments: 20% deposit at checkout, 80% charged automatically 5 days before pickup.
      id: 'payment', label: 'Pagamento',
      render: (booking) => <TableCell>{paymentCell(booking)}</TableCell>,
    },
    {
      // Refundable $99 damage deposit: held on pick-up day, released 3 days after "Carro devolvido".
      id: 'damage_hold', label: 'Caução',
      render: (booking) => <TableCell>{holdCell(booking)}</TableCell>,
    },
    {
      id: 'daily_rate', label: 'Diária', headerClassName: 'text-right',
      render: (booking) => <TableCell className="text-right">{booking.daily_rate ? formatCurrency(Number(booking.daily_rate)) : '—'}</TableCell>,
    },
    {
      id: 'total', label: 'Total', headerClassName: 'text-right',
      render: (booking) => (
        <TableCell className="text-right font-medium text-green-600">
          {booking.source === 'turo' && !booking.estimated_total ? '—' : formatCurrency(Number(booking.estimated_total))}
        </TableCell>
      ),
    },
    {
      id: 'created_at', label: 'Criado em',
      render: (booking) => <TableCell>{booking.source === 'turo' ? '—' : booking.created_at ? formatShortDate(new Date(booking.created_at)) : '—'}</TableCell>,
    },
    {
      id: 'agreement', label: 'Contrato', headerClassName: 'text-center',
      render: (booking, car) => (
        <TableCell className="text-center">
          {booking.rental_agreement_signed_at && booking.rental_agreement_signature_path ? (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              disabled={downloadingAgreementId === booking.id}
              onClick={() => handleDownloadAgreement(booking, car)}
              title="Baixar Rental Agreement assinado"
            >
              {downloadingAgreementId === booking.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </TableCell>
      ),
    },
  ], [downloadingAgreementId, handleDownloadAgreement, turoSavingId, toggleTuroBlocked, paymentCell, holdCell]);

  const defaultOrder = useMemo(() => columns.map((c) => c.id), [columns]);
  const { columnOrder, columnVisibility, setColumnVisibility, handleDragEnd, reset, saveView, isDirty, visibleOrderedIds } =
    useColumnPreferences('bookings', defaultOrder);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const orderedColumns = useMemo(() => {
    const map = new Map(columns.map((c) => [c.id, c]));
    return visibleOrderedIds.map((id) => map.get(id)).filter((c): c is ColumnDef => !!c);
  }, [columns, visibleOrderedIds]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const totalCols = orderedColumns.length + (selectionMode && isAdmin ? 1 : 0);

  const openBooking = (booking: BookingRow) => {
    if (booking.source === 'turo') router.push(`/admin/turo?tab=reservations&trip=${booking.turo!.tripId}`);
    else setViewBooking(booking);
  };
  const sourceCount = (src: 'all' | 'site' | 'turo') => bookings.filter((b) => src === 'all' || (b.source ?? 'site') === src).length;

  return (
    <div className="space-y-6 max-md:space-y-3">
      {/* Phones: sticky title, search and filter chips, then one row per booking */}
      <MobilePageHeader
        title="Reservas"
        count={filteredBookings.length}
        actions={isAdmin ? [{ label: 'Selecionar para excluir', icon: <CheckSquare className="h-4 w-4" />, onSelect: () => { setSelectionMode(true); setSelectedBookings(new Set()); } }] : undefined}
      >
        {selectionMode && isAdmin && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
            <span className="flex-1 text-sm font-medium">{selectedBookings.size} selecionada(s)</span>
            <Button size="sm" variant="destructive" disabled={saving || selectedBookings.size === 0} onClick={handleDeleteSelected}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Excluir
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setSelectionMode(false); setSelectedBookings(new Set()); }}>
              Cancelar
            </Button>
          </div>
        )}
        <MobileSearch value={searchTerm} onChange={setSearchTerm} placeholder="Cliente, email ou carro" />
        <ChipRow>
          <Chip on={sourceFilter === 'all'} onClick={() => setSourceFilter('all')} count={sourceCount('all')}>Todas</Chip>
          <Chip on={sourceFilter === 'site'} onClick={() => setSourceFilter('site')} count={sourceCount('site')}>Site</Chip>
          <Chip on={sourceFilter === 'turo'} onClick={() => setSourceFilter('turo')} count={sourceCount('turo')}>Turo</Chip>
          <ChipSelect
            value={statusFilter}
            onChange={setStatusFilter}
            defaultValue="all"
            options={[{ value: 'all', label: 'Status' }, ...(Object.keys(BOOKING_STATUS_LABEL) as BookingStatus[]).map((st) => ({ value: st, label: BOOKING_STATUS_LABEL[st] }))]}
          />
        </ChipRow>
      </MobilePageHeader>

      <MobileList isEmpty={filteredBookings.length === 0} empty="Nenhuma reserva encontrada">
        {filteredBookings.map((booking) => {
          const car = carsById.get(booking.car_id);
          const carName = car ? (car.name || [car.year, car.make, car.model].filter(Boolean).join(' ')) : (booking.turo?.vehicle ?? '—');
          const selectable = selectionMode && isAdmin && booking.source !== 'turo';
          const dates = `${tinyDate(booking.pickup_date)} → ${tinyDate(booking.return_date)}`;
          const pay = paymentLine(booking);
          return (
            <MobileRow
              key={booking.id}
              selected={selectable && selectedBookings.has(booking.id)}
              onClick={() => (selectable ? toggleSelection(booking.id) : selectionMode ? undefined : openBooking(booking))}
              leading={
                <>
                  {selectable && <Checkbox checked={selectedBookings.has(booking.id)} className="pointer-events-none" aria-hidden />}
                  <RowAvatar name={carName} src={car?.image_url || booking.turo?.image} square />
                </>
              }
              title={booking.customer_name || '—'}
              meta={`${dates} · ${carName}`}
              badges={
                <>
                  {statusBadge(booking.status)}
                  {booking.source === 'turo' && <RowBadge style={{ color: '#593cfb', backgroundColor: '#efecff' }}>Turo</RowBadge>}
                  <RowBadge tone={pay.tone}>{pay.text}</RowBadge>
                </>
              }
              trailing={booking.source === 'turo' ? (booking.turo?.hostEarned != null ? formatCurrency(Number(booking.turo.hostEarned)) : '—') : formatCurrency(Number(booking.estimated_total))}
              trailingSub={booking.source === 'turo' && booking.turo?.hostEarned != null ? <span className="text-[10px] text-muted-foreground">você recebe</span> : undefined}
            />
          );
        })}
      </MobileList>
      {isAdmin && !selectionMode && <MobileFab onClick={() => setViewBooking(EMPTY_BOOKING)} label="Nova" />}

      <div className="flex flex-wrap justify-between items-center gap-4 max-md:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reservas</h1>
          <p className="text-muted-foreground font-bold">
            Reservas do site e da Turo, num lugar só {isAdmin && '(Admin)'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Button
              onClick={() => {
                if (selectionMode && selectedBookings.size > 0) {
                  handleDeleteSelected();
                } else {
                  setSelectionMode(!selectionMode);
                  setSelectedBookings(new Set());
                }
              }}
              variant={selectionMode && selectedBookings.size > 0 ? 'destructive' : 'outline'}
              disabled={saving}
            >
              {selectionMode && selectedBookings.size > 0 ? (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir ({selectedBookings.size})
                </>
              ) : (
                <>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Selecionar
                </>
              )}
            </Button>
          )}
          {isAdmin && (
            <Button onClick={() => setViewBooking(EMPTY_BOOKING)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Reserva
            </Button>
          )}
        </div>
      </div>

      <Card className="max-md:hidden">
        <CardHeader className="sticky top-[73px] z-10 bg-background border-b">
          <CardTitle>Lista de Reservas</CardTitle>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex items-center space-x-2 flex-1">
              <Search className="h-4 w-4 text-muted-foreground font-bold" />
              <Input
                placeholder="Buscar por cliente, email ou carro..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {(Object.keys(BOOKING_STATUS_LABEL) as BookingStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>{BOOKING_STATUS_LABEL[status]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as 'all' | 'site' | 'turo')}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Site + Turo</SelectItem>
                  <SelectItem value="site">Só site</SelectItem>
                  <SelectItem value="turo">Só Turo</SelectItem>
                </SelectContent>
              </Select>
              {(statusFilter !== 'all' || sourceFilter !== 'all') && (
                <Button variant="ghost" onClick={() => { setStatusFilter('all'); setSourceFilter('all'); }}>
                  Limpar Filtros
                </Button>
              )}

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
                  {columns.map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={columnVisibility[col.id] !== false}
                      onCheckedChange={(checked) =>
                        setColumnVisibility((prev) => ({ ...prev, [col.id]: !!checked }))
                      }
                      onSelect={(e) => e.preventDefault()}
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <ColumnViewButtons isDirty={isDirty} onSave={saveView} onReset={reset} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground font-bold mt-1">
            Dica: arraste o ícone <GripVertical className="inline h-3 w-3" /> ao lado de cada coluna para reordenar.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative w-full max-h-[calc(100vh-320px)] overflow-x-scroll overflow-y-auto border-t scrollbar-always">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <Table>
                <TableHeader className="sticky top-0 bg-card z-20 shadow-sm">
                  <TableRow className="border-b-2">
                    {selectionMode && isAdmin && <TableHead className="w-[50px] bg-card"></TableHead>}
                    <SortableContext items={orderedColumns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
                      {orderedColumns.map((col) => (
                        <SortableHeader key={col.id} id={col.id} className={col.headerClassName}>
                          <span>{col.label}</span>
                        </SortableHeader>
                      ))}
                    </SortableContext>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={totalCols || 1} className="text-center text-muted-foreground font-bold">
                        Nenhuma reserva encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBookings.map((booking) => (
                      <TableRow
                        key={booking.id}
                        className="cursor-pointer"
                        onClick={(e) => {
                          if (isInteractiveClickTarget(e)) return;
                          if (booking.source === 'turo') router.push(`/admin/turo?tab=reservations&trip=${booking.turo!.tripId}`);
                          else setViewBooking(booking);
                        }}
                      >
                        {selectionMode && isAdmin && (
                          <TableCell>
                            {booking.source !== 'turo' && (
                              <Checkbox
                                checked={selectedBookings.has(booking.id)}
                                onCheckedChange={() => toggleSelection(booking.id)}
                              />
                            )}
                          </TableCell>
                        )}
                        {orderedColumns.map((col) => (
                          <React.Fragment key={col.id}>
                            {col.render(booking, carsById.get(booking.car_id))}
                          </React.Fragment>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </DndContext>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!damageFor} onOpenChange={(o) => { if (!o) setDamageFor(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cobrar dano</DialogTitle>
            <DialogDescription>
              {damageFor?.damage_hold_status === 'held'
                ? `Cobra da caução bloqueada (até ${formatCurrency(Number(damageFor?.damage_hold_amount))}). O que sobrar é liberado para o cliente na hora.`
                : `O bloqueio da caução falhou, então o valor será cobrado direto no cartão salvo do cliente (até ${formatCurrency(Number(damageFor?.damage_hold_amount))}).`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="damage-amount">Valor (US$)</Label>
              <Input id="damage-amount" type="number" min="0.5" step="0.01" max={Number(damageFor?.damage_hold_amount ?? 99)} value={damageAmount} onChange={(e) => setDamageAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="damage-note">Motivo (fica registrado)</Label>
              <Textarea id="damage-note" rows={3} placeholder="Ex.: risco no para-choque traseiro" value={damageNote} onChange={(e) => setDamageNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDamageFor(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={!damageFor || holdBusyId === damageFor.id || !(Number(damageAmount) > 0) || Number(damageAmount) > Number(damageFor?.damage_hold_amount ?? 0)}
              onClick={async () => {
                if (!damageFor) return;
                const ok = await holdAction(damageFor, { action: 'charge', amount: Number(damageAmount), note: damageNote }, `Dano cobrado: ${formatCurrency(Number(damageAmount))}`);
                if (ok) setDamageFor(null);
              }}
            >
              {damageFor && holdBusyId === damageFor.id ? <Loader2 className="h-4 w-4 animate-spin" /> : `Cobrar ${formatCurrency(Number(damageAmount) || 0)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BookingModal
        booking={viewBooking}
        cars={cars}
        open={!!viewBooking}
        onClose={() => setViewBooking(null)}
        onChanged={fetchData}
      />
    </div>
  );
}
