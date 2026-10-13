import { useState } from "react";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { TuroExtras, JsonView, EmptyExtra, StatTile, fmtMoney, fmtDateTime } from "./shared";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const compactMoney = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`);
const revConfig = { revenue: { label: "Receita", color: "#1b8f6b" } } satisfies ChartConfig;

type EarningEntry = {
  amount?: number;
  detail?: string;
  vehicleId?: number | null;
  createdDate?: string;
  description?: string;
  vehicleName?: string | null;
  earningsType?: string;
  reservation?: { reservationId?: number } | null;
  amountWithCurrency?: { amount?: number; currencyCode?: string };
};
type EarningsBlob = { years?: Record<string, { ownerEarningsList?: EarningEntry[] }>; scorecard?: unknown };

const isPayout = (e: EarningEntry) => e.earningsType === "DIRECT_DEPOSIT_PAYMENT";

export function EarningsTab({ extras }: { extras: TuroExtras | null }) {
  const earnings = extras?.earnings as EarningsBlob | null;
  const years = earnings?.years ?? {};
  const yearKeys = Object.keys(years).filter((y) => (years[y]?.ownerEarningsList?.length ?? 0) > 0).sort((a, b) => Number(b) - Number(a));
  const [year, setYear] = useState<string>(yearKeys[0] ?? "");

  if (!earnings || yearKeys.length === 0) return <EmptyExtra label="Ganhos" />;

  const list = years[year]?.ownerEarningsList ?? [];
  const currency = list.find((e) => e.amountWithCurrency?.currencyCode)?.amountWithCurrency?.currencyCode ?? "USD";
  const earningEntries = list.filter((e) => !isPayout(e));
  const payoutEntries = list.filter(isPayout);
  const totalEarned = earningEntries.reduce((s, e) => s + (e.amount ?? 0), 0);
  const totalPaidOut = payoutEntries.reduce((s, e) => s + (e.amount ?? 0), 0);
  const tripCount = earningEntries.filter((e) => e.reservation?.reservationId).length;

  // Turo fees from stored receipts, for the trips earned in the selected year
  let feeTotal = 0, grossTotal = 0, feeTrips = 0;
  for (const e of earningEntries) {
    const rid = e.reservation?.reservationId;
    const r = rid != null ? extras?.receipts?.[String(rid)] : undefined;
    if (r?.turo_fee != null && r.trip_total != null) { feeTotal += r.turo_fee; grossTotal += r.trip_total; feeTrips++; }
  }

  // Per vehicle
  const byVehicle = new Map<string, number>();
  for (const e of earningEntries) {
    const k = e.vehicleName || "Outros";
    byVehicle.set(k, (byVehicle.get(k) ?? 0) + (e.amount ?? 0));
  }
  const vehicles = [...byVehicle.entries()].sort((a, b) => b[1] - a[1]);
  const revByVehicle = vehicles.slice(0, 8).map(([name, revenue]) => ({ name, revenue }));

  // Per month
  const byMonth = new Array(12).fill(0) as number[];
  for (const e of earningEntries) {
    const m = e.createdDate ? Number(e.createdDate.slice(5, 7)) - 1 : -1;
    if (m >= 0 && m < 12) byMonth[m] += e.amount ?? 0;
  }
  const revByMonth = byMonth.map((revenue, i) => ({ month: MONTHS[i], revenue }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {yearKeys.map((y) => (
          <button key={y} onClick={() => setYear(y)}
            className={`px-3 py-1 rounded-full text-sm font-medium ${y === year ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground"}`}>
            {y}
          </button>
        ))}
        {extras?.syncedAt && <span className="text-xs text-muted-foreground ml-auto">Capturado em {fmtDateTime(extras.syncedAt)}</span>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile label={`Ganhos ${year}`} value={fmtMoney(totalEarned, currency)} hint={`${earningEntries.length} lançamentos`} />
        <StatTile label="Viagens pagas" value={String(tripCount)} />
        <StatTile label="Taxas da Turo" value={feeTrips ? fmtMoney(feeTotal, currency) : "—"} hint={feeTrips ? `${((feeTotal / grossTotal) * 100).toFixed(1)}% do valor pago · ${feeTrips} recibos` : "sincronize para trazer recibos"} />
        <StatTile label="Repassado ao banco" value={fmtMoney(totalPaidOut, currency)} hint={`${payoutEntries.length} repasses`} />
        <StatTile label="Veículos" value={String(vehicles.length)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm font-semibold">Ganhos por mês · {year}</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={revConfig} className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revByMonth} margin={{ left: 4, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="earnFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={44} tickFormatter={compactMoney} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmtMoney(Number(v), currency)} />} />
                  <Area type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2} fill="url(#earnFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm font-semibold">Ganhos por veículo · {year}</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={revConfig} className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revByVehicle} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={compactMoney} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={120} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmtMoney(Number(v), currency)} />} />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Lançamentos {year}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="p-2.5 font-medium">Data</th>
                  <th className="p-2.5 font-medium">Descrição</th>
                  <th className="p-2.5 font-medium">Veículo</th>
                  <th className="p-2.5 font-medium">Tipo</th>
                  <th className="p-2.5 font-medium text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-2.5 whitespace-nowrap">{e.createdDate ?? "—"}</td>
                    <td className="p-2.5">{e.description ?? e.detail ?? "—"}</td>
                    <td className="p-2.5 text-muted-foreground">{e.vehicleName ?? "—"}</td>
                    <td className="p-2.5">
                      {isPayout(e)
                        ? <Badge variant="outline" className="text-[10px]">repasse</Badge>
                        : <Badge className="bg-green-100 text-green-800 border-green-200 border text-[10px]">viagem</Badge>}
                    </td>
                    <td className="p-2.5 text-right tabular-nums font-medium">{fmtMoney(e.amount, e.amountWithCurrency?.currencyCode ?? currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {earnings.scorecard != null && (
        <details className="rounded-lg border p-3">
          <summary className="text-sm font-medium cursor-pointer">Resumo bruto (scorecard)</summary>
          <div className="mt-2"><JsonView value={earnings.scorecard} /></div>
        </details>
      )}
    </div>
  );
}
