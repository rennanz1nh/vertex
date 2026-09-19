import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  type VehicleClass,
  VEHICLE_CLASS_LABEL,
  VEHICLE_CLASS_COLOR,
  NEUTRAL_VEHICLE_COLOR,
  vehicleClassOf,
} from '@/lib/vehicle-classes';

export type TimelineCar = {
  id: string;
  name: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  image_url: string | null;
  store_categories: string[] | null;
};

export type TimelineBooking = {
  id: string;
  car_id: string;
  status: 'pending_payment' | 'confirmed' | 'cancelled' | 'completed';
  pickup_date: string;
  pickup_time: string;
  return_date: string;
  return_time: string;
  driver_full_name: string | null;
  customer_name: string | null;
};

export const STATUS_COLOR: Record<string, { fg: string; bg: string; border: string; label: string }> = {
  confirmed: { fg: '#1b8f6b', bg: '#e2f4ec', border: '#1b8f6b59', label: 'Confirmed' },
  pending_payment: { fg: '#c07a12', bg: '#fbecd4', border: '#c07a1259', label: 'Pending payment' },
  completed: { fg: '#64748b', bg: '#eef1f6', border: '#64748b59', label: 'Completed' },
};
export const TODAY_COLOR = '#e0475a';

function carClass(car: TimelineCar): VehicleClass | null {
  return vehicleClassOf(car.store_categories);
}
function carColor(car: TimelineCar): string {
  const cls = carClass(car);
  return cls ? VEHICLE_CLASS_COLOR[cls] : NEUTRAL_VEHICLE_COLOR;
}
export function carLabel(car: TimelineCar): string {
  return car.name || [car.year, car.make, car.model].filter(Boolean).join(' ') || 'Vehicle';
}
export function carClassLabel(car: TimelineCar): string {
  const cls = carClass(car);
  return cls ? VEHICLE_CLASS_LABEL[cls] : '';
}

