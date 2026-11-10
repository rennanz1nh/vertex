// Dashboard data: every rental from every channel (Turo trips, site bookings, Stripe
// payment-link orders) as one list, plus the period math and the insight aggregations the
// widgets draw. Pure functions only, so they can be tested without a database.
import { addDays, differenceInCalendarDays, endOfMonth, isAfter, startOfDay, startOfMonth, startOfYear, subDays, subMonths, subYears } from "date-fns";

export type Channel = "Turo" | "Site" | "Direto";
export const CHANNELS: Channel[] = ["Turo", "Site", "Direto"];
export const CHANNEL_COLORS: Record<Channel, string> = { Turo: "#593cfb", Site: "#111827", Direto: "#0ea5e9" };
export const CHANNEL_HINT: Record<Channel, string> = {
  Turo: "Viagens da Turo (valores dos recibos)",
  Site: "Reservas pagas no site",
  Direto: "Links de pagamento do Stripe",
};
export const CHART_COLORS = ["#593cfb", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#84cc16", "#f97316", "#64748b"];

export type Rental = {
  id: string;
  channel: Channel;
  /** Pickup day (business calendar day). */
  start: Date;
  end: Date | null;
  days: number;
  /** What the customer paid. */
  gross: number;
  /** What we keep (Turo: host earnings; elsewhere the same as gross). */
  net: number;
  /** Platform fee (Turo). */
  fee: number;
  carId: string | null;
  carLabel: string;
  customerKey: string | null;
  customerName: string;
  cancelled: boolean;
};

// ---- Raw rows -------------------------------------------------------------------------

export type TuroTripRow = {
  id: string;
  turo_trip_id: string;
  status: string;
  pickup_date: string | null;
  return_date: string | null;
  location_timezone: string | null;
  product_id: string | null;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  renter_id: string | null;
  guest_name: string | null;
};
export type TuroReceiptRow = { reservation_id: string; trip_total: number | string | null; host_earned: number | string | null; turo_fee: number | string | null };
export type BookingRow = {
  id: string;
  car_id: string | null;
  status: string;
  pickup_date: string;
  return_date: string;
  estimated_total: number | string | null;
  customer_email: string | null;
  customer_name: string | null;
};
export type OrderRow = { id: string; data_pedido: string | null; created_at?: string | null; total: number | string | null; status: string | null; client_id: string | null; canal: string | null };
export type CarRow = { id: string; name: string | null; make: string | null; model: string | null; year: number | null; image_url: string | null; store_visible: boolean | null; daily_rate: string | null };
export type ClientRow = { id: string; nome_razao: string | null };

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const BUSINESS_TZ = "America/New_York";

/** Calendar day of an instant where the cars are, as a local-midnight Date. */
export function businessDay(iso: string, timeZone = BUSINESS_TZ): Date {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(iso))
    .split("-")
    .map(Number);
  return new Date(y, m - 1, d);
}

