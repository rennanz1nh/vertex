import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { TuroTrip, TuroExtras, vehicleLabel, fmtDate, fmtMoney, buildFinanceIndex } from "./shared";

type GuestAgg = {
  name: string;
  trips: number;
  revenue: number;
  vehicles: Set<string>;
  first: string | null;
  last: string | null;
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}
// Deterministic muted avatar color from the name.
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 45% 45%)`;
}

export function GuestsTab({ trips, extras }: { trips: TuroTrip[]; extras: TuroExtras | null }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("revenue");
  const fin = useMemo(() => buildFinanceIndex(extras), [extras]);

  const guests = useMemo(() => {
    const map = new Map<string, GuestAgg>();
    for (const t of trips) {
      const name = (t.guest_name || "").trim();
      if (!name) continue;
      let g = map.get(name);
      if (!g) { g = { name, trips: 0, revenue: 0, vehicles: new Set(), first: null, last: null }; map.set(name, g); }
      g.trips++;
      g.revenue += fin.byReservation.get(t.turo_trip_id) ?? 0;
      g.vehicles.add(vehicleLabel(t));
      if (t.pickup_date) {
        if (!g.first || t.pickup_date < g.first) g.first = t.pickup_date;
        if (!g.last || t.pickup_date > g.last) g.last = t.pickup_date;
      }
    }
    return [...map.values()];
  }, [trips, fin]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    const list = n ? guests.filter((g) => g.name.toLowerCase().includes(n)) : guests;
    const sorted = [...list];
    if (sort === "revenue") sorted.sort((a, b) => b.revenue - a.revenue || b.trips - a.trips);
    else sorted.sort((a, b) => b.trips - a.trips || a.name.localeCompare(b.name));
    return sorted;
  }, [guests, q, sort]);

  const totalRevenue = guests.reduce((s, g) => s + g.revenue, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar hóspede..." className="pl-8" />
        </div>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="revenue">Maior receita</SelectItem>
            <SelectItem value="trips">Mais viagens</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground ml-auto">
          {filtered.length} hóspedes · {guests.filter((g) => g.trips > 1).length} recorrentes · <span className="text-emerald-700 font-semibold">{fmtMoney(totalRevenue)}</span>
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="p-3 font-medium">Hóspede</th>
              <th className="p-3 font-medium">Viagens</th>
              <th className="p-3 font-medium text-right">Gasto total</th>
              <th className="p-3 font-medium">Veículos</th>
              <th className="p-3 font-medium whitespace-nowrap">Última</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum hóspede encontrado.</td></tr>
            ) : filtered.map((g) => (
              <tr key={g.name} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0" style={{ background: avatarColor(g.name) }}>
                      {initials(g.name)}
                    </span>
                    <span className="font-medium">{g.name}</span>
                    {g.trips > 1 && <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 border text-[9px] px-1 py-0 h-4">recorrente</Badge>}
                  </div>
                </td>
                <td className="p-3 tabular-nums">{g.trips}</td>
                <td className="p-3 text-right tabular-nums font-medium">{g.revenue > 0 ? <span className="text-emerald-700">{fmtMoney(g.revenue)}</span> : "—"}</td>
                <td className="p-3 text-muted-foreground truncate max-w-[260px]">{[...g.vehicles].join(", ")}</td>
                <td className="p-3 whitespace-nowrap">{fmtDate(g.last)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
