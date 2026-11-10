"use client";

import type { ReactNode } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, CalendarDays, Car, CircleDollarSign, Gauge, Percent, Receipt, Timer, TrendingUp, Users, Wallet, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartBox, ScrollBox } from "@/components/dashboard/ResizableGrid";
import { cn } from "@/lib/utils";
import { OptionBar, Segmented, tooltipStyle, usePersisted } from "./controls";
import {
  CHANNEL_COLORS, CHANNEL_HINT, CHART_COLORS, pct, pctChange, usd, usd0,
  type CarStat, type Channel, type MonthPoint, type Summary,
} from "./data";

// ---- Shared ------------------------------------------------------------------------------

export function WCard({ title, icon, description, action, children, className, bodyClassName }: {
  title: ReactNode;
  icon?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("flex h-full flex-col overflow-hidden", className)}>
      <CardHeader className="shrink-0 space-y-1 pb-2 max-md:px-4 max-md:pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">{icon}{title}</CardTitle>
          {action}
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className={cn("flex min-h-0 flex-1 flex-col gap-3 overflow-auto max-md:px-4 max-md:pb-4", bodyClassName)}>{children}</CardContent>
    </Card>
  );
}

export function Delta({ cur, prev, hasPrev, invert, className }: { cur: number; prev: number; hasPrev: boolean; invert?: boolean; className?: string }) {
  if (!hasPrev) return null;
  const p = pctChange(cur, prev);
  if (p === null) return <span className={cn("text-[11px] text-muted-foreground", className)}>novo</span>;
  if (Math.abs(p) < 0.005) return <span className={cn("text-[11px] text-muted-foreground", className)}>=</span>;
  const good = invert ? p < 0 : p > 0;
  const Icon = p > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center text-[11px] font-semibold", good ? "text-emerald-600" : "text-red-600", className)}>
      <Icon className="h-3 w-3" />
      {Math.abs(p * 100).toFixed(Math.abs(p) < 0.1 ? 1 : 0)}%
    </span>
  );
}

