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

// Build Cookie header: if stored value is a full cookie string, use directly;
// otherwise wrap the JWT as access_token=<jwt>
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

function decodeDriverId(accessToken: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString());
    return String(payload.driver_id ?? payload.sub ?? "");
  } catch {
    return null;
  }
}

async function fetchTuroFeed(url: string, stored: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: turoHeaders(stored) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${url}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function tryFetchTrips(stored: string, driverId: string | null): Promise<{ data: Record<string, unknown>[]; errors: string[] }> {
  const errors: string[] = [];
  const results: Record<string, unknown>[] = [];

  const endpoints = [
    // Current / upcoming
    ...(driverId ? [
      `https://turo.com/api/v2/hosts/${driverId}/reservations?page=1&pageSize=50&status=CONFIRMED,ACTIVE`,
      `https://turo.com/api/v2/hosts/${driverId}/reservations?page=1&pageSize=50`,
      `https://turo.com/api/v2/hosts/${driverId}/trips?page=1&pageSize=50`,
    ] : []),
    "https://turo.com/api/v2/feeds/upcoming-trips",
    "https://turo.com/api/v2/feeds/trip-history",
    "https://turo.com/api/me/trips?page=1&pageSize=50",
  ];

  for (const url of endpoints) {
    const data = await fetchTuroFeed(url, stored).catch((e: Error) => {
      errors.push(e.message);
      return null;
    });
    if (!data) continue;

    const items =
      data.trips ?? data.reservations ?? data.events ?? data.items ??
      data.content ?? data.results ?? data.data ?? data;
    const arr = Array.isArray(items) ? items : [];
    if (arr.length > 0) results.push(...arr);
  }

  return { data: results, errors };
}

function parseTrip(trip: Record<string, unknown>) {
  const id = String(trip.id ?? trip.tripId ?? "");
  const status = String(trip.status ?? trip.statusCode ?? "");
  const guest = (trip.driver as Record<string, unknown>) ?? (trip.guest as Record<string, unknown>) ?? {};
  const guestName = String((guest.name as string) ?? (guest.displayName as string) ?? (trip.driverName as string) ?? "");
  const vehicle = (trip.vehicle as Record<string, unknown>) ?? {};
  const vehicleMake = String((vehicle.make as string) ?? "");
  const vehicleModel = String((vehicle.model as string) ?? "");
  const vehicleYear = Number((vehicle.year as number) ?? 0) || null;
  const vehicleId = String((vehicle.id as string) ?? (trip.vehicleId as string) ?? "");

  const pickup = (trip.scheduledPickup as string) ?? (trip.startTime as string) ?? (trip.pickupTime as string) ?? null;
  const ret = (trip.scheduledReturn as string) ?? (trip.endTime as string) ?? (trip.returnTime as string) ?? null;

  const earnings = (trip.hostEarnings as Record<string, unknown>) ?? (trip.earnings as Record<string, unknown>) ?? {};
  const earningsAmount = Number((earnings.amount as number) ?? (trip.earningsAmount as number) ?? 0) || null;
  const earningsCurrency = String((earnings.currency as string) ?? "USD");

  const loc = (trip.location as Record<string, unknown>) ?? (trip.pickupLocation as Record<string, unknown>) ?? {};
  const city = String((loc.city as string) ?? "");
  const state = String((loc.state as string) ?? "");

  return {
    turo_trip_id: id,
    status,
    guest_name: guestName,
    vehicle_make: vehicleMake,
    vehicle_model: vehicleModel,
    vehicle_year: vehicleYear,
    vehicle_id: vehicleId,
    pickup_date: pickup,
    return_date: ret,
    earnings_amount: earningsAmount,
    earnings_currency: earningsCurrency,
    location_city: city,
    location_state: state,
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
  const accessToken = extractAccessToken(stored);
  const driverId = decodeDriverId(accessToken);

  const { data: allTrips, errors } = await tryFetchTrips(stored, driverId);
  let synced = 0;

  const seen = new Set<string>();
  const uniqueTrips = allTrips.filter((t) => {
    const id = String((t as Record<string, unknown>).id ?? (t as Record<string, unknown>).tripId ?? "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  for (const trip of uniqueTrips) {
    try {
      const row = parseTrip(trip as Record<string, unknown>);
      if (!row.turo_trip_id) continue;
      const { error: upsertErr } = await supabase.from("turo_trips").upsert(row, { onConflict: "turo_trip_id" });
      if (!upsertErr) synced++;
    } catch { /* skip malformed */ }
  }

  await supabase
    .from("turo_tokens")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  return NextResponse.json({ ok: true, synced, errors, driverId, totalFetched: allTrips.length });
}
