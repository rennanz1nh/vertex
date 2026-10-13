import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Car as CarIcon } from "lucide-react";
import { TuroTrip, vehicleLabel, fmtDate, durationDays } from "./shared";

type VehicleAgg = {
  key: string;
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
  first: string | null;
  last: string | null;
};

function Thumb({ url }: { url: string | null }) {
  const [err, setErr] = useState(false);
  if (!url || err) {
    return <div className="rounded-md bg-muted flex items-center justify-center shrink-0 w-12 h-12"><CarIcon className="h-5 w-5 text-muted-foreground" /></div>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" onError={() => setErr(true)} className="rounded-md object-cover shrink-0 w-12 h-12" />;
}

export function VehiclesTab({ trips }: { trips: TuroTrip[] }) {
  const [q, setQ] = useState("");
  const now = Date.now();

  const vehicles = useMemo(() => {
    const map = new Map<string, VehicleAgg>();
    for (const t of trips) {
      const key = t.vehicle_id || vehicleLabel(t);
      let v = map.get(key);
      if (!v) {
        v = {
          key, label: vehicleLabel(t), trim: t.vehicle_trim, type: t.vehicle_type,
          vin: t.vehicle_vin, plate: t.vehicle_license_plate, image: t.vehicle_image_url,
          matched: false, trips: 0, days: 0, upcoming: 0, first: null, last: null,
        };
        map.set(key, v);
      }
      v.trips++;
      v.days += durationDays(t.pickup_date, t.return_date);
      v.matched = v.matched || !!t.product_id;
      if (t.pickup_date) {
        if (new Date(t.pickup_date).getTime() >= now) v.upcoming++;
        if (!v.first || t.pickup_date < v.first) v.first = t.pickup_date;
        if (!v.last || t.pickup_date > v.last) v.last = t.pickup_date;
      }
    }
    return [...map.values()].sort((a, b) => b.trips - a.trips);
  }, [trips, now]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return vehicles;
    return vehicles.filter((v) => [v.label, v.vin, v.plate, v.type].filter(Boolean).join(" ").toLowerCase().includes(n));
  }, [vehicles, q]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar carro, placa, VIN..." className="pl-8" />
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} veículo(s)</p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((v) => (
          <div key={v.key} className="rounded-xl border bg-card p-3 flex gap-3">
            <Thumb url={v.image} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm truncate">{v.label}</p>
                {v.matched
                  ? <Badge className="bg-green-100 text-green-800 border-green-200 border text-[9px] px-1 py-0 h-4 shrink-0">cadastrado</Badge>
                  : <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">Turo</Badge>}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {[v.trim, v.type].filter(Boolean).join(" · ") || "—"}
              </p>
              {(v.plate || v.vin) && (
                <p className="text-[11px] text-muted-foreground font-mono truncate">
                  {v.plate ?? ""}{v.plate && v.vin ? " · " : ""}{v.vin ?? ""}
                </p>
              )}
              <div className="flex gap-3 mt-2 text-xs">
                <span><strong className="tabular-nums">{v.trips}</strong> viagens</span>
                <span><strong className="tabular-nums">{v.days}</strong> dias</span>
                {v.upcoming > 0 && <span className="text-blue-600"><strong className="tabular-nums">{v.upcoming}</strong> futuras</span>}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {fmtDate(v.first)} — {fmtDate(v.last)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
