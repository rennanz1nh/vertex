// Shared Turo trip handling: parse the two host feeds, link each trip to one of our
// cars, and upsert. Used by the browser-driven sync and the scheduled server pull.
import type { SupabaseClient } from "@supabase/supabase-js";

export type RawTrip = Record<string, unknown>;

function epochToIso(ms: unknown): string | null {
  if (typeof ms !== "number" || !ms) return null;
  return new Date(ms).toISOString();
}

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

function vehicleFields(vehicle: RawTrip) {
  const reg = (vehicle.registration as RawTrip) ?? {};
  const img = (vehicle.image as RawTrip) ?? {};
  return {
    vehicle_make: String(vehicle.make ?? ""),
    vehicle_model: String(vehicle.model ?? ""),
    vehicle_year: Number(vehicle.year) || null,
    vehicle_id: String(vehicle.id ?? ""),
    vehicle_vin: str(vehicle.vin),
    vehicle_license_plate: str(reg.licensePlate),
    vehicle_type: str(vehicle.type),
    vehicle_trim: str(vehicle.trim),
    vehicle_image_url: str(img.originalImageUrl),
  };
}

function locationFields(loc: RawTrip) {
  return {
    location_city: String(loc.city ?? ""),
    location_state: String(loc.state ?? ""),
    location_lat: loc.latitude != null ? Number(loc.latitude) : null,
    location_lng: loc.longitude != null ? Number(loc.longitude) : null,
    location_timezone: str(loc.timeZone),
  };
}

export type TripRow = {
  turo_trip_id: string;
  status: string;
  guest_name: string;
  pickup_date: string | null;
  return_date: string | null;
  earnings_amount: number | null;
  earnings_currency: string;
  renter_id: string | null;
  product_id: string | null;
  raw_data: RawTrip;
  updated_at: string;
} & ReturnType<typeof vehicleFields> & ReturnType<typeof locationFields>;

function parseUpcomingItem(item: RawTrip): TripRow {
  const vehicle = (item.vehicle as RawTrip) ?? {};
  const actor = (item.actor as RawTrip) ?? (item.renter as RawTrip) ?? {};
  const interval = (item.interval as RawTrip) ?? {};
  const start = (interval.start as RawTrip) ?? {};
  const end = (interval.end as RawTrip) ?? {};
  const loc = (item.location as RawTrip) ?? {};
  return {
    turo_trip_id: String(item.reservationId ?? item.id ?? ""),
    status: String(item.tripItemStatus ?? item.statusCode ?? item.status ?? ""),
    guest_name: String(actor.name ?? [actor.firstName, actor.lastName].filter(Boolean).join(" ") ?? ""),
    ...vehicleFields(vehicle),
    pickup_date: epochToIso(start.epochMillis),
    return_date: epochToIso(end.epochMillis),
    earnings_amount: null,
    earnings_currency: "USD",
    ...locationFields(loc),
    renter_id: str(actor.id) ?? (actor.id != null ? String(actor.id) : null),
    product_id: null,
    raw_data: item,
    updated_at: new Date().toISOString(),
  };
}

function parseHistoryTrip(trip: RawTrip): TripRow {
  const interval = (trip.interval as RawTrip) ?? {};
  const start = (interval.start as RawTrip) ?? {};
  const end = (interval.end as RawTrip) ?? {};
  const loc = (trip.location as RawTrip) ?? {};
  const vehicle = (trip.vehicle as RawTrip) ?? {};
  const renter = (trip.renter as RawTrip) ?? (trip.driver as RawTrip) ?? {};
  return {
    turo_trip_id: String(trip.id ?? ""),
    status: String(trip.status ?? trip.statusCode ?? "COMPLETED"),
    guest_name: String(renter.name ?? [renter.firstName, renter.lastName].filter(Boolean).join(" ") ?? ""),
    ...vehicleFields(vehicle),
    pickup_date: epochToIso(start.epochMillis),
    return_date: epochToIso(end.epochMillis),
    earnings_amount: null,
    earnings_currency: "USD",
    ...locationFields(loc),
    renter_id: renter.id != null ? String(renter.id) : null,
    product_id: null,
    raw_data: trip,
    updated_at: new Date().toISOString(),
  };
}

/** Flattens the upcoming + history feeds into de-duplicated trip rows. */
export function collectTrips(upcomingData: unknown, historyData: unknown): TripRow[] {
  const seen = new Set<string>();
  const rows: TripRow[] = [];
  const add = (row: TripRow) => {
    if (!row.turo_trip_id || seen.has(row.turo_trip_id)) return;
    seen.add(row.turo_trip_id);
    rows.push(row);
  };

  if (upcomingData) {
    for (const item of ((upcomingData as RawTrip).upcomingTripItems as RawTrip[]) ?? []) add(parseUpcomingItem(item));
  }
  if (historyData) {
    const history = historyData as RawTrip;
    const feedsList = (
      Array.isArray(history.tripHistoryFeeds)
        ? history.tripHistoryFeeds
        : ((history.tripHistoryFeeds as Record<string, unknown>)?.list ?? [])
    ) as RawTrip[];
    for (const monthGroup of feedsList) {
      for (const trip of (monthGroup.trips as RawTrip[]) ?? []) add(parseHistoryTrip(trip));
    }
  }
  return rows;
}

