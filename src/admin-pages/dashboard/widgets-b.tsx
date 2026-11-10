"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CalendarClock, CheckCircle2, Lightbulb, Star, Target, Users } from "lucide-react";
import { ChartBox, ScrollBox } from "@/components/dashboard/ResizableGrid";
import { cn } from "@/lib/utils";
import { OptionBar, Segmented, tooltipStyle, usePersisted } from "./controls";
import { BREAKDOWN_TYPES, Breakdown, Empty, WCard, type BreakdownType } from "./widgets-a";
import { CHANNEL_COLORS, pct, usd, usd0, type CustomerSplit } from "./data";

const axis = { fontSize: 11, tickLine: false, axisLine: false } as const;
const money = (v: number) => (Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`);

// ---- Customers ---------------------------------------------------------------------------

type CustomerView = "split" | "top";
type CustomerMetric = "customers" | "gross" | "trips";

export function Customers({ split }: { split: CustomerSplit }) {
  const [view, setView] = usePersisted<CustomerView>("vx.dash.custView", "split", ["split", "top"]);
  const [metric, setMetric] = usePersisted<CustomerMetric>("vx.dash.custMetric", "customers", ["customers", "gross", "trips"]);
  const [type, setType] = usePersisted<BreakdownType>("vx.dash.custType", "donut", BREAKDOWN_TYPES.map((b) => b.key));
  const values = {
    customers: [split.newCustomers, split.returning],
    gross: [split.newGross, split.returningGross],
    trips: [split.newTrips, split.returningTrips],
  }[metric];
  const totalCustomers = split.newCustomers + split.returning;
  return (
    <WCard
      title="Clientes"
      icon={<Users className="h-4 w-4" />}
      description={totalCustomers ? `${split.returning} de ${totalCustomers} já tinham alugado antes ou alugaram mais de uma vez` : undefined}
    >
      <OptionBar>
        <Segmented label="Exibir" options={[{ key: "split", label: "Novos × recorrentes" }, { key: "top", label: "Melhores clientes" }]} value={view} onChange={setView} />
        {view === "split" && <Segmented label="Mostrar" options={[{ key: "customers", label: "Clientes" }, { key: "gross", label: "Receita" }, { key: "trips", label: "Locações" }]} value={metric} onChange={setMetric} />}
        {view === "split" && <Segmented label="Gráfico" options={BREAKDOWN_TYPES} value={type} onChange={setType} />}
      </OptionBar>
      {view === "split" ? (
        <Breakdown
          data={[{ label: "Novos", value: values[0] }, { label: "Recorrentes", value: values[1] }]}
          type={type}
          isMoneyValue={metric === "gross"}
          colors={["#0ea5e9", "#593cfb"]}
        />
      ) : split.top.length === 0 ? <Empty /> : (
        <ScrollBox maxHeight={320}>
          <ol className="space-y-1.5 text-sm">
            {split.top.map((c, i) => (
              <li key={c.key} className="flex items-center justify-between gap-3 rounded-md border px-2.5 py-1.5">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-4 text-xs text-muted-foreground">{i + 1}</span>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CHANNEL_COLORS[c.channel] }} title={c.channel} />
                  <span className="truncate">{c.name}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{c.trips}× · <span className="font-medium text-foreground">{usd0(c.gross)}</span></span>
              </li>
            ))}
          </ol>
        </ScrollBox>
      )}
      <Link href="/admin/clients" className="text-xs text-muted-foreground underline-offset-2 hover:underline">Ver todos os clientes →</Link>
    </WCard>
  );
}

// ---- Ratings -----------------------------------------------------------------------------

export type ReviewItem = { rating: number | null; text: string | null; at: string | null; guest: string };
type RatingView = "distribution" | "trend" | "comments";

export function Ratings({ reviews }: { reviews: ReviewItem[] }) {
  const [view, setView] = usePersisted<RatingView>("vx.dash.ratingView", "distribution", ["distribution", "trend", "comments"]);
  const rated = reviews.filter((r) => r.rating != null);
  const avg = rated.length ? rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length : null;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ label: `${n}★`, value: rated.filter((r) => Math.round(r.rating ?? 0) === n).length }));
  const byMonth = new Map<string, { label: string; sum: number; n: number }>();
  for (const r of rated) {
    if (!r.at) continue;
    const d = new Date(r.at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const m = byMonth.get(key) ?? { label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }), sum: 0, n: 0 };
    m.sum += r.rating ?? 0;
    m.n += 1;
    byMonth.set(key, m);
  }
  const trend = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, m]) => ({ label: m.label, avg: Number((m.sum / m.n).toFixed(2)), n: m.n }));
  const comments = reviews.filter((r) => r.text).sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
  const low = rated.filter((r) => (r.rating ?? 5) <= 3).length;

  return (
    <WCard
      title="Avaliações dos hóspedes"
      icon={<Star className="h-4 w-4" />}
      description={avg != null ? `${avg.toFixed(2)}★ de média em ${rated.length} avaliações${low ? ` · ${low} com 3★ ou menos` : ""}` : "Avaliações que os hóspedes da Turo deixaram para vocês"}
    >
      <OptionBar>
        <Segmented label="Exibir" options={[{ key: "distribution", label: "Distribuição" }, { key: "trend", label: "Evolução" }, { key: "comments", label: "Comentários" }]} value={view} onChange={setView} />
      </OptionBar>
      {rated.length === 0 ? <Empty>Sem avaliações ainda.</Empty> : view === "distribution" ? (
        <ChartBox height={200}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dist} layout="vertical" margin={{ right: 24 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" {...axis} width={36} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} label={{ position: "right", fontSize: 11 }}>
                {dist.map((d, i) => <Cell key={d.label} fill={["#10b981", "#84cc16", "#f59e0b", "#f97316", "#ef4444"][i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>
      ) : view === "trend" ? (
        <ChartBox height={200}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" {...axis} />
              <YAxis domain={[1, 5]} {...axis} width={28} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, k) => (k === "avg" ? [`${v}★`, "Média"] : [v, k])} />
              <Line dataKey="avg" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartBox>
      ) : (
        <ScrollBox maxHeight={300}>
          <ul className="space-y-2 text-sm">
            {comments.slice(0, 20).map((c, i) => (
              <li key={i} className="rounded-md border p-2">
                <p className="text-xs text-amber-600">{"★".repeat(Math.round(c.rating ?? 0))} <span className="text-muted-foreground">· {c.guest}</span></p>
                <p className="mt-0.5">{c.text}</p>
              </li>
            ))}
          </ul>
        </ScrollBox>
      )}
    </WCard>
  );
}

// ---- Month pace --------------------------------------------------------------------------

type GoalMetric = "gross" | "net";
export type Pace = { daily: { day: number; actual: number | null; prev: number }[]; soFar: number; booked: number; prevTotal: number; elapsed: number; daysIn: number };

export function MonthPace({ byMetric, monthLabel }: { byMetric: (m: GoalMetric) => Pace; monthLabel: string }) {
  const [metric, setMetric] = usePersisted<GoalMetric>("vx.dash.goalMetric", "gross", ["gross", "net"]);
  const [type, setType] = usePersisted<"area" | "line">("vx.dash.goalType", "area", ["area", "line"]);
  const p = byMetric(metric);
  const projection = p.elapsed ? (p.soFar / p.elapsed) * p.daysIn : 0;
  const vsPrev = p.prevTotal ? p.booked / p.prevTotal : null;
  const Chart = type === "area" ? AreaChart : LineChart;
  return (
    <WCard title={`Ritmo de ${monthLabel}`} icon={<Target className="h-4 w-4" />} description="Acumulado do mês (pela data de retirada) contra o mês passado">
      <OptionBar>
        <Segmented label="Mostrar" options={[{ key: "gross", label: "Bruta" }, { key: "net", label: "Líquida" }]} value={metric} onChange={setMetric} />
        <Segmented label="Gráfico" options={[{ key: "area", label: "Área" }, { key: "line", label: "Linhas" }]} value={type} onChange={setType} />
      </OptionBar>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border p-2"><p className="text-[11px] text-muted-foreground">Até hoje</p><p className="font-bold tabular-nums">{usd0(p.soFar)}</p></div>
        <div className="rounded-lg border p-2"><p className="text-[11px] text-muted-foreground">Já reservado no mês</p><p className="font-bold tabular-nums">{usd0(p.booked)}</p></div>
        <div className="rounded-lg border p-2"><p className="text-[11px] text-muted-foreground">Mês passado</p><p className="font-bold tabular-nums">{usd0(p.prevTotal)}</p></div>
      </div>
      <ChartBox height={200}>
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={p.daily}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="day" {...axis} />
            <YAxis {...axis} tickFormatter={money} width={48} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number, k) => [usd(v), k === "actual" ? "Este mês" : "Mês passado"]} labelFormatter={(d) => `Dia ${d}`} />
            {/* Recharts ignores children wrapped in fragments, so these are listed directly. */}
            {type === "area" && <Area dataKey="prev" stroke="#94a3b8" fill="#94a3b822" strokeDasharray="4 3" />}
            {type === "area" && <Area dataKey="actual" stroke="#593cfb" fill="#593cfb33" strokeWidth={2.5} connectNulls={false} />}
            {type === "line" && <Line dataKey="prev" stroke="#94a3b8" strokeDasharray="4 3" dot={false} />}
            {type === "line" && <Line dataKey="actual" stroke="#593cfb" strokeWidth={2.5} dot={false} connectNulls={false} />}
          </Chart>
        </ResponsiveContainer>
      </ChartBox>
      <p className="text-xs text-muted-foreground">
        No ritmo atual, o mês fecha perto de <b className="text-foreground">{usd0(projection)}</b>
        {vsPrev != null && <> · o que já está reservado equivale a <b className="text-foreground">{pct(vsPrev)}</b> do mês passado</>}.
      </p>
    </WCard>
  );
}

// ---- Forward bookings --------------------------------------------------------------------

type Horizon = "7" | "30" | "60" | "90";
export type Forward = { trips: number; days: number; gross: number; occupancy: number; byWeek: { label: string; gross: number; trips: number }[] };

export function ForwardBookings({ byHorizon }: { byHorizon: (days: number) => Forward }) {
  const [h, setH] = usePersisted<Horizon>("vx.dash.horizon", "30", ["7", "30", "60", "90"]);
  const [metric, setMetric] = usePersisted<"gross" | "trips">("vx.dash.horizonMetric", "gross", ["gross", "trips"]);
  const f = byHorizon(Number(h));
  return (
    <WCard title="Já reservado pela frente" icon={<CalendarClock className="h-4 w-4" />} description="Locações com retirada nos próximos dias (site + Turo)">
      <OptionBar>
        <Segmented label="Próximos" options={[{ key: "7", label: "7 dias" }, { key: "30", label: "30 dias" }, { key: "60", label: "60 dias" }, { key: "90", label: "90 dias" }]} value={h} onChange={setH} />
        <Segmented label="Mostrar" options={[{ key: "gross", label: "Receita" }, { key: "trips", label: "Locações" }]} value={metric} onChange={setMetric} />
      </OptionBar>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Locações", String(f.trips)],
          ["Diárias", String(f.days)],
          ["Receita", usd0(f.gross)],
          ["Ocupação", pct(f.occupancy)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border p-2 text-center"><p className="text-[11px] text-muted-foreground">{k}</p><p className="font-bold tabular-nums">{v}</p></div>
        ))}
      </div>
      {f.trips === 0 ? <Empty>Nada reservado nesse período.</Empty> : (
        <ChartBox height={180}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={f.byWeek}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" {...axis} />
              <YAxis {...axis} tickFormatter={metric === "gross" ? money : undefined} width={44} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => (metric === "gross" ? usd(v) : v)} />
              <Bar dataKey={metric} fill="#0ea5e9" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>
      )}
      <p className="text-[11px] text-muted-foreground">Viagens futuras da Turo só têm valor depois que o recibo é sincronizado.</p>
    </WCard>
  );
}

// ---- Insights ----------------------------------------------------------------------------

export type Insight = { tone: "good" | "warn" | "bad" | "info"; text: ReactNode; href?: string };

export function Insights({ items }: { items: Insight[] }) {
  const icon = (t: Insight["tone"]) =>
    t === "good" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> :
    t === "info" ? <Lightbulb className="h-4 w-4 text-sky-600" /> :
    <AlertTriangle className={cn("h-4 w-4", t === "bad" ? "text-red-600" : "text-amber-600")} />;
  return (
    <WCard title="Insights e atenção" icon={<Lightbulb className="h-4 w-4" />} description="O que os números do período mostram e o que pede ação">
      {items.length === 0 ? <Empty>Tudo em ordem.</Empty> : (
        <ScrollBox maxHeight={360}>
          <ul className="space-y-2 text-sm">
            {items.map((it, i) => {
              const body = (
                <span className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">{icon(it.tone)}</span>
                  <span>{it.text}</span>
                </span>
              );
              return (
                <li key={i} className="rounded-md border px-2.5 py-2">
                  {it.href ? <Link href={it.href} className="block hover:underline">{body}</Link> : body}
                </li>
              );
            })}
          </ul>
        </ScrollBox>
      )}
    </WCard>
  );
}
