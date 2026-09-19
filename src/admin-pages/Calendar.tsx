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

export default function CalendarPage() {
  const [view, setView] = useState<'timeline' | 'month'>('timeline');
  const [cars, setCars] = useState<Car[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const today = useMemo(() => startOfDay(new Date()), []);
  const [timelineStart, setTimelineStart] = useState(() => addDays(today, -1));
  const [monthCursor, setMonthCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const TL_DAYS = 14;

  useEffect(() => {
    (async () => {
      const [carsRes, bookingsRes] = await Promise.all([
        supabase.from('products').select('id, name, make, model, year, image_url, store_categories').order('name'),
        supabase
          .from('bookings')
          .select('id, car_id, status, pickup_date, pickup_time, return_date, return_time, driver_full_name, customer_name')
          .neq('status', 'cancelled')
          .order('pickup_date'),
      ]);
      setCars((carsRes.data as Car[] | null) ?? []);
      setBookings((bookingsRes.data as Booking[] | null) ?? []);
      setLoading(false);
    })();
  }, []);

  const carById = useMemo(() => new Map(cars.map((c) => [c.id, c])), [cars]);

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

      {cars.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground font-bold">
            Nenhum carro cadastrado ainda. Adicione carros na página Carros primeiro.
          </CardContent>
        </Card>
      ) : view === 'timeline' ? (
        <TimelineView
          cars={cars}
          bookings={bookings}
          today={today}
          rangeStart={timelineStart}
          days={TL_DAYS}
          onPrev={() => setTimelineStart((s) => addDays(s, -7))}
          onNext={() => setTimelineStart((s) => addDays(s, 7))}
          onToday={() => setTimelineStart(addDays(today, -1))}
        />
      ) : (
        <MonthView
          cars={cars}
          bookings={bookings}
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
                  const status = STATUS_COLOR[b.status] ?? STATUS_COLOR.pending_payment;
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
