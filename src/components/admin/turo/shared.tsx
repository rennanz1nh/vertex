import { Badge } from "@/components/ui/badge";

export interface TuroConfig {
  id: string;
  host_id: string | null;
  host_name: string | null;
  last_synced_at: string | null;
  updated_at: string;
  sync_key: string | null;
  probe_data?: unknown;
}

export interface TuroTrip {
  id: string;
  turo_trip_id: string;
  status: string;
  guest_name: string;
  renter_id: string | null;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number | null;
  vehicle_id: string;
  vehicle_vin: string | null;
  vehicle_license_plate: string | null;
  vehicle_type: string | null;
  vehicle_trim: string | null;
  vehicle_image_url: string | null;
  pickup_date: string | null;
  return_date: string | null;
  earnings_amount: number | null;
  earnings_currency: string;
  location_city: string;
  location_state: string;
  location_lat: number | null;
  location_lng: number | null;
  location_timezone: string | null;
  product_id: string | null;
  updated_at: string;
}

export interface TuroStats {
  summary: {
    totalTrips: number;
    completed: number;
    upcoming: number;
    active: number;
    distinctVehicles: number;
    distinctGuests: number;
    avgDurationDays: number;
    fleetSize: number;
    matchedCars: number;
    occupancy30: number;
    repeatGuests: number;
  };
  months: { month: string; trips: number }[];
  topVehicles: { label: string; vehicle_id: string; trips: number; days: number; matched: boolean }[];
  topGuests: { name: string; trips: number }[];
}

export const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export function monthLabel(key: string) {
  const [, m] = key.split("-");
  return MONTH_ABBR[Number(m) - 1] ?? key;
}

export function vehicleLabel(t: Pick<TuroTrip, "vehicle_year" | "vehicle_make" | "vehicle_model">) {
  return [t.vehicle_year, t.vehicle_make, t.vehicle_model].filter(Boolean).join(" ") || "—";
}

export function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function durationDays(pickup: string | null, ret: string | null): number {
  if (!pickup || !ret) return 0;
  const d = (new Date(ret).getTime() - new Date(pickup).getTime()) / 86400000;
  return Math.max(1, Math.round(d));
}

// Maps Turo's status codes to a pt-BR label + badge style. Unknown codes render raw.
export function statusMeta(status: string): { label: string; cls: string } {
  const s = (status || "").toUpperCase();
  if (s === "" ) return { label: "—", cls: "bg-gray-100 text-gray-500 border-gray-200" };
  if (s.includes("CANCEL")) return { label: "Cancelado", cls: "bg-red-100 text-red-700 border-red-200" };
  if (s.includes("COMPLETE") || s === "ENDED" || s.includes("PAST")) return { label: "Concluído", cls: "bg-gray-100 text-gray-600 border-gray-200" };
  if (s.includes("IN_PROGRESS") || s.includes("ACTIVE") || s.includes("ONGOING")) return { label: "Em andamento", cls: "bg-green-100 text-green-800 border-green-200" };
  if (s === "STARTS_TODAY") return { label: "Começa hoje", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" };
  if (s === "ENDED_TODAY") return { label: "Termina hoje", cls: "bg-amber-100 text-amber-800 border-amber-200" };
  if (s.includes("BOOK") || s.includes("UPCOMING") || s.includes("RESERVED") || s.includes("SCHEDULED")) return { label: "Reservado", cls: "bg-blue-100 text-blue-800 border-blue-200" };
  return { label: status, cls: "bg-slate-100 text-slate-700 border-slate-200" };
}

export function StatusBadge({ status }: { status: string }) {
  const m = statusMeta(status);
  return <Badge className={`${m.cls} border font-medium`}>{m.label}</Badge>;
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}