export function Empty({ children = "Sem dados no período." }: { children?: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

const axis = { fontSize: 11, tickLine: false, axisLine: false } as const;
const money = (v: number) => (Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`);

// ---- Channel tiles -----------------------------------------------------------------------

export function ChannelTile({ name, selected, onClick, cur, prev, hasPrev, color, hint }: {
  name: string;
  selected: boolean;
  onClick: () => void;
  cur: Summary;
  prev: Summary;
  hasPrev: boolean;
  color?: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={cn(
        "rounded-xl border bg-card p-3 text-left transition-colors hover:border-foreground/40 max-md:min-w-0 max-md:p-2.5",
        selected && "border-foreground ring-1 ring-foreground",
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color ?? "#111827" }} />
        <span className="max-md:truncate">{name}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2 max-md:flex-wrap max-md:gap-x-1.5 max-md:gap-y-0">
        <span className="text-lg font-bold tabular-nums max-md:text-base">{usd0(cur.gross)}</span>
        <Delta cur={cur.gross} prev={prev.gross} hasPrev={hasPrev} />
      </div>
      <p className="text-[11px] text-muted-foreground max-md:truncate">{cur.trips} locações · {cur.days} diárias</p>
    </button>
  );
}

// ---- KPIs --------------------------------------------------------------------------------

export function KpiGrid({ cur, prev, hasPrev, fleetSize, occupancy, prevOccupancy }: {
  cur: Summary;
  prev: Summary;
  hasPrev: boolean;
  fleetSize: number;
  occupancy: number;
  prevOccupancy: number;
}) {
  const items: { label: string; value: string; icon: ReactNode; cur: number; prev: number; invert?: boolean; hint?: string }[] = [
    { label: "Receita bruta", value: usd(cur.gross), icon: <CircleDollarSign className="h-4 w-4" />, cur: cur.gross, prev: prev.gross, hint: "O que os clientes pagaram" },
    { label: "Receita líquida", value: usd(cur.net), icon: <Wallet className="h-4 w-4" />, cur: cur.net, prev: prev.net, hint: "O que fica para vocês, depois da taxa da Turo" },
    { label: "Taxa Turo", value: usd(cur.fee), icon: <Receipt className="h-4 w-4" />, cur: cur.fee, prev: prev.fee, invert: true },
    { label: "Locações", value: String(cur.trips), icon: <Car className="h-4 w-4" />, cur: cur.trips, prev: prev.trips },
    { label: "Diárias", value: String(cur.days), icon: <CalendarDays className="h-4 w-4" />, cur: cur.days, prev: prev.days },
    { label: "Ocupação da frota", value: pct(occupancy), icon: <Gauge className="h-4 w-4" />, cur: occupancy, prev: prevOccupancy, hint: `Diárias alugadas ÷ (${fleetSize} carros × dias do período)` },
    { label: "Diária média", value: usd(cur.adr), icon: <TrendingUp className="h-4 w-4" />, cur: cur.adr, prev: prev.adr },
    { label: "Ticket médio", value: usd(cur.avgTicket), icon: <Receipt className="h-4 w-4" />, cur: cur.avgTicket, prev: prev.avgTicket },
    { label: "Duração média", value: `${cur.avgLength.toFixed(1)} dias`, icon: <Timer className="h-4 w-4" />, cur: cur.avgLength, prev: prev.avgLength },
    { label: "Clientes", value: String(cur.customers), icon: <Users className="h-4 w-4" />, cur: cur.customers, prev: prev.customers },
    { label: "Cancelamentos", value: `${cur.cancelled} (${pct(cur.cancelRate)})`, icon: <XCircle className="h-4 w-4" />, cur: cur.cancelRate, prev: prev.cancelRate, invert: true },
    { label: "Margem após taxa", value: cur.gross ? pct(cur.net / cur.gross) : "—", icon: <Percent className="h-4 w-4" />, cur: cur.gross ? cur.net / cur.gross : 0, prev: prev.gross ? prev.net / prev.gross : 0 },
  ];
  return (
    <WCard title="Resumo do período" icon={<TrendingUp className="h-4 w-4" />}>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))] max-md:grid-cols-2 max-md:gap-2">
        {items.map((i) => (
          <div key={i.label} className="rounded-lg border p-3 max-md:min-w-0 max-md:p-2.5" title={i.hint}>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground max-md:text-[11px] max-md:[&>svg]:h-3.5 max-md:[&>svg]:w-3.5 max-md:[&>svg]:shrink-0">{i.icon}<span className="max-md:truncate">{i.label}</span></div>
            <div className="mt-1 flex items-baseline gap-2 max-md:flex-wrap max-md:gap-x-1.5 max-md:gap-y-0">
              <span className="text-lg font-bold tabular-nums max-md:text-base">{i.value}</span>
              <Delta cur={i.cur} prev={i.prev} hasPrev={hasPrev} invert={i.invert} />
            </div>
          </div>
        ))}
      </div>
    </WCard>
  );
}

// ---- Gross → fee → net -------------------------------------------------------------------

export function Waterfall({ cur }: { cur: Summary }) {
  const data = [
    { label: "Bruto", value: cur.gross, base: 0, color: "#593cfb" },
    { label: "Taxa Turo", value: cur.fee, base: Math.max(0, cur.gross - cur.fee), color: "#ef4444" },
    { label: "Líquido", value: cur.net, base: 0, color: "#10b981" },
  ];
  return (
    <WCard title="Para onde vai a receita" icon={<Wallet className="h-4 w-4" />} description="Do que o cliente paga até o que fica com vocês">
      {cur.gross === 0 ? <Empty /> : (
        <ChartBox height={220} phoneHeight={180}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" {...axis} />
              <YAxis {...axis} tickFormatter={money} width={48} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, k) => (k === "base" ? null : usd(v))} />
              <Bar dataKey="base" stackId="w" fill="transparent" />
              <Bar dataKey="value" stackId="w" radius={[6, 6, 0, 0]}>
                {data.map((d) => <Cell key={d.label} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>
      )}
    </WCard>
  );
}

// ---- Monthly -----------------------------------------------------------------------------

type MonthlyType = "combo" | "bars" | "lines" | "area" | "stacked";
type MonthlyMetric = "gross" | "net" | "trips" | "days";
type MonthlySpan = "6" | "12" | "24";
const MONTHLY_TYPES: { key: MonthlyType; label: string }[] = [
  { key: "combo", label: "Combinado" },
  { key: "bars", label: "Barras" },
  { key: "lines", label: "Linhas" },
  { key: "area", label: "Área" },
  { key: "stacked", label: "Bruto vs taxa" },
];
const MONTHLY_METRICS: { key: MonthlyMetric; label: string }[] = [
  { key: "gross", label: "Receita bruta" },
  { key: "net", label: "Líquida" },
  { key: "trips", label: "Locações" },
  { key: "days", label: "Diárias" },
];
const MONTHLY_SPANS: { key: MonthlySpan; label: string }[] = [
  { key: "6", label: "6 meses" },
  { key: "12", label: "12 meses" },
  { key: "24", label: "24 meses" },
];
const METRIC_LABEL: Record<string, string> = { gross: "Receita bruta", net: "Receita líquida", trips: "Locações", days: "Diárias", fee: "Taxa Turo" };
const isMoney = (k: string) => k === "gross" || k === "net" || k === "fee";

export function MonthlyChart({ byMonths, channelLabel }: { byMonths: (months: number) => MonthPoint[]; channelLabel: string }) {
  const [type, setType] = usePersisted<MonthlyType>("vx.dash.monthlyType", "combo", MONTHLY_TYPES.map((o) => o.key));
  const [metric, setMetric] = usePersisted<MonthlyMetric>("vx.dash.monthlyMetric", "gross", MONTHLY_METRICS.map((o) => o.key));
  const [span, setSpan] = usePersisted<MonthlySpan>("vx.dash.monthlySpan", "12", MONTHLY_SPANS.map((o) => o.key));
  const data = byMonths(Number(span));
  const fmt = (v: number) => (isMoney(metric) ? money(v) : String(v));
  const tip = (v: number, k: string) => [isMoney(k) ? usd(v) : v, METRIC_LABEL[k] ?? k];
  const color = "#593cfb";

  let chart: ReactNode;
  if (type === "combo") {
    chart = (
      <ComposedChart data={data}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" {...axis} />
        <YAxis yAxisId="l" {...axis} tickFormatter={money} width={48} />
        <YAxis yAxisId="r" orientation="right" {...axis} width={30} />
        <Tooltip contentStyle={tooltipStyle} formatter={tip} />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={(k) => METRIC_LABEL[k] ?? k} />
        <Bar yAxisId="l" dataKey="gross" fill={color} radius={[4, 4, 0, 0]} />
        <Line yAxisId="r" dataKey="trips" stroke="#f59e0b" strokeWidth={2} dot={false} />
      </ComposedChart>
    );
  } else if (type === "stacked") {
    chart = (
      <BarChart data={data.map((d) => ({ ...d, net: d.net }))}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} tickFormatter={money} width={48} />
        <Tooltip contentStyle={tooltipStyle} formatter={tip} />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={(k) => METRIC_LABEL[k] ?? k} />
        <Bar dataKey="net" stackId="s" fill="#10b981" />
        <Bar dataKey="fee" stackId="s" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    );
  } else if (type === "bars") {
    chart = (
      <BarChart data={data}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} tickFormatter={fmt} width={48} />
        <Tooltip contentStyle={tooltipStyle} formatter={tip} />
        <Bar dataKey={metric} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    );
  } else if (type === "lines") {
    chart = (
      <LineChart data={data}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} tickFormatter={fmt} width={48} />
        <Tooltip contentStyle={tooltipStyle} formatter={tip} />
        <Line dataKey={metric} stroke={color} strokeWidth={2.5} dot={{ r: 3 }} />
      </LineChart>
    );
  } else {
    chart = (
      <AreaChart data={data}>
        <defs>
          <linearGradient id="vxArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} tickFormatter={fmt} width={48} />
        <Tooltip contentStyle={tooltipStyle} formatter={tip} />
        <Area dataKey={metric} stroke={color} strokeWidth={2} fill="url(#vxArea)" />
      </AreaChart>
    );
  }

  return (
    <WCard title="Evolução mensal" icon={<CalendarDays className="h-4 w-4" />} description={channelLabel}>
      <OptionBar>
        <Segmented label="Gráfico" options={MONTHLY_TYPES} value={type} onChange={setType} />
        {(type === "bars" || type === "lines" || type === "area") && <Segmented label="Mostrar" options={MONTHLY_METRICS} value={metric} onChange={setMetric} />}
        <Segmented label="Período" options={MONTHLY_SPANS} value={span} onChange={setSpan} />
      </OptionBar>
      <ChartBox height={280} phoneHeight={220}>
        <ResponsiveContainer width="100%" height="100%">{chart as React.ReactElement}</ResponsiveContainer>
      </ChartBox>
    </WCard>
  );
}

// ---- Fleet performance -------------------------------------------------------------------

type FleetSort = "gross" | "occupancy" | "days" | "trips" | "net";
type FleetView = "bars" | "list" | "occupancy";
const FLEET_SORTS: { key: FleetSort; label: string }[] = [
  { key: "gross", label: "Receita" },
  { key: "net", label: "Líquida" },
  { key: "occupancy", label: "Ocupação" },
  { key: "days", label: "Diárias" },
  { key: "trips", label: "Locações" },
];
const FLEET_VIEWS: { key: FleetView; label: string }[] = [
  { key: "bars", label: "Barras" },
  { key: "occupancy", label: "Ocupação %" },
  { key: "list", label: "Lista" },
];

export function FleetPerformance({ cars }: { cars: CarStat[] }) {
  const [sort, setSort] = usePersisted<FleetSort>("vx.dash.fleetSort", "gross", FLEET_SORTS.map((s) => s.key));
  const [view, setView] = usePersisted<FleetView>("vx.dash.fleetView", "bars", FLEET_VIEWS.map((s) => s.key));
  const key: FleetSort = view === "occupancy" ? "occupancy" : sort;
  const rows = [...cars].sort((a, b) => (b[key] as number) - (a[key] as number));
  const value = (c: CarStat) => (key === "occupancy" ? pct(c.occupancy) : isMoney(key) ? usd0(c[key] as number) : String(c[key]));

  return (
    <WCard title="Desempenho por carro" icon={<Car className="h-4 w-4" />} description="Receita, diárias e ocupação de cada carro no período">
      <OptionBar>
        <Segmented label="Ordenar" options={FLEET_SORTS} value={sort} onChange={setSort} />
        <Segmented label="Exibir" options={FLEET_VIEWS} value={view} onChange={setView} />
      </OptionBar>
      {rows.length === 0 ? <Empty /> : view === "list" ? (
        <ScrollBox maxHeight={360}>
          <table className="w-full text-sm max-md:text-xs">
            <thead className="text-xs text-muted-foreground">
              <tr><th className="py-1 text-left font-medium">Carro</th><th className="text-right font-medium">Locações</th><th className="text-right font-medium">Diárias</th><th className="text-right font-medium">Ocupação</th><th className="text-right font-medium">Receita</th></tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.key} className="border-t">
                  <td className="py-1.5">
                    <div className="flex items-center gap-2">
                      {c.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.image} alt="" className="h-7 w-10 rounded object-cover" />
                      ) : <span className="h-7 w-10 rounded bg-muted" />}
                      <span className="truncate">{c.label}</span>
                    </div>
                  </td>
                  <td className="text-right tabular-nums">{c.trips}</td>
                  <td className="text-right tabular-nums">{c.days}</td>
                  <td className="text-right tabular-nums">{pct(c.occupancy)}</td>
                  <td className="text-right font-medium tabular-nums">{usd0(c.gross)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollBox>
      ) : (
        <ChartBox height={Math.max(220, rows.length * 30)}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" {...axis} tickFormatter={view === "occupancy" ? (v) => pct(v) : sort === "occupancy" ? (v) => pct(v) : isMoney(sort) ? money : undefined} domain={view === "occupancy" ? [0, 1] : undefined} />
              <YAxis type="category" dataKey="label" {...axis} width={130} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => (view === "occupancy" || sort === "occupancy" ? pct(v) : isMoney(sort) ? usd(v) : v)} />
              <Bar dataKey={view === "occupancy" ? "occupancy" : sort} radius={[0, 6, 6, 0]} label={{ position: "right", fontSize: 11, formatter: (v: number) => (view === "occupancy" || sort === "occupancy" ? pct(v) : isMoney(sort) ? usd0(v) : v) }}>
                {rows.map((c, i) => <Cell key={c.key} fill={view === "occupancy" ? (c.occupancy >= 0.6 ? "#10b981" : c.occupancy >= 0.3 ? "#f59e0b" : "#ef4444") : CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>
      )}
      {view !== "list" && rows[0] && (
        <p className="text-[11px] text-muted-foreground">
          Por {FLEET_SORTS.find((s) => s.key === key)?.label.toLowerCase()}: <b>{rows[0].label}</b> lidera com {value(rows[0])}.
        </p>
      )}
    </WCard>
  );
}

// ---- Breakdowns (channel mix, trip length, weekday) ---------------------------------------

export type BreakdownType = "donut" | "pie" | "bars" | "hbars";
export const BREAKDOWN_TYPES: { key: BreakdownType; label: string }[] = [
  { key: "donut", label: "Rosca" },
  { key: "pie", label: "Pizza" },
  { key: "bars", label: "Colunas" },
  { key: "hbars", label: "Barras" },
];

export function Breakdown({ data, type, isMoneyValue, colors }: { data: { label: string; value: number }[]; type: BreakdownType; isMoneyValue: boolean; colors?: string[] }) {
  const palette = colors ?? CHART_COLORS;
  const total = data.reduce((s, d) => s + d.value, 0);
  const fmt = (v: number) => (isMoneyValue ? usd(v) : String(v));
  if (total === 0) return <Empty />;
  if (type === "donut" || type === "pie") {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <ChartBox height={200} phoneHeight={170} className="min-w-[180px] flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="label" innerRadius={type === "donut" ? "58%" : 0} outerRadius="90%" paddingAngle={type === "donut" ? 2 : 0}>
                {data.map((d, i) => <Cell key={d.label} fill={palette[i % palette.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
        </ChartBox>
        <ul className="min-w-[160px] flex-1 space-y-1.5 text-sm max-md:min-w-full">
          {data.map((d, i) => (
            <li key={d.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: palette[i % palette.length] }} />{d.label}</span>
              <span className="tabular-nums text-muted-foreground">{fmt(d.value)} · {pct(d.value / total)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const vertical = type === "hbars";
  return (
    <ChartBox height={vertical ? Math.max(180, data.length * 32) : 220} phoneHeight={vertical ? undefined : 180}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={vertical ? "vertical" : "horizontal"} margin={vertical ? { right: 24 } : undefined}>
          <CartesianGrid {...(vertical ? { horizontal: false } : { vertical: false })} strokeDasharray="3 3" />
          {vertical ? <XAxis type="number" {...axis} tickFormatter={isMoneyValue ? money : undefined} /> : <XAxis dataKey="label" {...axis} />}
          {vertical ? <YAxis type="category" dataKey="label" {...axis} width={90} /> : <YAxis {...axis} tickFormatter={isMoneyValue ? money : undefined} width={44} />}
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
          <Bar dataKey="value" radius={vertical ? [0, 6, 6, 0] : [6, 6, 0, 0]}>
            {data.map((d, i) => <Cell key={d.label} fill={palette[i % palette.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

type MixMetric = "gross" | "net" | "trips" | "days";
const MIX_METRICS: { key: MixMetric; label: string }[] = [
  { key: "gross", label: "Receita" },
  { key: "net", label: "Líquida" },
  { key: "trips", label: "Locações" },
  { key: "days", label: "Diárias" },
];

export function ChannelMix({ channels }: { channels: ({ channel: Channel } & Summary)[] }) {
  const [type, setType] = usePersisted<BreakdownType>("vx.dash.mixType", "donut", BREAKDOWN_TYPES.map((b) => b.key));
  const [metric, setMetric] = usePersisted<MixMetric>("vx.dash.mixMetric", "gross", MIX_METRICS.map((b) => b.key));
  const data = channels.map((c) => ({ label: c.channel, value: c[metric] }));
  return (
    <WCard title="De onde vêm as locações" icon={<CircleDollarSign className="h-4 w-4" />} description="Turo, site e links de pagamento">
      <OptionBar>
        <Segmented label="Gráfico" options={BREAKDOWN_TYPES} value={type} onChange={setType} />
        <Segmented label="Mostrar" options={MIX_METRICS} value={metric} onChange={setMetric} />
      </OptionBar>
      <Breakdown data={data} type={type} isMoneyValue={isMoney(metric)} colors={channels.map((c) => CHANNEL_COLORS[c.channel])} />
      <p className="text-[11px] text-muted-foreground">{channels.map((c) => `${c.channel}: ${CHANNEL_HINT[c.channel]}`).join(" · ")}</p>
    </WCard>
  );
}

type LengthMetric = "trips" | "gross";
export function TripLength({ data }: { data: { label: string; trips: number; gross: number }[] }) {
  const [type, setType] = usePersisted<BreakdownType>("vx.dash.lengthType", "bars", BREAKDOWN_TYPES.map((b) => b.key));
  const [metric, setMetric] = usePersisted<LengthMetric>("vx.dash.lengthMetric", "trips", ["trips", "gross"]);
  return (
    <WCard title="Duração das locações" icon={<Timer className="h-4 w-4" />} description="Quantos dias os clientes costumam ficar">
      <OptionBar>
        <Segmented label="Gráfico" options={BREAKDOWN_TYPES} value={type} onChange={setType} />
        <Segmented label="Mostrar" options={[{ key: "trips", label: "Locações" }, { key: "gross", label: "Receita" }]} value={metric} onChange={setMetric} />
      </OptionBar>
      <Breakdown data={data.map((d) => ({ label: d.label, value: d[metric] }))} type={type} isMoneyValue={metric === "gross"} />
    </WCard>
  );
}

type WeekdayType = "bars" | "line" | "area";
type WeekdayMetric = "trips" | "gross" | "days";
export function WeekdayChart({ data }: { data: { label: string; trips: number; gross: number; days: number }[] }) {
  const [type, setType] = usePersisted<WeekdayType>("vx.dash.weekdayType", "bars", ["bars", "line", "area"]);
  const [metric, setMetric] = usePersisted<WeekdayMetric>("vx.dash.weekdayMetric", "trips", ["trips", "gross", "days"]);
  const best = [...data].sort((a, b) => b[metric] - a[metric])[0];
  const fmt = metric === "gross" ? money : undefined;
  const tip = (v: number) => (metric === "gross" ? usd(v) : v);
  return (
    <WCard title="Dia da semana das retiradas" icon={<CalendarDays className="h-4 w-4" />} description={best && best[metric] > 0 ? `Mais forte: ${best.label}` : undefined}>
      <OptionBar>
        <Segmented label="Gráfico" options={[{ key: "bars", label: "Barras" }, { key: "line", label: "Linha" }, { key: "area", label: "Área" }]} value={type} onChange={setType} />
        <Segmented label="Mostrar" options={[{ key: "trips", label: "Locações" }, { key: "gross", label: "Receita" }, { key: "days", label: "Diárias" }]} value={metric} onChange={setMetric} />
      </OptionBar>
      <ChartBox height={220} phoneHeight={180}>
        <ResponsiveContainer width="100%" height="100%">
          {type === "bars" ? (
            <BarChart data={data}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" {...axis} />
              <YAxis {...axis} tickFormatter={fmt} width={44} />
              <Tooltip contentStyle={tooltipStyle} formatter={tip} />
              <Bar dataKey={metric} radius={[6, 6, 0, 0]}>
                {data.map((d) => <Cell key={d.label} fill={best && d.label === best.label ? "#593cfb" : "#c7c0fe"} />)}
              </Bar>
            </BarChart>
          ) : type === "line" ? (
            <LineChart data={data}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" {...axis} />
              <YAxis {...axis} tickFormatter={fmt} width={44} />
              <Tooltip contentStyle={tooltipStyle} formatter={tip} />
              <Line dataKey={metric} stroke="#593cfb" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          ) : (
            <AreaChart data={data}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" {...axis} />
              <YAxis {...axis} tickFormatter={fmt} width={44} />
              <Tooltip contentStyle={tooltipStyle} formatter={tip} />
              <Area dataKey={metric} stroke="#593cfb" fill="#593cfb33" strokeWidth={2} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </ChartBox>
    </WCard>
  );
}
