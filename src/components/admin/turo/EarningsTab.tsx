import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TuroExtras, JsonView, EmptyExtra, StatTile, fmtMoney, fmtDateTime } from "./shared";

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

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
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

  // Per vehicle
  const byVehicle = new Map<string, number>();
  for (const e of earningEntries) {
    const k = e.vehicleName || "Outros";
    byVehicle.set(k, (byVehicle.get(k) ?? 0) + (e.amount ?? 0));
  }
  const vehicles = [...byVehicle.entries()].sort((a, b) => b[1] - a[1]);
  const vehMax = Math.max(1, ...vehicles.map((v) => v[1]));

  // Per month
  const byMonth = new Array(12).fill(0) as number[];
  for (const e of earningEntries) {
    const m = e.createdDate ? Number(e.createdDate.slice(5, 7)) - 1 : -1;
    if (m >= 0 && m < 12) byMonth[m] += e.amount ?? 0;
  }
  const monthMax = Math.max(1, ...byMonth);

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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label={`Ganhos ${year}`} value={fmtMoney(totalEarned, currency)} hint={`${earningEntries.length} lançamentos`} />
        <StatTile label="Viagens pagas" value={String(tripCount)} />
        <StatTile label="Repassado ao banco" value={fmtMoney(totalPaidOut, currency)} hint={`${payoutEntries.length} repasses`} />
        <StatTile label="Veículos" value={String(vehicles.length)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Ganhos por mês</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-end gap-1.5 h-32">
              {byMonth.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <span className="text-[9px] font-semibold text-muted-foreground tabular-nums">{v > 0 ? Math.round(v) : ""}</span>
                  <div className="w-full rounded-t" style={{ height: `${(v / monthMax) * 100}%`, minHeight: v > 0 ? 4 : 0, background: "#1b8f6b" }} title={fmtMoney(v, currency)} />
                  <span className="text-[9px] text-muted-foreground">{MONTHS[i]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Ganhos por veículo</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {vehicles.slice(0, 7).map(([name, amt]) => (
              <div key={name} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate font-medium">{name}</span>
                  <span className="tabular-nums text-muted-foreground shrink-0 ml-2">{fmtMoney(amt, currency)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(amt / vehMax) * 100}%`, background: "#1b8f6b" }} />
                </div>
              </div>
            ))}
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