// Side-view silhouette that varies slightly by vehicle class — same shapes as the
// approved calendar mockup, just ported to a React component.
function CarGlyph({ car, color, size = 28 }: { car: TimelineCar; color: string; size?: number }) {
  const cls = carClass(car) ?? 'compact';
  const roof: Record<VehicleClass, string> = {
    compact: 'M6 11 L8.5 6.5 Q9.5 5.2 11.2 5.2 H16.8 Q18.5 5.2 19.3 6.6 L21.4 11 Z',
    'big-van': 'M5.5 11 L6.3 5.8 Q6.6 4.4 8.2 4.4 H19.5 Q21 4.4 21.3 6 L22 11 Z',
    luxe: 'M4.8 11.2 L8.6 7.6 Q9.6 6.6 11.4 6.6 H16.6 Q18 6.6 18.8 7.8 L21.6 11.2 Z',
    sport: 'M4.5 11.6 L9.5 8.4 Q10.6 7.6 12.4 7.6 H15.2 Q16.8 7.6 17.8 8.6 L22 11.6 Z',
  };
  const body: Record<VehicleClass, string> = {
    compact: 'M2.6 15.4 Q2.6 11 5.2 11 H21.8 Q24.4 11 24.4 15.4 V16.6 Q24.4 17.6 23.4 17.6 H3.6 Q2.6 17.6 2.6 16.6 Z',
    'big-van': 'M2 15.4 Q2 11 4.6 11 H23.4 Q26 11 26 15.4 V17 Q26 18 25 18 H3 Q2 18 2 17 Z',
    luxe: 'M1.8 15.6 Q1.8 11.2 5 11.2 H21.5 Q25.8 11.2 25.8 15.6 V16.8 Q25.8 17.8 24.8 17.8 H2.8 Q1.8 17.8 1.8 16.8 Z',
    sport: 'M2.2 15.8 Q2.2 11.6 5.6 11.6 H21 Q25 11.6 25 15.8 V16.8 Q25 17.6 24 17.6 H3.2 Q2.2 17.6 2.2 16.8 Z',
  };
  const w: Record<VehicleClass, number> = { compact: 27, 'big-van': 28, luxe: 27.6, sport: 27.2 };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${w[cls]} 23`} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d={body[cls]} fill={color} fillOpacity={0.16} />
      <path d={roof[cls]} fill={color} fillOpacity={0.28} />
      <path d={body[cls]} stroke={color} strokeWidth={1.3} strokeLinejoin="round" />
      <path d={roof[cls]} stroke={color} strokeWidth={1.3} strokeLinejoin="round" />
      <circle cx={7.6} cy={17.8} r={2.6} fill={color} />
      <circle cx={7.6} cy={17.8} r={1.1} fill="white" />
      <circle cx={w[cls] - 7.6} cy={17.8} r={2.6} fill={color} />
      <circle cx={w[cls] - 7.6} cy={17.8} r={1.1} fill="white" />
    </svg>
  );
}

export function CarPhoto({ car, size = 40 }: { car: TimelineCar; size?: number }) {
  const color = carColor(car);
  if (car.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={car.image_url}
        alt={carLabel(car)}
        className="rounded-lg object-cover shrink-0"
        style={{ width: size + 24, height: size + 24 }}
      />
    );
  }
  return (
    <div
      className="rounded-lg flex items-center justify-center shrink-0"
      style={{ width: size + 24, height: size + 24, background: `${color}22` }}
    >
      <CarGlyph car={car} color={color} size={size} />
    </div>
  );
}

// ---------- date helpers (local-midnight, no timezone drift) ----------
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function isoOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addDays(date: Date, n: number): Date {
  const x = new Date(date);
  x.setDate(x.getDate() + n);
  return x;
}
export function fmtShort(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Greedy interval-stacking so overlapping bookings on the same car (possible pre-payment,
// since nothing blocks two pending requests for the same dates) render in separate lanes
// instead of piling on top of each other.
function assignLanes(bookings: (TimelineBooking & { startOffset: number; endOffset: number })[]) {
  const sorted = [...bookings].sort((a, b) => a.startOffset - b.startOffset);
  const laneEnds: number[] = [];
  const withLane = sorted.map((b) => {
    let lane = laneEnds.findIndex((end) => end <= b.startOffset);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(b.endOffset);
    } else {
      laneEnds[lane] = b.endOffset;
    }
    return { ...b, lane };
  });
  return { items: withLane, laneCount: Math.max(1, laneEnds.length) };
}

export function TimelineView({
  cars, bookings, today, rangeStart, days, onPrev, onNext, onToday,
}: {
  cars: TimelineCar[]; bookings: TimelineBooking[]; today: Date; rangeStart: Date; days: number;
  onPrev: () => void; onNext: () => void; onToday: () => void;
}) {
  const dayList = useMemo(() => Array.from({ length: days }, (_, i) => addDays(rangeStart, i)), [rangeStart, days]);
  const todayOffset = Math.round((today.getTime() - rangeStart.getTime()) / 86400000);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">
            {fmtShort(dayList[0])} – {fmtShort(dayList[dayList.length - 1])}
          </CardTitle>
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
        <div className="overflow-x-auto">
          <div className="grid" style={{ gridTemplateColumns: `220px repeat(${days}, minmax(46px, 1fr))`, minWidth: 900 }}>
            {/* header corner */}
            <div className="sticky left-0 z-[3] bg-card border-b border-r" />
            {dayList.map((day, i) => {
              const isToday = isoOf(day) === isoOf(today);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div
                  key={i}
                  className={`text-center border-b border-l py-2 px-1 text-[11px] text-muted-foreground ${isWeekend ? 'bg-muted/40' : ''}`}
                  style={isToday ? { background: `${TODAY_COLOR}1a` } : undefined}
                >
                  <span className="block uppercase tracking-wide font-bold text-[10px]">{DOW[day.getDay()]}</span>
                  <span className="block mt-0.5 font-mono tabular-nums text-[13px] text-foreground">{day.getDate()}</span>
                </div>
              );
            })}

            {cars.map((car) => {
              const carBookings = bookings
                .filter((b) => b.car_id === car.id)
                .map((b) => {
                  const s = parseIsoDate(b.pickup_date);
                  const e = parseIsoDate(b.return_date);
                  return {
                    ...b,
                    startOffset: Math.round((s.getTime() - rangeStart.getTime()) / 86400000),
                    endOffset: Math.round((e.getTime() - rangeStart.getTime()) / 86400000) + 1,
                  };
                })
                .filter((b) => b.endOffset > 0 && b.startOffset < days);

              const { items, laneCount } = assignLanes(carBookings);
              const rowHeight = Math.max(52, laneCount * 38 + 14);

              return (
                <React.Fragment key={car.id}>
                  <div
                    className="sticky left-0 z-[2] bg-card flex items-center gap-2.5 px-3.5 border-r border-b"
                    style={{ height: rowHeight }}
                  >
                    <CarPhoto car={car} size={26} />
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold leading-tight truncate">{carLabel(car)}</p>
                      <p className="text-[11px] text-muted-foreground">{carClassLabel(car) || 'Sem categoria'}</p>
                    </div>
                  </div>

                  <div
                    className="relative border-b"
                    style={{
                      gridColumn: `2 / -1`,
                      height: rowHeight,
                      display: 'grid',
                      gridTemplateColumns: `repeat(${days}, minmax(46px, 1fr))`,
                    }}
                  >
                    {dayList.map((day, i) => (
                      <div key={i} className={`border-l h-full ${day.getDay() === 0 || day.getDay() === 6 ? 'bg-muted/40' : ''}`} />
                    ))}
                    {todayOffset >= 0 && todayOffset < days && (
                      <div
                        className="absolute top-0 bottom-0 w-[2px]"
                        style={{ left: `${(todayOffset / days) * 100}%`, background: TODAY_COLOR }}
                      />
                    )}
                    {items.map((b) => {
                      const start = Math.max(0, b.startOffset);
                      const end = Math.min(days, b.endOffset);
                      const status = STATUS_COLOR[b.status] ?? STATUS_COLOR.pending_payment;
                      const renter = b.customer_name || b.driver_full_name || 'Guest';
                      return (
                        <div
                          key={b.id}
                          title={`${renter} — ${status.label}`}
                          className="absolute h-[30px] rounded-lg flex items-center gap-1.5 px-2 text-[11px] font-bold overflow-hidden whitespace-nowrap border"
                          style={{
                            top: 8 + b.lane * 36,
                            left: `${(start / days) * 100}%`,
                            width: `calc(${((end - start) / days) * 100}% - 6px)`,
                            color: status.fg,
                            background: status.bg,
                            borderColor: status.border,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: status.fg }} />
                          {renter}
                        </div>
                      );
                    })}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