/**
 * Sets product_id on each row. The explicit link (products.turo_vehicle_ids) wins; the VIN is a
 * fallback, and when a VIN matches a car through a Turo listing id we have not seen before
 * (a relisted car), that id is added to the car's links so the next sync resolves it directly.
 * Returns the Turo vehicle ids that still have no car, so new listings can be surfaced.
 */
export async function linkTrips(supabase: SupabaseClient, rows: TripRow[]): Promise<{ unlinkedVehicleIds: string[] }> {
  const { data } = await supabase.from("products").select("id, vin, turo_vehicle_ids");
  const byVehicle = new Map<string, string>();
  const byVin = new Map<string, string>();
  const links = new Map<string, string[]>();
  for (const p of (data ?? []) as { id: string; vin: string | null; turo_vehicle_ids: string[] | null }[]) {
    const ids = p.turo_vehicle_ids ?? [];
    links.set(p.id, [...ids]);
    for (const id of ids) byVehicle.set(id, p.id);
    if (p.vin?.trim()) byVin.set(p.vin.trim().toLowerCase(), p.id);
  }

  const learned = new Map<string, Set<string>>();
  const unlinked = new Set<string>();
  for (const row of rows) {
    let pid = row.vehicle_id ? byVehicle.get(row.vehicle_id) : undefined;
    if (!pid && row.vehicle_vin) {
      pid = byVin.get(row.vehicle_vin.trim().toLowerCase());
      if (pid && row.vehicle_id) {
        const set = learned.get(pid) ?? new Set<string>();
        set.add(row.vehicle_id);
        learned.set(pid, set);
      }
    }
    row.product_id = pid ?? null;
    if (!pid && row.vehicle_id) unlinked.add(row.vehicle_id);
  }

  for (const [pid, ids] of learned) {
    const merged = [...new Set([...(links.get(pid) ?? []), ...ids])];
    await supabase.from("products").update({ turo_vehicle_ids: merged }).eq("id", pid);
  }
  return { unlinkedVehicleIds: [...unlinked] };
}

export async function upsertTrips(supabase: SupabaseClient, rows: TripRow[]): Promise<{ synced: number; errors: string[] }> {
  let synced = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const { error } = await supabase.from("turo_trips").upsert(row, { onConflict: "turo_trip_id" });
    if (error) errors.push(`upsert ${row.turo_trip_id}: ${error.message}`);
    else synced++;
  }
  return { synced, errors };
}

/**
 * Fills EMPTY car fields from the latest Turo trip of each linked car (plate, transmission,
 * pickup city, VIN). Never overwrites a value that is already there. Note the VIN doubles as
 * the Google Shopping SKU (see google-shopping-feed.ts); filling it for visible cars was
 * explicitly approved by the owner.
 */
export async function fillCarInfoFromTuro(supabase: SupabaseClient, rows: TripRow[]): Promise<number> {
  const latest = new Map<string, TripRow>();
  for (const r of rows) {
    if (!r.product_id) continue;
    const cur = latest.get(r.product_id);
    if (!cur || (r.pickup_date ?? "") > (cur.pickup_date ?? "")) latest.set(r.product_id, r);
  }
  if (!latest.size) return 0;

  const { data } = await supabase
    .from("products")
    .select("id, vin, license_plate, transmission, pickup_city, store_visible")
    .in("id", [...latest.keys()]);

  const empty = (v: unknown) => typeof v !== "string" || v.trim() === "";
  let updated = 0;
  for (const p of (data ?? []) as { id: string; vin: string | null; license_plate: string | null; transmission: string | null; pickup_city: string | null; store_visible: boolean }[]) {
    const r = latest.get(p.id)!;
    const patch: Record<string, string> = {};
    if (empty(p.license_plate) && r.vehicle_license_plate) patch.license_plate = r.vehicle_license_plate;
    if (empty(p.transmission) && (r.raw_data.vehicle as RawTrip | undefined)?.automaticTransmission === true) patch.transmission = "Automatic";
    if (empty(p.pickup_city) && r.location_city) patch.pickup_city = r.location_city;
    if (empty(p.vin) && r.vehicle_vin) patch.vin = r.vehicle_vin.toUpperCase();
    if (Object.keys(patch).length) {
      const { error } = await supabase.from("products").update(patch).eq("id", p.id);
      if (!error) updated++;
    }
  }
  return updated;
}
