import { useMemo, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { TrendingUp, Car as CarIcon } from "lucide-react";
import {
  TuroStats, TuroTrip, TuroExtras, StatTile, fmtMoney, vehicleLabel, fmtDate,
} from "./shared";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const GREEN = "#1b8f6b";
const INDIGO = "#4338ca";
const BLUE = "#3b82f6";
const GRAY = "#94a3b8";

type EarningEntry = {
  amount?: number; vehicleName?: string | null; createdDate?: string;
  earningsType?: string; reservation?: { reservationId?: number } | null;
};
type EarningsBlob = { years?: Record<string, { ownerEarningsList?: EarningEntry[] }> };

const isPayout = (e: EarningEntry) => e.earningsType === "DIRECT_DEPOSIT_PAYMENT";
const compactMoney = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`);

export function OverviewTab({ stats, trips, extras }: { stats: TuroStats | null; trips: TuroTrip[]; extras: TuroExtras | null }) {
  const earnings = extras?.earnings as EarningsBlob | null;
  const years = earnings?.years ?? {};
  const yearKeys = Object.keys(years).filter((y) => (years[y]?.ownerEarningsList?.length ?? 0) > 0).sort((a, b) => Number(b) - Number(a));
  const [year, setYear] = useState<string>(yearKeys[0] ?? String(new Date().getFullYear()));

  const fin = useMemo(() => {
    const list = (years[year]?.ownerEarningsList ?? []).filter((e) => !isPayout(e));
    const total = list.reduce((s, e) => s + (e.amount ?? 0), 0);
    const tripCount = list.filter((e) => e.reservation?.reservationId).length;
    const byMonth = new Array(12).fill(0) as number[];
    const byVehicle = new Map<string, number>();
    for (const e of list) {
      const m = e.createdDate ? Number(e.createdDate.slice(5, 7)) - 1 : -1;
      if (m >= 0 && m < 12) byMonth[m] += e.amount ?? 0;
      const v = e.vehicleName || "Outros";
      byVehicle.set(v, (byVehicle.get(v) ?? 0) + (e.amount ?? 0));
    }
    return {
      total, tripCount,
      ticket: tripCount ? total / tripCount : 0,
      revByMonth: byMonth.map((revenue, i) => ({ month: MONTHS[i], revenue })),
      revByVehicle: [...byVehicle.entries()].map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 7),
    };
  }, [years, year]);

  const now = Date.now();
  const tripsByMonth = useMemo(() => {
    const arr = new Array(12).fill(0) as number[];
    for (const t of trips) {
      if (!t.pickup_date) continue;
      const d = new Date(t.pickup_date);
      if (String(d.getFullYear()) === year) arr[d.getMonth()]++;
    }
    return arr.map((trips, i) => ({ month: MONTHS[i], trips }));
  }, [trips, year]);

  const statusMix = useMemo(() => {
    let active = 0, upcoming = 0, completed = 0;
    for (const t of trips) {
      if (!t.pickup_date || !t.return_date) { completed++; continue; }
      const ps = new Date(t.pickup_date).getTime(), rs = new Date(t.return_date).getTime();
      if (ps > now) upcoming++; else if (rs < now) completed++; else active++;
    }
    return [
      { name: "Ativas", value: active, color: GREEN },
      { name: "Próximas", value: upcoming, color: BLUE },
      { name: "Concluídas", value: completed, color: GRAY },
    ].filter((s) => s.value > 0);
  }, [trips, now]);

  const upcomingTrips = useMemo(() =>
    trips.filter((t) => t.pickup_date && new Date(t.pickup_date).getTime() >= now)
      .sort((a, b) => new Date(a.pickup_date!).getTime() - new Date(b.pickup_date!).getTime())
      .slice(0, 6), [trips, now]);

  if (!stats || stats.summary.totalTrips === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Sem dados ainda.</p>
        <p className="text-sm mt-1">Sincronize na aba <strong>Sincronização</strong> para carregar as viagens.</p>
      </div>
    );
  }

  const revConfig = { revenue: { label: "Receita", color: GREEN } } satisfies ChartConfig;
  const tripsConfig = { trips: { label: "Viagens", color: INDIGO } } satisfies ChartConfig;
  const hasFin = yearKeys.length > 0;

  return (
    <div className="space-y-4">
      {/* Year switch */}
      {hasFin && (
        <div className="flex items-center gap-2">
          {yearKeys.map((y) => (
            <button key={y} onClick={() => setYear(y)}
              className={`px-3 py-1 rounded-full text-sm font-medium ${y === year ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground"}`}>
              {y}
            </button>
          ))}
        </div>
      )}

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="col-span-2 md:col-span-1 bg-emerald-600 text-white border-emerald-600">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs opacity-80 flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> Receita {year}</p>
            <p className="text-2xl font-bold tabular-nums">{fmtMoney(fin.total)}</p>
            <p className="text-[11px] opacity-80 mt-0.5">{fin.tripCount} viagens pagas</p>
          </CardContent>
        </Card>
        <StatTile label="Ticket médio" value={fmtMoney(fin.ticket)} hint="por viagem paga" />
        <StatTile label="Ocupação 30d" value={`${stats.summary.occupancy30}%`} hint={`${stats.summary.matchedCars}/${stats.summary.fleetSize} carros`} />
        <StatTile label="Ativas agora" value={String(stats.summary.active)} />
        <StatTile label="Próximas" value={String(stats.summary.upcoming)} />
        <StatTile label="Duração média" value={`${stats.summary.avgDurationDays}d`} />
      </div>

      {/* Revenue + trips over time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm font-semibold">Receita por mês · {year}</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={revConfig} className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={fin.revByMonth} margin={{ left: 4, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={44} tickFormatter={compactMoney} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmtMoney(Number(v))} />} />
                  <Area type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2} fill="url(#revFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm font-semibold">Viagens por mês · {year}</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={tripsConfig} className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tripsByMonth} margin={{ left: 4, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="trips" fill="var(--color-trips)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by vehicle + status mix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-1"><CardTitle className="text-sm font-semibold">Receita por veículo · {year}</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={revConfig} className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fin.revByVehicle} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={compactMoney} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={120} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmtMoney(Number(v))} />} />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm font-semibold">Status das viagens</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusMix} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
                    {statusMix.map((s) => <Cell key={s.name} fill={s.color} stroke="var(--background)" strokeWidth={2} />)}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
            <div className="flex flex-col gap-1 mt-1">
              {statusMix.map((s) => (
                <div key={s.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
                  <span className="flex-1 text-muted-foreground">{s.name}</span>
                  <span className="font-semibold tabular-nums">{s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming trips */}
      {upcomingTrips.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Próximas viagens</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {upcomingTrips.map((t) => (
                <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl border">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <CarIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{vehicleLabel(t)}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.guest_name || "Hóspede"} · {fmtDate(t.pickup_date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
