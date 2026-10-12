// Turo analytics: computes operational stats (volume, occupancy, durations, guests)
// from stored trips. Earnings are intentionally omitted — the trip feeds carry no
// money data; that requires the per-reservation receipt endpoint (see probe).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireMasterAdmin } from "@/lib/admin-auth";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } }
  );
}

type Trip = {
  guest_name: string | null;
  vehicle_id: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  product_id: string | null;
  pickup_date: string | null;
  return_date: string | null;
};

const DAY = 86400000;

function durationDays(pickup: string, ret: string): number {
  const d = (new Date(ret).getTime() - new Date(pickup).getTime()) / DAY;
  return Math.max(1, Math.round(d));
}

// Days of [pickup, ret] that fall inside [winStart, winEnd].
function overlapDays(pickup: string, ret: string, winStart: number, winEnd: number): number {
  const s = Math.max(new Date(pickup).getTime(), winStart);
  const e = Math.min(new Date(ret).getTime(), winEnd);
  if (e <= s) return 0;
  return (e - s) / DAY;
}

export async function GET(request: NextRequest) {
  const auth = await requireMasterAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = adminClient();
  const { data, error } = await supabase
    .from("turo_trips")
    .select("guest_name, vehicle_id, vehicle_make, vehicle_model, vehicle_year, product_id, pickup_date, return_date");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count: fleetSize } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true });

  const trips = (data ?? []) as Trip[];
  const now = Date.now();
  const valid = trips.filter(t => t.pickup_date && t.return_date);

  let completed = 0, upcoming = 0, active = 0, totalDuration = 0;
  const vehicles = new Set<string>();
  const guests = new Map<string, number>();
  const perVehicle = new Map<string, { label: string; vehicle_id: string; trips: number; days: number; matched: boolean }>();
  const monthly = new Map<string, number>();

  for (const t of valid) {
    const pickup = t.pickup_date!, ret = t.return_date!;
    const ps = new Date(pickup).getTime(), rs = new Date(ret).getTime();
    if (ps > now) upcoming++;
    else if (rs < now) completed++;
    else active++;

    const dur = durationDays(pickup, ret);
    totalDuration += dur;

    if (t.vehicle_id) vehicles.add(t.vehicle_id);
    const g = (t.guest_name ?? "").trim();
    if (g) guests.set(g, (guests.get(g) ?? 0) + 1);

    const vlabel = [t.vehicle_year, t.vehicle_make, t.vehicle_model].filter(Boolean).join(" ") || "—";
    const vkey = t.vehicle_id ?? vlabel;
    const pv = perVehicle.get(vkey) ?? { label: vlabel, vehicle_id: vkey, trips: 0, days: 0, matched: !!t.product_id };
    pv.trips++;
    pv.days += dur;
    pv.matched = pv.matched || !!t.product_id;
    perVehicle.set(vkey, pv);

    const mkey = pickup.slice(0, 7); // YYYY-MM
    monthly.set(mkey, (monthly.get(mkey) ?? 0) + 1);
  }

  // Occupancy over the last 30 days, across registered (matched) cars only.
  const winEnd = now;
  const winStart = now - 30 * DAY;
  let bookedDays = 0;
  const matchedCarIds = new Set<string>();
  for (const t of valid) {
    if (!t.product_id) continue;
    matchedCarIds.add(t.product_id);
    bookedDays += overlapDays(t.pickup_date!, t.return_date!, winStart, winEnd);
  }
  const occupancyBase = (fleetSize ?? matchedCarIds.size) * 30;
  const occupancy30 = occupancyBase > 0 ? Math.min(1, bookedDays / occupancyBase) : 0;

  // Last 12 months, chronological
  const months: { month: string; trips: number }[] = [];
  const cur = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(cur.getFullYear(), cur.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ month: key, trips: monthly.get(key) ?? 0 });
  }

  const topVehicles = [...perVehicle.values()].sort((a, b) => b.trips - a.trips);
  const topGuests = [...guests.entries()]
    .map(([name, trips]) => ({ name, trips }))
    .sort((a, b) => b.trips - a.trips)
    .slice(0, 10);

  return NextResponse.json({
    summary: {
      totalTrips: valid.length,
      completed,
      upcoming,
      active,
      distinctVehicles: vehicles.size,
      distinctGuests: guests.size,
      avgDurationDays: valid.length ? +(totalDuration / valid.length).toFixed(1) : 0,
      fleetSize: fleetSize ?? 0,
      matchedCars: matchedCarIds.size,
      occupancy30: +(occupancy30 * 100).toFixed(1),
      repeatGuests: topGuests.filter(g => g.trips > 1).length,
    },
    months,
    topVehicles,
    topGuests,
  });
}
