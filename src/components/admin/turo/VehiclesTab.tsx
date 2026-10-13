import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Car as CarIcon } from "lucide-react";
import { TuroTrip, TuroExtras, vehicleLabel, fmtDate, fmtMoney, durationDays, buildFinanceIndex } from "./shared";

type VehicleAgg = {
  key: string;
  vehicleId: string;
  label: string;
  trim: string | null;
  type: string | null;
  vin: string | null;
  plate: string | null;
  image: string | null;
  matched: boolean;
  trips: number;
  days: number;
  upcoming: number;
  revenue: number;
  first: string | null;
  last: string | null;
};

function Thumb({ url }: { url: string | null }) {
  const [err, setErr] = useState(false);
  if (!url || err) {
    return <div className="rounded-lg bg-muted flex items-center justify-center shrink-0 w-16 h-16"><CarIcon className="h-6 w-6 text-muted-foreground" /></div>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" onError={() => setErr(true)} className="rounded-lg object-cover shrink-0 w-16 h-16" />;
}

export function VehiclesTab({ trips, extras }: { trips: TuroTrip[]; extras: TuroExtras | null }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("revenue");
  const now = Date.now();
  const fin = useMemo(() => buildFinanceIndex(extras), [extras]);

  const vehicles = useMemo(() => {
    const map = new Map<string, VehicleAgg>();
    for (const t of trips) {
      const key = t.vehicle_id || vehicleLabel(t);
      let v = map.get(key);
      if (!v) {
        v = {
          key, vehicleId: t.vehicle_id, label: vehicleLabel(t), trim: t.vehicle_trim, type: t.vehicle_type,
          vin: t.vehicle_vin, plate: t.vehicle_license_plate, image: t.vehicle_image_url,
          matched: false, trips: 0, days: 0, upcoming: 0, revenue: 0, first: null, last: null,
        };
        map.set(key, v);
      }
      v.trips++;
      v.days += durationDays(t.pickup_date, t.return_date);
      v.matched = v.matched || !!t.product_id;
      v.revenue += fin.byReservation.get(t.turo_trip_id) ?? 0;
      if (t.pickup_date) {
        if (new Date(t.pickup_date).getTime() >= now) v.upcoming++;
        if (!v.first || t.pickup_date < v.first) v.first = t.pickup_date;
        if (!v.last || t.pickup_date > v.last) v.last = t.pickup_date;
      }
    }
    // Prefer vehicleId-indexed revenue when available (covers earnings without a trip row)
    for (const v of map.values()) {
      const byVeh = fin.byVehicle.get(v.vehicleId);
      if (byVeh != null && byVeh > v.revenue) v.revenue = byVeh;
    }
    return [...map.values()];
  }, [trips, fin, now]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    const list = n ? vehicles.filter((v) => [v.label, v.vin, v.plate, v.type].filter(Boolean).join(" ").toLowerCase().includes(n)) : vehicles;
    const sorted = [...list];
    if (sort === "revenue") sorted.sort((a, b) => b.revenue - a.revenue);
    else if (sort === "trips") sorted.sort((a, b) => b.trips - a.trips);
    else if (sort === "days") sorted.sort((a, b) => b.days - a.days);
    return sorted;
  }, [vehicles, q, sort]);

  const revMax = Math.max(1, ...vehicles.map((v) => v.revenue));
  const totalRevenue = vehicles.reduce((s, v) => s + v.revenue, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar carro, placa, VIN..." className="pl-8" />
        </div>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="revenue">Maior receita</SelectItem>
            <SelectItem value="trips">Mais viagens</SelectItem>
            <SelectItem value="days">Mais dias</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground ml-auto">
          {filtered.length} veículos · <span className="text-emerald-700 font-semibold">{fmtMoney(totalRevenue)}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((v) => (
          <div key={v.key} className="rounded-xl border bg-card p-3 flex gap-3">
            <Thumb url={v.image} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm truncate">{v.label}</p>
                {v.matched
                  ? <Badge className="bg-green-100 text-green-800 border-green-200 border text-[9px] px-1 py-0 h-4 shrink-0">frota</Badge>
                  : <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">Turo</Badge>}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{[v.trim, v.type].filter(Boolean).join(" · ") || "—"}{v.plate ? ` · ${v.plate}` : ""}</p>

              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="text-lg font-bold text-emerald-700 tabular-nums">{v.revenue > 0 ? fmtMoney(v.revenue) : "—"}</span>
                <span className="text-[11px] text-muted-foreground">{v.trips} viagens · {v.days}d</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
                <div className="h-full rounded-full bg-emerald-600" style={{ width: `${(v.revenue / revMax) * 100}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {v.upcoming > 0 && <span className="text-blue-600 font-medium">{v.upcoming} futuras · </span>}
                {fmtDate(v.first)} — {fmtDate(v.last)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
