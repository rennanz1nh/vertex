import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { TuroTrip, vehicleLabel, fmtDate } from "./shared";

type GuestAgg = {
  name: string;
  trips: number;
  vehicles: Set<string>;
  first: string | null;
  last: string | null;
};

export function GuestsTab({ trips }: { trips: TuroTrip[] }) {
  const [q, setQ] = useState("");

  const guests = useMemo(() => {
    const map = new Map<string, GuestAgg>();
    for (const t of trips) {
      const name = (t.guest_name || "").trim();
      if (!name) continue;
      let g = map.get(name);
      if (!g) { g = { name, trips: 0, vehicles: new Set(), first: null, last: null }; map.set(name, g); }
      g.trips++;
      g.vehicles.add(vehicleLabel(t));
      if (t.pickup_date) {
        if (!g.first || t.pickup_date < g.first) g.first = t.pickup_date;
        if (!g.last || t.pickup_date > g.last) g.last = t.pickup_date;
      }
    }
    return [...map.values()].sort((a, b) => b.trips - a.trips || a.name.localeCompare(b.name));
  }, [trips]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return guests;
    return guests.filter((g) => g.name.toLowerCase().includes(n));
  }, [guests, q]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar hóspede..." className="pl-8" />
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} hóspede(s) · {guests.filter((g) => g.trips > 1).length} recorrentes</p>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="p-3 font-medium">Hóspede</th>
              <th className="p-3 font-medium">Viagens</th>
              <th className="p-3 font-medium">Veículos</th>
              <th className="p-3 font-medium whitespace-nowrap">Primeira</th>
              <th className="p-3 font-medium whitespace-nowrap">Última</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum hóspede encontrado.</td></tr>
            ) : filtered.map((g) => (
              <tr key={g.name} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3 font-medium">
                  {g.name}
                  {g.trips > 1 && <Badge className="ml-2 bg-indigo-100 text-indigo-700 border-indigo-200 border text-[9px] px-1 py-0 h-4">recorrente</Badge>}
                </td>
                <td className="p-3 tabular-nums">{g.trips}</td>
                <td className="p-3 text-muted-foreground truncate max-w-[280px]">{[...g.vehicles].join(", ")}</td>
                <td className="p-3 whitespace-nowrap">{fmtDate(g.first)}</td>
                <td className="p-3 whitespace-nowrap">{fmtDate(g.last)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
