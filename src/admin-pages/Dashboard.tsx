"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { addDays, differenceInCalendarDays, format, startOfWeek, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ResizableGrid, type GridWidget } from "@/components/dashboard/ResizableGrid";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  CHANNELS, CHANNEL_COLORS, CHANNEL_HINT, PRESETS, buildRentals, businessToday, byChannel, byLength, byWeekday, carStats,
  compareWindow, customerSplit, inRange, monthPace, monthly, overlapDays, pct, presetRange, summarize, usd0,
  type BookingRow, type CarRow, type Channel, type ClientRow, type OrderRow, type Preset, type Range, type Rental,
  type TuroReceiptRow, type TuroTripRow,
} from "./dashboard/data";
import { ChannelMix, ChannelTile, FleetPerformance, KpiGrid, MonthlyChart, TripLength, Waterfall, WeekdayChart } from "./dashboard/widgets-a";
import { Customers, ForwardBookings, Insights, MonthPace, Ratings, type Forward, type Insight, type ReviewItem } from "./dashboard/widgets-b";

type GuestReviews = { name: string; reviews: { rating: number | null; text: string | null; at: string | null }[] | null };
type Extra = { failedBalances: number; turoSyncAgeHours: number | null };
type Loaded = { rentals: Rental[]; cars: CarRow[]; reviews: ReviewItem[]; extra: Extra };

// Tables outside the generated Database types (Turo, guests).
const db = supabase as unknown as { from: (t: string) => { select: (c: string) => Promise<{ data: unknown[] | null; error: unknown }> } };