/** YYYY-MM-DD → local-midnight Date. */
export function localDate(ymd: string): Date {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function businessToday(now = new Date()): Date {
  return businessDay(now.toISOString());
}

export function carLabelOf(c: Pick<CarRow, "name" | "make" | "model" | "year"> | undefined): string {
  if (!c) return "Carro";
  return (c.name?.trim() || [c.year, c.make, c.model].filter(Boolean).join(" ").trim() || "Carro").replace(/\s+/g, " ");
}

export function buildRentals(input: {
  trips: TuroTripRow[];
  receipts: TuroReceiptRow[];
  bookings: BookingRow[];
  orders: OrderRow[];
  cars: CarRow[];
  clients: ClientRow[];
}): Rental[] {
  const carById = new Map(input.cars.map((c) => [c.id, c]));
  const receipt = new Map(input.receipts.map((r) => [String(r.reservation_id), r]));
  const clientName = new Map(input.clients.map((c) => [c.id, c.nome_razao ?? "Cliente"]));
  const out: Rental[] = [];

  for (const t of input.trips) {
    if (!t.pickup_date) continue;
    const tz = t.location_timezone || BUSINESS_TZ;
    const start = businessDay(t.pickup_date, tz);
    const end = t.return_date ? businessDay(t.return_date, tz) : null;
    const r = receipt.get(String(t.turo_trip_id));
    const gross = num(r?.trip_total);
    const net = r?.host_earned != null ? num(r.host_earned) : gross;
    const fee = r?.turo_fee != null ? Math.abs(num(r.turo_fee)) : Math.max(0, gross - net);
    const car = t.product_id ? carById.get(t.product_id) : undefined;
    out.push({
      id: `turo:${t.id}`,
      channel: "Turo",
      start,
      end,
      days: t.pickup_date && t.return_date
        ? Math.max(1, Math.round((new Date(t.return_date).getTime() - new Date(t.pickup_date).getTime()) / 86_400_000))
        : 1,
      gross,
      net,
      fee,
      carId: t.product_id,
      carLabel: car ? carLabelOf(car) : [t.vehicle_year, t.vehicle_make, t.vehicle_model].filter(Boolean).join(" ") || "Carro Turo",
      customerKey: t.renter_id ? `turo:${t.renter_id}` : t.guest_name ? `turo:${t.guest_name.toLowerCase()}` : null,
      customerName: t.guest_name || "Hóspede Turo",
      cancelled: /cancel/i.test(t.status),
    });
  }

  for (const b of input.bookings) {
    // Unpaid checkouts never became a rental.
    if (b.status === "pending_payment") continue;
    const start = localDate(b.pickup_date);
    const end = localDate(b.return_date);
    const gross = num(b.estimated_total);
    const car = b.car_id ? carById.get(b.car_id) : undefined;
    out.push({
      id: `site:${b.id}`,
      channel: "Site",
      start,
      end,
      days: Math.max(1, differenceInCalendarDays(end, start)),
      gross,
      net: gross,
      fee: 0,
      carId: b.car_id,
      carLabel: carLabelOf(car),
      customerKey: b.customer_email ? `email:${b.customer_email.toLowerCase()}` : null,
      customerName: b.customer_name || b.customer_email || "Cliente do site",
      cancelled: b.status === "cancelled",
    });
  }

  for (const o of input.orders) {
    const when = o.data_pedido || o.created_at;
    if (!when) continue;
    const gross = num(o.total);
    out.push({
      id: `direto:${o.id}`,
      channel: "Direto",
      start: /^\d{4}-\d{2}-\d{2}$/.test(when) ? localDate(when) : businessDay(when),
      end: null,
      days: 0, // a payment link carries no trip dates
      gross,
      net: gross,
      fee: 0,
      carId: null,
      carLabel: "Sem carro informado",
      customerKey: o.client_id ? `client:${o.client_id}` : null,
      customerName: (o.client_id && clientName.get(o.client_id)) || "Cliente direto",
      cancelled: /cancel/i.test(o.status ?? ""),
    });
  }

  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

// ---- Periods ---------------------------------------------------------------------------

export type Preset = "7d" | "30d" | "90d" | "month" | "year" | "12m" | "all" | "custom";
export type Range = { from: Date | null; to: Date | null };

export const PRESETS: { key: Exclude<Preset, "custom">; label: string }[] = [
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "month", label: "Este mês" },
  { key: "year", label: "Este ano" },
  { key: "12m", label: "12 meses" },
  { key: "all", label: "Tudo" },
];

export function presetRange(p: Preset, today: Date): Range {
  switch (p) {
    case "7d": return { from: subDays(today, 6), to: today };
    case "30d": return { from: subDays(today, 29), to: today };
    case "90d": return { from: subDays(today, 89), to: today };
    case "month": return { from: startOfMonth(today), to: today };
    case "year": return { from: startOfYear(today), to: today };
    case "12m": return { from: subDays(today, 364), to: today };
    default: return { from: null, to: null };
  }
}

export type Compare = { from: Date; to: Date; label: string };

export function compareWindow(p: Preset, r: Range): Compare | null {
  if (!r.from || !r.to) return null;
  if (p === "month") {
    const prevFrom = startOfMonth(subMonths(r.from, 1));
    const len = differenceInCalendarDays(r.to, r.from);
    const prevEnd = startOfDay(endOfMonth(prevFrom));
    const prevTo = addDays(prevFrom, len);
    return { from: prevFrom, to: isAfter(prevTo, prevEnd) ? prevEnd : prevTo, label: "vs mesmo período do mês passado" };
  }
  if (p === "year") return { from: startOfYear(subYears(r.from, 1)), to: subYears(r.to, 1), label: "vs mesmo período do ano passado" };
  const days = differenceInCalendarDays(r.to, r.from) + 1;
  return { from: subDays(r.from, days), to: subDays(r.from, 1), label: `vs ${days} dias anteriores` };
}

export const inRange = (d: Date, r: { from: Date | null; to: Date | null }) =>
  (!r.from || d.getTime() >= r.from.getTime()) && (!r.to || d.getTime() <= r.to.getTime());

// ---- Aggregations ------------------------------------------------------------------------

export type Summary = {
  gross: number;
  net: number;
  fee: number;
  trips: number;
  days: number;
  cancelled: number;
  avgTicket: number;
  /** Average daily rate: gross per rented day. */
  adr: number;
  avgLength: number;
  cancelRate: number;
  customers: number;
};

export function summarize(rows: Rental[]): Summary {
  const live = rows.filter((r) => !r.cancelled);
  const gross = live.reduce((s, r) => s + r.gross, 0);
  const net = live.reduce((s, r) => s + r.net, 0);
  const fee = live.reduce((s, r) => s + r.fee, 0);
  const days = live.reduce((s, r) => s + r.days, 0);
  const withDays = live.filter((r) => r.days > 0);
  return {
    gross,
    net,
    fee,
    trips: live.length,
    days,
    cancelled: rows.length - live.length,
    avgTicket: live.length ? gross / live.length : 0,
    adr: days ? withDays.reduce((s, r) => s + r.gross, 0) / days : 0,
    avgLength: withDays.length ? days / withDays.length : 0,
    cancelRate: rows.length ? (rows.length - live.length) / rows.length : 0,
    customers: new Set(live.map((r) => r.customerKey).filter(Boolean)).size,
  };
}

/** Rented days that fall inside [from, to] (inclusive calendar days). */
export function overlapDays(r: Rental, from: Date, to: Date): number {
  if (!r.end || r.days === 0) return 0;
  const a = Math.max(r.start.getTime(), from.getTime());
  const b = Math.min(r.end.getTime(), addDays(to, 1).getTime());
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export type CarStat = { key: string; label: string; image: string | null; trips: number; days: number; gross: number; net: number; occupancy: number; lastTrip: Date | null };

/** Per-car performance inside the window; occupancy = rented days / days in the window. */
export function carStats(rows: Rental[], cars: CarRow[], range: { from: Date; to: Date }): CarStat[] {
  const windowDays = differenceInCalendarDays(range.to, range.from) + 1;
  const byKey = new Map<string, CarStat>();
  const carById = new Map(cars.map((c) => [c.id, c]));
  for (const r of rows) {
    if (r.cancelled || r.channel === "Direto") continue;
    const key = r.carId ?? `label:${r.carLabel}`;
    let s = byKey.get(key);
    if (!s) {
      const car = r.carId ? carById.get(r.carId) : undefined;
      s = { key, label: car ? carLabelOf(car) : r.carLabel, image: car?.image_url ?? null, trips: 0, days: 0, gross: 0, net: 0, occupancy: 0, lastTrip: null };
      byKey.set(key, s);
    }
    if (!s.lastTrip || r.start > s.lastTrip) s.lastTrip = r.start;
    if (!inRange(r.start, range)) continue;
    s.trips += 1;
    s.gross += r.gross;
    s.net += r.net;
  }
  for (const r of rows) {
    if (r.cancelled || r.channel === "Direto") continue;
    const s = byKey.get(r.carId ?? `label:${r.carLabel}`);
    if (s) s.days += overlapDays(r, range.from, range.to);
  }
  for (const s of byKey.values()) s.occupancy = windowDays ? Math.min(1, s.days / windowDays) : 0;
  return [...byKey.values()];
}

export type MonthPoint = { key: string; label: string; gross: number; net: number; trips: number; days: number; fee: number };

export function monthly(rows: Rental[], months: number, today: Date): MonthPoint[] {
  const first = startOfMonth(subMonths(today, months - 1));
  const points: MonthPoint[] = Array.from({ length: months }, (_, i) => {
    const d = startOfMonth(subMonths(today, months - 1 - i));
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(". de ", "/").replace(".", ""),
      gross: 0, net: 0, trips: 0, days: 0, fee: 0,
    };
  });
  const byKey = new Map(points.map((p) => [p.key, p]));
  for (const r of rows) {
    if (r.cancelled || r.start < first) continue;
    const p = byKey.get(`${r.start.getFullYear()}-${String(r.start.getMonth() + 1).padStart(2, "0")}`);
    if (!p) continue;
    p.gross += r.gross;
    p.net += r.net;
    p.fee += r.fee;
    p.trips += 1;
    p.days += r.days;
  }
  return points;
}

export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function byWeekday(rows: Rental[]) {
  const out = WEEKDAYS.map((label) => ({ label, trips: 0, gross: 0, days: 0 }));
  for (const r of rows) {
    if (r.cancelled || r.channel === "Direto") continue;
    const w = out[r.start.getDay()];
    w.trips += 1;
    w.gross += r.gross;
    w.days += r.days;
  }
  return out;
}

export const LENGTH_BUCKETS = [
  { label: "1 dia", min: 1, max: 1 },
  { label: "2 dias", min: 2, max: 2 },
  { label: "3 dias", min: 3, max: 3 },
  { label: "4–6 dias", min: 4, max: 6 },
  { label: "7–13 dias", min: 7, max: 13 },
  { label: "14+ dias", min: 14, max: Infinity },
];

export function byLength(rows: Rental[]) {
  const out = LENGTH_BUCKETS.map((b) => ({ label: b.label, trips: 0, gross: 0 }));
  for (const r of rows) {
    if (r.cancelled || r.days === 0) continue;
    const i = LENGTH_BUCKETS.findIndex((b) => r.days >= b.min && r.days <= b.max);
    if (i >= 0) { out[i].trips += 1; out[i].gross += r.gross; }
  }
  return out;
}

export function byChannel(rows: Rental[]) {
  return CHANNELS.map((c) => {
    const s = summarize(rows.filter((r) => r.channel === c));
    return { channel: c, ...s };
  });
}

export type CustomerSplit = {
  newCustomers: number;
  returning: number;
  newGross: number;
  returningGross: number;
  newTrips: number;
  returningTrips: number;
  top: { key: string; name: string; trips: number; gross: number; channel: Channel }[];
};

/** "Returning" = the customer had a rental before this window started. */
export function customerSplit(all: Rental[], inWindow: Rental[], from: Date | null): CustomerSplit {
  const firstSeen = new Map<string, Date>();
  for (const r of all) {
    if (r.cancelled || !r.customerKey) continue;
    const prev = firstSeen.get(r.customerKey);
    if (!prev || r.start < prev) firstSeen.set(r.customerKey, r.start);
  }
  const split: CustomerSplit = { newCustomers: 0, returning: 0, newGross: 0, returningGross: 0, newTrips: 0, returningTrips: 0, top: [] };
  const seen = new Map<string, { returning: boolean }>();
  const totals = new Map<string, { key: string; name: string; trips: number; gross: number; channel: Channel }>();
  for (const r of inWindow) {
    if (r.cancelled || !r.customerKey) continue;
    const returning = !!from && (firstSeen.get(r.customerKey)?.getTime() ?? Infinity) < from.getTime();
    // Within the window, a customer's 2nd+ rental also counts as returning business.
    const repeatInside = seen.has(r.customerKey);
    if (!seen.has(r.customerKey)) seen.set(r.customerKey, { returning });
    if (returning || repeatInside) { split.returningGross += r.gross; split.returningTrips += 1; }
    else { split.newGross += r.gross; split.newTrips += 1; }
    const t = totals.get(r.customerKey) ?? { key: r.customerKey, name: r.customerName, trips: 0, gross: 0, channel: r.channel };
    t.trips += 1;
    t.gross += r.gross;
    totals.set(r.customerKey, t);
  }
  for (const [key, v] of seen) {
    const t = totals.get(key);
    if (v.returning || (t && t.trips > 1)) split.returning += 1;
    else split.newCustomers += 1;
  }
  split.top = [...totals.values()].sort((a, b) => b.gross - a.gross || b.trips - a.trips).slice(0, 8);
  return split;
}

/** Cumulative revenue by day of this month vs last month (for the month-goal chart). */
export function monthPace(rows: Rental[], today: Date, pick: (r: Rental) => number) {
  const start = startOfMonth(today);
  const prevStart = startOfMonth(subMonths(today, 1));
  const daysIn = endOfMonth(today).getDate();
  const cur = new Array(daysIn + 2).fill(0);
  const prv = new Array(32).fill(0);
  for (const r of rows) {
    if (r.cancelled) continue;
    if (r.start >= start && r.start.getMonth() === start.getMonth() && r.start.getFullYear() === start.getFullYear()) cur[r.start.getDate()] += pick(r);
    else if (r.start >= prevStart && r.start < start) prv[r.start.getDate()] += pick(r);
  }
  let a = 0;
  let b = 0;
  const elapsed = today.getDate();
  const daily = Array.from({ length: daysIn }, (_, i) => {
    const d = i + 1;
    a += cur[d];
    b += prv[d] ?? 0;
    return { day: d, actual: d <= elapsed ? a : null, prev: b };
  });
  const prevTotal = prv.reduce((s, v) => s + v, 0);
  // The month's future trips are already booked: count them too, separately.
  const booked = cur.reduce((s, v) => s + v, 0);
  return { daily, soFar: a, booked, prevTotal, elapsed, daysIn };
}

export const pctChange = (cur: number, prev: number): number | null => (prev === 0 ? (cur === 0 ? 0 : null) : (cur - prev) / Math.abs(prev));

export const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
export const usd0 = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
export const pct = (n: number) => `${(n * 100).toFixed(n < 0.1 && n > 0 ? 1 : 0)}%`;
