import { Badge } from "@/components/ui/badge";

export interface TuroConfig {
  id: string;
  host_id: string | null;
  host_name: string | null;
  last_synced_at: string | null;
  updated_at: string;
  sync_key: string | null;
  probe_data?: unknown;
  host_data_synced_at?: string | null;
  auto_sync_at?: string | null;
  auto_sync_ok?: boolean | null;
  auto_sync_message?: string | null;
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

type FinEntry = { amount?: number; vehicleId?: number | null; earningsType?: string; reservation?: { reservationId?: number } | null };
export type FinanceIndex = { byReservation: Map<string, number>; byVehicle: Map<string, number> };

// Builds lookup maps from the stored earnings so any tab can show real revenue:
// reservationId -> amount (per-trip $) and vehicleId -> total revenue (per-car $).
export function buildFinanceIndex(extras: TuroExtras | null): FinanceIndex {
  const byReservation = new Map<string, number>();
  const byVehicle = new Map<string, number>();
  const earnings = extras?.earnings as { years?: Record<string, { ownerEarningsList?: FinEntry[] }> } | undefined;
  for (const y of Object.values(earnings?.years ?? {})) {
    for (const e of y.ownerEarningsList ?? []) {
      if (e.earningsType === "DIRECT_DEPOSIT_PAYMENT") continue;
      const amt = typeof e.amount === "number" ? e.amount : 0;
      const rid = e.reservation?.reservationId;
      if (rid != null) byReservation.set(String(rid), (byReservation.get(String(rid)) ?? 0) + amt);
      if (e.vehicleId != null) byVehicle.set(String(e.vehicleId), (byVehicle.get(String(e.vehicleId)) ?? 0) + amt);
    }
  }
  return { byReservation, byVehicle };
}

export function fmtMoney(amount: number | null | undefined, currency = "USD"): string {
  if (amount == null || isNaN(amount)) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function epochToDate(ms: unknown): string {
  if (typeof ms !== "number" || !ms) return "—";
  return new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
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

export type ReceiptSummary = { trip_total: number | null; turo_fee: number | null; host_earned: number | null };

export interface TuroExtras {
  receipts?: Record<string, ReceiptSummary>;
  earnings: unknown;
  reviews: unknown;
  feedback: unknown;
  payout: unknown;
  syncedAt: string | null;
}

function renderScalar(v: unknown): React.ReactNode {
  if (v === null || v === undefined || v === "") return <span className="text-muted-foreground">—</span>;
  if (typeof v === "object") return <span className="text-muted-foreground">{Array.isArray(v) ? `[${(v as unknown[]).length}]` : "{…}"}</span>;
  if (typeof v === "boolean") return v ? "sim" : "não";
  return String(v);
}

// Faithfully renders arbitrary JSON: objects as key/value rows, arrays of objects
// as tables, scalars inline. Shows real Turo data without assuming a schema.
export function JsonView({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground text-sm">—</span>;
  if (typeof value !== "object") return <span className="text-sm break-words">{String(value)}</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground text-sm">vazio</span>;
    const objs = value.filter((v) => v && typeof v === "object" && !Array.isArray(v)) as Record<string, unknown>[];
    if (objs.length === value.length) {
      const cols = [...new Set(objs.flatMap((o) => Object.keys(o)))].slice(0, 12);
      return (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 text-left">{cols.map((c) => <th key={c} className="p-1.5 font-medium border-b whitespace-nowrap">{c}</th>)}</tr>
            </thead>
            <tbody>
              {value.slice(0, 200).map((o, i) => (
                <tr key={i} className="border-b last:border-0">
                  {cols.map((c) => <td key={c} className="p-1.5 align-top">{renderScalar((o as Record<string, unknown>)[c])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return <span className="text-sm">{value.map((v) => String(v)).join(", ")}</span>;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return <span className="text-muted-foreground text-sm">vazio</span>;
  return (
    <div className={depth > 0 ? "pl-3 border-l space-y-0.5" : "space-y-0.5"}>
      {entries.map(([k, v]) => (
        <div key={k} className="py-1 border-b last:border-0 text-sm">
          <span className="text-muted-foreground">{k}: </span>
          {v && typeof v === "object"
            ? <div className="mt-1">{<JsonView value={v} depth={depth + 1} />}</div>
            : <span className="font-medium break-words">{renderScalar(v)}</span>}
        </div>
      ))}
    </div>
  );
}

export function EmptyExtra({ label }: { label: string }) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <p>{label} ainda não capturado.</p>
      <p className="text-sm mt-1">Rode uma sincronização na aba <strong>Sincronização</strong> para preencher.</p>
    </div>
  );
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