export default function Dashboard() {
  const today = useMemo(() => businessToday(), []);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [cars, setCars] = useState<CarRow[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [extra, setExtra] = useState<Extra>({ failedBalances: 0, turoSyncAgeHours: null });

  const [sel, setSel] = useState<{ preset: Preset; range: Range }>(() => ({ preset: "90d", range: presetRange("90d", businessToday()) }));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(undefined);
  const [channel, setChannel] = useState<Channel | "all">("all");

  const apply = useCallback((d: Loaded) => {
    setRentals(d.rentals);
    setCars(d.cars);
    setReviews(d.reviews);
    setExtra(d.extra);
  }, []);

  const fetchData = useCallback(async (): Promise<Loaded> => {
    const [trips, receipts, bookings, orders, carsRes, clients, guests, tokens] = await Promise.all([
      db.from("turo_trips").select("id, turo_trip_id, status, pickup_date, return_date, location_timezone, product_id, vehicle_year, vehicle_make, vehicle_model, renter_id, guest_name"),
      db.from("turo_receipts").select("reservation_id, trip_total, host_earned, turo_fee"),
      db.from("bookings").select("id, car_id, status, pickup_date, return_date, estimated_total, customer_email, customer_name, balance_status"),
      db.from("orders").select("id, data_pedido, created_at, total, status, client_id, canal"),
      db.from("products").select("id, name, make, model, year, image_url, store_visible, daily_rate"),
      db.from("clients").select("id, nome_razao"),
      db.from("turo_guests").select("name, reviews"),
      db.from("turo_tokens").select("last_synced_at"),
    ]);
    const carRows = (carsRes.data ?? []) as CarRow[];
    const syncs = ((tokens.data ?? []) as { last_synced_at: string | null }[]).map((t) => t.last_synced_at).filter(Boolean) as string[];
    const lastSync = syncs.sort().at(-1);
    return {
      cars: carRows,
      rentals: buildRentals({
        trips: (trips.data ?? []) as TuroTripRow[],
        receipts: (receipts.data ?? []) as TuroReceiptRow[],
        bookings: (bookings.data ?? []) as BookingRow[],
        orders: (orders.data ?? []) as OrderRow[],
        cars: carRows,
        clients: (clients.data ?? []) as ClientRow[],
      }),
      reviews: ((guests.data ?? []) as GuestReviews[]).flatMap((g) => (g.reviews ?? []).map((r) => ({ ...r, guest: g.name }))),
      extra: {
        failedBalances: ((bookings.data ?? []) as { balance_status?: string }[]).filter((b) => b.balance_status === "failed").length,
        turoSyncAgeHours: lastSync ? (Date.now() - new Date(lastSync).getTime()) / 3_600_000 : null,
      },
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchData()
      .then((d) => { if (alive) apply(d); })
      .catch((e) => console.error("Dashboard load failed", e))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fetchData, apply]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      apply(await fetchData());
    } finally {
      setRefreshing(false);
    }
  };

  // ---- derived ----
  const cmp = useMemo(() => compareWindow(sel.preset, sel.range), [sel]);
  const hasPrev = !!cmp;
  const span = useMemo(() => {
    const from = sel.range.from ?? rentals[0]?.start ?? today;
    return { from, to: sel.range.to ?? today };
  }, [sel, rentals, today]);

  const forChannel = useCallback((rows: Rental[]) => (channel === "all" ? rows : rows.filter((r) => r.channel === channel)), [channel]);
  const curRowsAll = useMemo(() => rentals.filter((r) => inRange(r.start, sel.range)), [rentals, sel]);
  const prevRowsAll = useMemo(() => (cmp ? rentals.filter((r) => inRange(r.start, cmp)) : []), [rentals, cmp]);
  const curRows = useMemo(() => forChannel(curRowsAll), [forChannel, curRowsAll]);
  const prevRows = useMemo(() => forChannel(prevRowsAll), [forChannel, prevRowsAll]);
  const cur = useMemo(() => summarize(curRows), [curRows]);
  const prev = useMemo(() => summarize(prevRows), [prevRows]);

  const fleetSize = cars.length || 1;
  const occupancyOf = useCallback(
    (rows: Rental[], from: Date, to: Date) => {
      const days = differenceInCalendarDays(to, from) + 1;
      const rented = rows.filter((r) => !r.cancelled).reduce((s, r) => s + overlapDays(r, from, to), 0);
      return days > 0 ? Math.min(1, rented / (fleetSize * days)) : 0;
    },
    [fleetSize],
  );
  // Occupancy counts every trip that overlaps the window, not only those picked up in it.
  const occupancy = useMemo(() => occupancyOf(forChannel(rentals), span.from, span.to), [occupancyOf, forChannel, rentals, span]);
  const prevOccupancy = useMemo(() => (cmp ? occupancyOf(forChannel(rentals), cmp.from, cmp.to) : 0), [occupancyOf, forChannel, rentals, cmp]);

  const fleet = useMemo(() => carStats(forChannel(rentals), cars, span), [forChannel, rentals, cars, span]);
  const channelLabel = channel === "all" ? "Todos os canais" : `${channel} · ${CHANNEL_HINT[channel]}`;
  const split = useMemo(() => customerSplit(forChannel(rentals), curRows, sel.range.from), [forChannel, rentals, curRows, sel]);

  const forward = useCallback(
    (h: number): Forward => {
      const from = addDays(today, 1);
      const to = addDays(today, h);
      const rows = forChannel(rentals).filter((r) => !r.cancelled && r.start >= from && r.start <= to && r.channel !== "Direto");
      const weeks = new Map<string, { label: string; gross: number; trips: number }>();
      for (const r of rows) {
        const w = startOfWeek(r.start, { weekStartsOn: 1 });
        const key = w.toISOString();
        const e = weeks.get(key) ?? { label: format(w, "dd/MM"), gross: 0, trips: 0 };
        e.gross += r.gross;
        e.trips += 1;
        weeks.set(key, e);
      }
      return {
        trips: rows.length,
        days: rows.reduce((s, r) => s + r.days, 0),
        gross: rows.reduce((s, r) => s + r.gross, 0),
        occupancy: occupancyOf(forChannel(rentals), from, to),
        byWeek: [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v),
      };
    },
    [forChannel, rentals, today, occupancyOf],
  );

  const insights = useMemo<Insight[]>(() => {
    const out: Insight[] = [];
    if (hasPrev && prev.gross > 0) {
      const g = (cur.gross - prev.gross) / prev.gross;
      out.push({ tone: g >= 0 ? "good" : "warn", text: <>Receita {g >= 0 ? "subiu" : "caiu"} <b>{pct(Math.abs(g))}</b> {cmp?.label} ({usd0(prev.gross)} → {usd0(cur.gross)}).</> });
    }
    if (cur.gross > 0 && cur.fee > 0) out.push({ tone: "info", text: <>A Turo ficou com <b>{usd0(cur.fee)}</b> ({pct(cur.fee / cur.gross)} da receita bruta). Reservas pelo site não pagam essa taxa.</> });
    const turoShare = byChannel(curRowsAll).find((c) => c.channel === "Turo");
    if (turoShare && summarize(curRowsAll).gross > 0) {
      const share = turoShare.gross / summarize(curRowsAll).gross;
      if (share > 0.8) out.push({ tone: "info", text: <><b>{pct(share)}</b> da receita veio da Turo. Cada cliente que voltar a reservar direto no site economiza a taxa.</>, href: "/admin/clients" });
    }
    const ranked = [...fleet].filter((c) => c.trips > 0).sort((a, b) => b.gross - a.gross);
    if (ranked[0]) out.push({ tone: "good", text: <>Carro que mais faturou: <b>{ranked[0].label}</b>, {usd0(ranked[0].gross)} em {ranked[0].trips} locações ({pct(ranked[0].occupancy)} de ocupação).</> });
    const idleCutoff = addDays(today, -21);
    const idle = cars.filter((c) => {
      const s = fleet.find((f) => f.key === c.id);
      return !s?.lastTrip || s.lastTrip < idleCutoff;
    });
    if (idle.length) out.push({ tone: "warn", text: <><b>{idle.length} carro(s)</b> sem locação há mais de 3 semanas: {idle.slice(0, 4).map((c) => c.name || c.model).join(", ")}{idle.length > 4 ? "…" : ""}.</>, href: "/admin/cars" });
    const low = fleet.filter((c) => c.trips > 0 && c.occupancy < 0.25);
    if (low.length && channel !== "Direto") out.push({ tone: "warn", text: <><b>{low.length} carro(s)</b> com ocupação abaixo de 25% no período. Vale revisar preço ou anúncio.</> });
    const turoOnly = cars.filter((c) => !c.store_visible && fleet.some((f) => f.key === c.id && f.trips > 0));
    if (turoOnly.length) out.push({ tone: "info", text: <><b>{turoOnly.length} carro(s)</b> alugam na Turo mas não aparecem no site ({turoOnly.map((c) => c.name || c.model).join(", ")}).</>, href: "/admin/cars" });
    const weekday = byWeekday(curRows);
    const bestDay = [...weekday].sort((a, b) => b.trips - a.trips)[0];
    if (bestDay?.trips) out.push({ tone: "info", text: <>Mais retiradas às <b>{bestDay.label}</b>. Duração média de <b>{cur.avgLength.toFixed(1)} dias</b>.</> });
    if (cur.cancelRate > 0.15) out.push({ tone: "warn", text: <>Taxa de cancelamento alta: <b>{pct(cur.cancelRate)}</b> ({cur.cancelled} cancelamentos).</> });
    const lowReviews = reviews.filter((r) => (r.rating ?? 5) <= 3).length;
    if (lowReviews) out.push({ tone: "warn", text: <><b>{lowReviews}</b> avaliação(ões) com 3★ ou menos. Veja os comentários no card de avaliações.</> });
    if (extra.failedBalances) out.push({ tone: "bad", text: <><b>{extra.failedBalances}</b> cobrança(s) de saldo falharam. O cliente recebeu o link para pagar.</>, href: "/admin/bookings" });
    if (extra.turoSyncAgeHours != null) {
      const h = extra.turoSyncAgeHours;
      if (h > 12) out.push({ tone: "bad", text: <>Dados da Turo de <b>{h > 48 ? `${Math.floor(h / 24)} dias` : `${Math.floor(h)}h`}</b> atrás. Os números da Turo podem estar incompletos.</>, href: "/admin/turo?tab=sync" });
    }
    const missingReceipts = curRows.filter((r) => r.channel === "Turo" && !r.cancelled && r.gross === 0).length;
    if (missingReceipts) out.push({ tone: "info", text: <>{missingReceipts} viagem(ns) da Turo no período ainda sem recibo (valor $0 até sincronizar).</> });
    return out;
  }, [hasPrev, prev, cur, cmp, curRowsAll, curRows, fleet, cars, today, channel, reviews, extra]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner />
      </div>
    );
  }

  const tile = (c: Channel | "all") => {
    const pick = (rows: Rental[]) => (c === "all" ? rows : rows.filter((r) => r.channel === c));
    return { cur: summarize(pick(curRowsAll)), prev: summarize(pick(prevRowsAll)) };
  };
  const rangeLabel =
    sel.range.from && sel.range.to
      ? `${format(sel.range.from, "dd/MM/yy")} – ${format(sel.range.to, "dd/MM/yy")}`
      : "Todo o período";
  const pickPreset = (p: Exclude<Preset, "custom">) => setSel({ preset: p, range: presetRange(p, today) });
  const onPickRange = (r: DateRange | undefined) => {
    setDraft(r);
    if (r?.from && r?.to) {
      setSel({ preset: "custom", range: { from: r.from, to: r.to } });
      setCalendarOpen(false);
    }
  };

  const widgets: GridWidget[] = [
    {
      id: "channels",
      w: 12,
      node: (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
          <ChannelTile name="Todos os canais" selected={channel === "all"} onClick={() => setChannel("all")} {...tile("all")} hasPrev={hasPrev} />
          {CHANNELS.map((c) => (
            <ChannelTile key={c} name={c} color={CHANNEL_COLORS[c]} hint={CHANNEL_HINT[c]} selected={channel === c} onClick={() => setChannel(c)} {...tile(c)} hasPrev={hasPrev} />
          ))}
        </div>
      ),
    },
    { id: "kpis", w: 12, node: <KpiGrid cur={cur} prev={prev} hasPrev={hasPrev} fleetSize={fleetSize} occupancy={occupancy} prevOccupancy={prevOccupancy} /> },
    { id: "insights", w: 6, node: <Insights items={insights} /> },
    { id: "waterfall", w: 6, node: <Waterfall cur={cur} /> },
    { id: "monthly", w: 12, node: <MonthlyChart byMonths={(m) => monthly(forChannel(rentals), m, today)} channelLabel={channelLabel} /> },
    { id: "fleet", w: 7, node: <FleetPerformance cars={fleet} /> },
    { id: "mix", w: 5, node: <ChannelMix channels={byChannel(curRowsAll)} /> },
    { id: "forward", w: 6, node: <ForwardBookings byHorizon={forward} /> },
    {
      id: "pace",
      w: 6,
      node: (
        <MonthPace
          monthLabel={today.toLocaleDateString("pt-BR", { month: "long" })}
          byMetric={(m) => monthPace(forChannel(rentals), today, (r) => (m === "gross" ? r.gross : r.net))}
        />
      ),
    },
    { id: "weekday", w: 6, node: <WeekdayChart data={byWeekday(curRows)} /> },
    { id: "length", w: 6, node: <TripLength data={byLength(curRows)} /> },
    { id: "customers", w: 6, node: <Customers split={split} /> },
    { id: "ratings", w: 6, node: <Ratings reviews={reviews} /> },
  ];

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Receita, frota e clientes de todos os canais: Turo, site e links de pagamento</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => pickPreset(p.key)}
                className={cn("rounded-md px-3 py-1.5 text-sm transition-colors", sel.preset === p.key ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Popover open={calendarOpen} onOpenChange={(o) => { setCalendarOpen(o); if (o) setDraft(undefined); }}>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-10 gap-2 font-normal", sel.preset === "custom" && "border-primary")}>
                <CalendarIcon className="h-4 w-4" />
                {rangeLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="range" numberOfMonths={2} selected={draft} onSelect={onPickRange} defaultMonth={subMonths(sel.range.to ?? today, 1)} locale={ptBR} />
              <p className="max-w-[34rem] border-t px-3 py-2 text-xs text-muted-foreground">Clique no dia inicial e depois no final. Datas futuras mostram o que já está reservado.</p>
            </PopoverContent>
          </Popover>
          <Button variant="outline" className="h-10" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
            {refreshing ? "Atualizando..." : "Atualizar"}
          </Button>
          {cmp && <span className="text-xs text-muted-foreground">Comparando {cmp.label}</span>}
        </div>
      </div>

      <ResizableGrid widgets={widgets} storageKey="vx.dashboard.layout.v1" legacyKeys={[]} />
    </div>
  );
}
