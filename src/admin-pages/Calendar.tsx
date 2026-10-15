import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  type TimelineCar as Car,
  type TimelineBooking as Booking,
  TimelineView,
  STATUS_COLOR,
  TURO_COLOR,
  TODAY_COLOR,
  CarPhoto,
  carLabel,
  carClassLabel,
  parseIsoDate,
  isoOf,
  addDays,
  fmtShort,
  DOW,
} from '@/components/admin/BookingTimeline';

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

type TuroTripRow = {
  id: string;
  product_id: string | null;
  status: string;
  guest_name: string | null;
  vehicle_id: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_image_url: string | null;
  pickup_date: string | null;
  return_date: string | null;
  location_timezone: string | null;
};

// turo_trips lives in the vertex schema but isn't in the generated Database types,
// so query it through a minimal untyped view of the client.
type TuroQuery = {
  select: (cols: string) => {
    order: (col: string, opts?: { ascending?: boolean }) => Promise<{ data: TuroTripRow[] | null; error: unknown }>;
  };
};
function turoTable() {
  return (supabase as unknown as { from: (t: string) => TuroQuery }).from('turo_trips');
}

// Turo stores pickup/return as UTC timestamptz; the timeline positions by local
// calendar date, so convert to the trip's own timezone (FL cars → America/New_York).
function tzDateISO(iso: string | null, tz?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function tzTime(iso: string | null, tz?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { timeZone: tz || 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

function turoLabel(t: TuroTripRow): string {
  return [t.vehicle_year, t.vehicle_make, t.vehicle_model].filter(Boolean).join(' ') || 'Turo Vehicle';
}

export default function CalendarPage() {
  const [view, setView] = useState<'timeline' | 'month'>('timeline');
  const [cars, setCars] = useState<Car[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [allTuroTrips, setTuroTrips] = useState<TuroTripRow[]>([]);
  const [showTuro, setShowTuro] = useState(true);
  // Cancelled trips don't occupy the calendar
  const turoTrips = useMemo(() => allTuroTrips.filter((t) => !/cancel/i.test(t.status)), [allTuroTrips]);
  const [loading, setLoading] = useState(true);
  const today = useMemo(() => startOfDay(new Date()), []);
  const [timelineStart, setTimelineStart] = useState(() => addDays(today, -1));
  const [monthCursor, setMonthCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const TL_DAYS = 14;

  useEffect(() => {
    (async () => {
      const [carsRes, bookingsRes, turoRes] = await Promise.all([
        supabase.from('products').select('id, name, make, model, year, image_url, store_categories').order('name'),
        supabase
          .from('bookings')
          .select('id, car_id, status, pickup_date, pickup_time, return_date, return_time, driver_full_name, customer_name')
          .neq('status', 'cancelled')
          .order('pickup_date'),
        turoTable()
          .select('id, product_id, status, guest_name, vehicle_id, vehicle_make, vehicle_model, vehicle_year, vehicle_image_url, pickup_date, return_date, location_timezone')
          .order('pickup_date'),
      ]);
      setCars((carsRes.data as Car[] | null) ?? []);
      setBookings((bookingsRes.data as Booking[] | null) ?? []);
      setTuroTrips((turoRes.data as TuroTripRow[] | null) ?? []);
      setLoading(false);
    })();
  }, []);

  // Turo trips as timeline bookings. Matched trips (product_id) ride their car's
  // row; unmatched trips get synthetic rows so Turo-only vehicles still show.
  const turoBookings = useMemo<Booking[]>(() => {
    if (!showTuro) return [];
    const out: Booking[] = [];
    for (const t of turoTrips) {
      const pd = tzDateISO(t.pickup_date, t.location_timezone);
      const rd = tzDateISO(t.return_date, t.location_timezone);
      if (!pd || !rd) continue;
      out.push({
        id: `turo:${t.id}`,
        car_id: t.product_id ?? `turo:${t.vehicle_id ?? t.id}`,
        status: t.status,
        pickup_date: pd,
        pickup_time: tzTime(t.pickup_date, t.location_timezone),
        return_date: rd,
        return_time: tzTime(t.return_date, t.location_timezone),
        driver_full_name: t.guest_name,
        customer_name: t.guest_name,
        source: 'turo',
      });
    }
    return out;
  }, [turoTrips, showTuro]);

  // Synthetic cars for Turo vehicles not registered in our fleet (no product match).
  const turoOnlyCars = useMemo<Car[]>(() => {
    if (!showTuro) return [];
    const byVehicle = new Map<string, Car>();
    for (const t of turoTrips) {
      if (t.product_id) continue;
      const key = `turo:${t.vehicle_id ?? t.id}`;
      if (byVehicle.has(key)) continue;
      byVehicle.set(key, {
        id: key,
        name: `${turoLabel(t)} (Turo)`,
        make: t.vehicle_make,
        model: t.vehicle_model,
        year: t.vehicle_year,
        image_url: t.vehicle_image_url,
        store_categories: null,
      });
    }
    return [...byVehicle.values()];
  }, [turoTrips, showTuro]);

  const allCars = useMemo(() => [...cars, ...turoOnlyCars], [cars, turoOnlyCars]);
  const allBookings = useMemo(() => [...bookings, ...turoBookings], [bookings, turoBookings]);

  const carById = useMemo(() => new Map(allCars.map((c) => [c.id, c])), [allCars]);

  const upcoming = useMemo(() => {
    type Event = { kind: 'Pickup' | 'Return'; date: Date; time: string; booking: Booking; car: Car };
    const events: Event[] = [];
    for (const b of bookings) {
      const car = carById.get(b.car_id);
      if (!car) continue;
      events.push({ kind: 'Pickup', date: parseIsoDate(b.pickup_date), time: b.pickup_time, booking: b, car });
      events.push({ kind: 'Return', date: parseIsoDate(b.return_date), time: b.return_time, booking: b, car });
    }
    return events
      .filter((e) => e.date >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 8);
  }, [bookings, carById, today]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendário</h1>
          <p className="text-muted-foreground font-bold">Reservas da frota, por carro ou por mês</p>
        </div>
        <div className="flex items-center gap-3">
          {turoTrips.length > 0 && (
            <Button
              size="sm"
              variant={showTuro ? 'default' : 'outline'}
              onClick={() => setShowTuro((v) => !v)}
              style={showTuro ? { background: TURO_COLOR.fg, borderColor: TURO_COLOR.fg } : { color: TURO_COLOR.fg, borderColor: TURO_COLOR.border }}
            >
              <span className="w-2 h-2 rounded-full mr-2" style={{ background: showTuro ? '#fff' : TURO_COLOR.fg }} />
              Turo ({turoTrips.length})
            </Button>
          )}
          <div className="inline-flex bg-muted rounded-lg p-1 gap-1">
            <Button
              size="sm"
              variant={view === 'timeline' ? 'default' : 'ghost'}
              className={view === 'timeline' ? '' : 'text-muted-foreground'}
              onClick={() => setView('timeline')}
            >
              Timeline por carro
            </Button>
            <Button
              size="sm"
              variant={view === 'month' ? 'default' : 'ghost'}
              className={view === 'month' ? '' : 'text-muted-foreground'}
              onClick={() => setView('month')}
            >
              Grade do mês
            </Button>
          </div>
        </div>
      </div>

      {allCars.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground font-bold">
            Nenhum carro cadastrado ainda. Adicione carros na página Carros primeiro.
          </CardContent>
        </Card>
      ) : view === 'timeline' ? (
        <TimelineView
          cars={allCars}
          bookings={allBookings}
          today={today}
          rangeStart={timelineStart}
          days={TL_DAYS}
          onPrev={() => setTimelineStart((s) => addDays(s, -7))}
          onNext={() => setTimelineStart((s) => addDays(s, 7))}
          onToday={() => setTimelineStart(addDays(today, -1))}
        />
      ) : (
        <MonthView
          cars={allCars}
          bookings={allBookings}
          today={today}
          cursor={monthCursor}
          onPrev={() => setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
          onNext={() => setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
          onToday={() => setMonthCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
        />
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Próximos agendamentos</CardTitle>
          <p className="text-xs text-muted-foreground font-bold">Retiradas e devoluções que estão chegando</p>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground font-bold py-6 text-center">
              Nenhuma reserva futura no momento.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {upcoming.map((e, i) => {
                const status = STATUS_COLOR[e.booking.status] ?? STATUS_COLOR.pending_payment;
                const renter = e.booking.customer_name || e.booking.driver_full_name || 'Guest';
                return (
                  <div key={i} className="flex gap-3 p-3 rounded-xl border bg-card">
                    <CarPhoto car={e.car} />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#0a6b73' }}>
                        {e.kind === 'Pickup' ? 'Retirada' : 'Devolução'}
                      </p>
                      <p className="text-sm font-bold truncate">{carLabel(e.car)}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono tabular-nums text-foreground">{fmtShort(e.date)}</span> · {e.time}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{renter}</p>
                      <span
                        className="inline-block text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mt-1"
                        style={{ color: status.fg, background: status.bg }}
                      >
                        {status.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ======================= MONTH VIEW =======================
function MonthView({
  cars, bookings, today, cursor, onPrev, onNext, onToday,
}: {
  cars: Car[]; bookings: Booking[]; today: Date; cursor: Date;
  onPrev: () => void; onNext: () => void; onToday: () => void;
}) {
  const carById = useMemo(() => new Map(cars.map((c) => [c.id, c])), [cars]);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthName = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const cells = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list: { date: Date; otherMonth: boolean }[] = [];
    for (let i = startWeekday; i > 0; i--) list.push({ date: addDays(firstOfMonth, -i), otherMonth: true });
    for (let i = 0; i < daysInMonth; i++) list.push({ date: addDays(firstOfMonth, i), otherMonth: false });
    while (list.length % 7 !== 0 || list.length < 42) {
      list.push({ date: addDays(list[list.length - 1].date, 1), otherMonth: true });
    }
    return list;
  }, [year, month]);

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      const start = parseIsoDate(b.pickup_date);
      const end = parseIsoDate(b.return_date);
      for (let d = start; d <= end; d = addDays(d, 1)) {
        const key = isoOf(d);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(b);
      }
    }
    return map;
  }, [bookings]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">{monthName}</CardTitle>
          <div className="flex gap-3 text-xs text-muted-foreground font-bold mt-1">
            <span className="inline-flex items-center gap-1">
              <i className="inline-block w-2 h-2 rounded-sm" style={{ background: STATUS_COLOR.confirmed.fg }} />
              Confirmado
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="inline-block w-2 h-2 rounded-sm" style={{ background: STATUS_COLOR.pending_payment.fg }} />
              Aguardando pagamento
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="inline-block w-2 h-2 rounded-sm" style={{ background: TURO_COLOR.fg }} />
              Turo
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={onToday}>Hoje</Button>
          <Button size="icon" variant="outline" onClick={onPrev}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="icon" variant="outline" onClick={onNext}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-7 border-t">
          {DOW.map((d) => (
            <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground py-2 border-b">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            const key = isoOf(cell.date);
            const dayBookings = (bookingsByDay.get(key) ?? []).filter((b) => carById.has(b.car_id));
            const shown = dayBookings.slice(0, 3);
            const overflow = dayBookings.length - shown.length;
            const isToday = key === isoOf(today);
            return (
              <div
                key={i}
                className={`min-h-[108px] border-r border-b p-1.5 flex flex-col gap-1 ${cell.otherMonth ? 'bg-muted/30' : ''} ${(i + 1) % 7 === 0 ? 'border-r-0' : ''}`}
              >
                <span
                  className={`font-mono tabular-nums text-xs w-5 h-5 flex items-center justify-center rounded ${cell.otherMonth ? 'text-muted-foreground/50' : 'text-muted-foreground'} ${isToday ? 'font-bold text-white' : ''}`}
                  style={isToday ? { background: TODAY_COLOR } : undefined}
                >
                  {cell.date.getDate()}
                </span>
                {shown.map((b) => {
                  const car = carById.get(b.car_id)!;
                  const status = b.source === 'turo' ? TURO_COLOR : (STATUS_COLOR[b.status] ?? STATUS_COLOR.pending_payment);
                  const renter = (b.customer_name || b.driver_full_name || 'Guest').split(' ')[0];
                  return (
                    <div
                      key={b.id}
                      title={`${carLabel(car)} — ${renter}`}
                      className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded truncate"
                      style={{ color: status.fg, background: status.bg }}
                    >
                      <span className="w-1 h-1 rounded-full shrink-0" style={{ background: status.fg }} />
                      <span className="truncate">{carClassLabel(car) || carLabel(car)} · {renter}</span>
                    </div>
                  );
                })}
                {overflow > 0 && <div className="text-[10px] font-bold text-muted-foreground px-1.5">+{overflow} mais</div>}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
