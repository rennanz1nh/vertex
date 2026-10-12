// Receives pre-fetched Turo trip data from the browser (which can call turo.com
// directly using the user's own cookies) and stores it in Supabase.
// Accepts either JWT admin auth OR a one-time sync token (X-Sync-Token header)
// so a console script running on turo.com can POST here cross-origin.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://turo.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Sync-Token",
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

function parseUpcomingItem(item: RawTrip) {
  const vehicle = (item.vehicle as RawTrip) ?? {};
  const actor = (item.actor as RawTrip) ?? {};
  const interval = (item.interval as RawTrip) ?? {};
  const start = (interval.start as RawTrip) ?? {};
  const end = (interval.end as RawTrip) ?? {};
  const loc = (item.location as RawTrip) ?? {};
  return {
    turo_trip_id: String(item.reservationId ?? ""),
    status: String(item.tripItemStatus ?? ""),
    guest_name: String(actor.name ?? ""),
    vehicle_make: String(vehicle.make ?? ""),
    vehicle_model: String(vehicle.model ?? ""),
    vehicle_year: Number(vehicle.year) || null,
    vehicle_id: String(vehicle.id ?? ""),
    pickup_date: epochToIso(start.epochMillis),
    return_date: epochToIso(end.epochMillis),
    earnings_amount: null as number | null,
    earnings_currency: "USD",
    location_city: String(loc.city ?? ""),
    location_state: String(loc.state ?? ""),
    raw_data: item,
    updated_at: new Date().toISOString(),
  };
}

function parseHistoryTrip(trip: RawTrip) {
  const interval = (trip.interval as RawTrip) ?? {};
  const start = (interval.start as RawTrip) ?? {};
  const end = (interval.end as RawTrip) ?? {};
  const loc = (trip.location as RawTrip) ?? {};
  const vehicle = (trip.vehicle as RawTrip) ?? {};
  const driver = (trip.driver as RawTrip) ?? {};
  return {
    turo_trip_id: String(trip.id ?? ""),
    status: String(trip.status ?? trip.statusCode ?? "COMPLETED"),
    guest_name: String((driver.name as string) ?? (driver.displayName as string) ?? ""),
    vehicle_make: String(vehicle.make ?? ""),
    vehicle_model: String(vehicle.model ?? ""),
    vehicle_year: Number(vehicle.year) || null,
    vehicle_id: String(vehicle.id ?? (trip.vehicleId as string) ?? ""),
    pickup_date: epochToIso(start.epochMillis),
    return_date: epochToIso(end.epochMillis),
    earnings_amount: null as number | null,
    earnings_currency: "USD",
    location_city: String((loc.city as string) ?? ""),
    location_state: String((loc.state as string) ?? ""),
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

export async function POST(request: NextRequest) {
  const supabase = adminClient();
  let tokenRowId: string | null = null;

  // Check sync token first (for console script on turo.com)
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
  } else {
    // Fall back to admin JWT auth (for browser-side fetch from our domain)
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }
  }

  const body = await request.json() as { upcomingData?: unknown; historyData?: unknown };
  const errors: string[] = [];
  const seen = new Set<string>();
  const rows: ReturnType<typeof parseUpcomingItem>[] = [];

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
    await supabase
      .from("turo_tokens")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", rowId);
  }

  return new NextResponse(
    JSON.stringify({ ok: true, synced, errors, totalFetched: rows.length }),
    { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
  );
}
