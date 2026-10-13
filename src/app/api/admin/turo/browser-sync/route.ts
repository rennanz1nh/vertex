// Receives pre-fetched Turo trip data from the browser (which can call turo.com
// directly using the user's own cookies) and stores it in Supabase.
// Accepts either JWT admin auth OR a one-time sync token (X-Sync-Token header)
// so a console script running on turo.com can POST here cross-origin.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireMasterAdmin } from "@/lib/admin-auth";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://turo.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Sync-Token, X-Sync-Key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } }
  );
}

type RawTrip = Record<string, unknown>;

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

type TripRow = {
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

async function verifySyncToken(supabase: ReturnType<typeof adminClient>, token: string): Promise<string | null> {
  const { data } = await supabase
    .from("turo_tokens")
    .select("id, sync_token, sync_token_expires_at")
    .eq("sync_token", token)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  if (!data.sync_token_expires_at) return null;
  if (new Date(data.sync_token_expires_at as string) < new Date()) return null;
  return data.id as string;
}

// Permanent sync key (UUID stored in DB): no expiry, used for bookmarklet
async function verifySyncKey(supabase: ReturnType<typeof adminClient>, key: string): Promise<string | null> {
  const { data } = await supabase
    .from("turo_tokens")
    .select("id, sync_key")
    .eq("sync_key", key)
    .limit(1)
    .maybeSingle();
  return data ? (data.id as string) : null;
}

export async function POST(request: NextRequest) {
  const supabase = adminClient();
  let tokenRowId: string | null = null;

  // Check permanent sync key first (bookmarklet)
  const syncKey = request.headers.get("X-Sync-Key");
  if (syncKey) {
    tokenRowId = await verifySyncKey(supabase, syncKey);
    if (!tokenRowId) {
      return new NextResponse(
        JSON.stringify({ error: "Sync key inválida" }),
        { status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }
  } else {
    // Check one-time sync token (console script fallback)
    const syncToken = request.headers.get("X-Sync-Token");
    if (syncToken) {
      tokenRowId = await verifySyncToken(supabase, syncToken);
      if (!tokenRowId) {
        return new NextResponse(
          JSON.stringify({ error: "Sync token inválido ou expirado" }),
          { status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      }
      // Invalidate the one-time token
      await supabase
        .from("turo_tokens")
        .update({ sync_token: null, sync_token_expires_at: null })
        .eq("id", tokenRowId);
    }
  }

  if (!syncKey && !request.headers.get("X-Sync-Token")) {
    // Fall back to admin JWT auth (for browser-side fetch from our domain)
    const auth = await requireMasterAdmin(request);
    if (!auth.ok) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }
  }

  const body = await request.json() as {
    upcomingData?: unknown; historyData?: unknown; probe?: unknown;
    earnings?: unknown; reviews?: unknown; feedback?: unknown; payout?: unknown;
  };
  const errors: string[] = [];
  const seen = new Set<string>();
  const rows: TripRow[] = [];

  if (body.upcomingData) {
    const upcoming = body.upcomingData as RawTrip;
    for (const item of (upcoming.upcomingTripItems as RawTrip[]) ?? []) {
      const row = parseUpcomingItem(item);
      if (!row.turo_trip_id || seen.has(row.turo_trip_id)) continue;
      seen.add(row.turo_trip_id);
      rows.push(row);
    }
  }

  if (body.historyData) {
    const history = body.historyData as RawTrip;
    const feedsList = (
      Array.isArray(history.tripHistoryFeeds)
        ? history.tripHistoryFeeds
        : ((history.tripHistoryFeeds as Record<string, unknown>)?.list ?? [])
    ) as RawTrip[];
    for (const monthGroup of feedsList) {
      for (const trip of (monthGroup.trips as RawTrip[]) ?? []) {
        const row = parseHistoryTrip(trip);
        if (!row.turo_trip_id || seen.has(row.turo_trip_id)) continue;
        seen.add(row.turo_trip_id);
        rows.push(row);
      }
    }
  }

  // Auto-match each trip to a registered car by VIN (case-insensitive)
  const vins = [...new Set(rows.map(r => r.vehicle_vin).filter((v): v is string => !!v))];
  if (vins.length) {
    const { data: products } = await supabase
      .from("products")
      .select("id, vin")
      .not("vin", "is", null);
    const vinToId = new Map<string, string>();
    for (const p of (products ?? []) as { id: string; vin: string | null }[]) {
      if (p.vin) vinToId.set(p.vin.toLowerCase(), p.id);
    }
    for (const row of rows) {
      if (row.vehicle_vin) row.product_id = vinToId.get(row.vehicle_vin.toLowerCase()) ?? null;
    }
  }

  let synced = 0;
  for (const row of rows) {
    const { error: upsertErr } = await supabase
      .from("turo_trips")
      .upsert(row, { onConflict: "turo_trip_id" });
    if (!upsertErr) synced++;
    else errors.push(`upsert ${row.turo_trip_id}: ${upsertErr.message}`);
  }

  // Update last_synced_at on the token row
  const rowId = tokenRowId ?? (await supabase
    .from("turo_tokens")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .then(r => r.data?.id as string | null));

  if (rowId) {
    const update: Record<string, unknown> = { last_synced_at: new Date().toISOString() };
    if (body.probe) update.probe_data = body.probe;
    if (body.earnings !== undefined) update.earnings_data = body.earnings;
    if (body.reviews !== undefined) update.reviews_data = body.reviews;
    if (body.feedback !== undefined) update.feedback_data = body.feedback;
    if (body.payout !== undefined) update.payout_data = body.payout;
    if (body.earnings !== undefined || body.reviews !== undefined || body.feedback !== undefined || body.payout !== undefined) {
      update.host_data_synced_at = new Date().toISOString();
    }
    await supabase.from("turo_tokens").update(update).eq("id", rowId);
  }

  return new NextResponse(
    JSON.stringify({ ok: true, synced, errors, totalFetched: rows.length }),
    { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
  );
}
