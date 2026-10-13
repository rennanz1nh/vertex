import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { TuroStats, StatTile, monthLabel } from "./shared";

export function OverviewTab({ stats }: { stats: TuroStats | null }) {
  if (!stats || stats.summary.totalTrips === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Sem dados ainda.</p>
        <p className="text-sm mt-1">Sincronize na aba <strong>Sincronização</strong> para carregar as viagens.</p>
      </div>
    );
  }

  const monthMax = Math.max(1, ...stats.months.map((m) => m.trips));
  const vehMax = Math.max(1, ...stats.topVehicles.map((v) => v.trips));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Ocupação (30d)" value={`${stats.summary.occupancy30}%`} hint={`${stats.summary.matchedCars}/${stats.summary.fleetSize} carros ativos`} />
        <StatTile label="Viagens" value={String(stats.summary.totalTrips)} hint={`${stats.summary.active} ativas · ${stats.summary.upcoming} futuras`} />
        <StatTile label="Duração média" value={`${stats.summary.avgDurationDays}d`} hint={`${stats.summary.distinctVehicles} veículos`} />
        <StatTile label="Hóspedes" value={String(stats.summary.distinctGuests)} hint={`${stats.summary.repeatGuests} recorrentes`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Viagens por mês (12 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1.5 h-32">
              {stats.months.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">{m.trips || ""}</span>
                  <div
                    className="w-full rounded-t"
                    style={{ height: `${(m.trips / monthMax) * 100}%`, minHeight: m.trips ? 4 : 0, background: "#4338ca" }}
                    title={`${m.month}: ${m.trips}`}
                  />
                  <span className="text-[9px] text-muted-foreground">{monthLabel(m.month)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Veículos por volume</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.topVehicles.slice(0, 6).map((v) => (
              <div key={v.vehicle_id} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate font-medium flex items-center gap-1.5">
                    {v.label}
                    {!v.matched && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">não cadastrado</Badge>}
                  </span>
                  <span className="tabular-nums text-muted-foreground shrink-0 ml-2">{v.trips} · {v.days}d</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(v.trips / vehMax) * 100}%`, background: v.matched ? "#1b8f6b" : "#94a3b8" }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {stats.topGuests.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Hóspedes mais frequentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.topGuests.map((g) => (
                <span key={g.name} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs">
                  {g.name}
                  <span className="font-semibold tabular-nums text-muted-foreground">{g.trips}×</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg p-3">
        <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <p>
          <strong>Ganhos ($) ainda não disponíveis:</strong> os feeds de viagem do Turo não trazem valores.
          A sondagem de endpoints de recibo roda a cada sincronização — veja o resultado na aba Sincronização.
        </p>
      </div>
    </div>
  );
}
