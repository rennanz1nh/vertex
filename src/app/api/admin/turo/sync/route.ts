import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { extractAccessToken } from "@/app/api/admin/turo/config/route";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } }
  );
}

function buildCookieHeader(stored: string): string {
  if (stored.includes("access_token=")) return stored;
  return `access_token=${stored}`;
}

function turoHeaders(stored: string) {
  const accessToken = extractAccessToken(stored);
  return {
    Cookie: buildCookieHeader(stored),
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "turo-country": "US",
    Referer: "https://turo.com/us/en/host",
    Origin: "https://turo.com",
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    "sec-ch-ua": '"Chromium";v="137", "Not/A)Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
  };
}

async function fetchJson(url: string, stored: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: turoHeaders(stored) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${url}: ${body.slice(0, 300)}`);
  }
  return res.json();
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

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = adminClient();

  const { data: tokenRow, error: tokenErr } = await supabase
    .from("turo_tokens")
    .select("bearer_token, id")
    .limit(1)
    .maybeSingle();

  if (tokenErr) return NextResponse.json({ error: tokenErr.message }, { status: 500 });
  if (!tokenRow) return NextResponse.json({ error: "Turo não está conectado" }, { status: 400 });

  const stored = tokenRow.bearer_token;
  const errors: string[] = [];
  const seen = new Set<string>();
  const rows: ReturnType<typeof parseUpcomingItem>[] = [];

  // Fetch upcoming trips
  const upcomingData = await fetchJson(
    "https://turo.com/api/v2/feeds/upcoming-trips?appMode=HOST",
    stored
  ).catch((e: Error) => { errors.push(e.message); return null; });

  if (upcomingData) {
    const items = (upcomingData.upcomingTripItems as RawTrip[]) ?? [];
    for (const item of items) {
      const row = parseUpcomingItem(item);
      if (!row.turo_trip_id || seen.has(row.turo_trip_id)) continue;
      seen.add(row.turo_trip_id);
      rows.push(row);
    }
  }

  // Fetch trip history
  const historyData = await fetchJson(
    "https://turo.com/api/v2/feeds/trip-history?driverRoles=HOST",
    stored
  ).catch((e: Error) => { errors.push(e.message); return null; });

  if (historyData) {
    const feedsList = (
      Array.isArray(historyData.tripHistoryFeeds)
        ? historyData.tripHistoryFeeds
        : (historyData.tripHistoryFeeds as Record<string, unknown>)?.list ?? []
    ) as RawTrip[];

    for (const monthGroup of feedsList) {
      const trips = (monthGroup.trips as RawTrip[]) ?? [];
      for (const trip of trips) {
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

  await supabase
    .from("turo_tokens")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  return NextResponse.json({ ok: true, synced, errors, totalFetched: rows.length });
}
