import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } }
  );
}

async function fetchTuroFeed(url: string, token: string) {
  // Turo uses cookie-based auth internally — send the access_token both as Bearer
  // header and as a cookie (same value), which covers both auth paths their API accepts.
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Cookie: `access_token=${token}`,
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
      "turo-country": "US",
      Referer: "https://turo.com/",
      Origin: "https://turo.com",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Turo API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function parseTrip(trip: Record<string, unknown>) {
  // Normalize fields from Turo's internal API shape
  const id = String(trip.id ?? trip.tripId ?? "");
  const status = String(trip.status ?? trip.statusCode ?? "");
  const guest = (trip.driver as Record<string, unknown>) ?? (trip.guest as Record<string, unknown>) ?? {};
  const guestName = String((guest.name as string) ?? (guest.displayName as string) ?? (trip.driverName as string) ?? "");
  const vehicle = (trip.vehicle as Record<string, unknown>) ?? {};
  const vehicleMake = String((vehicle.make as string) ?? "");
  const vehicleModel = String((vehicle.model as string) ?? "");
  const vehicleYear = Number((vehicle.year as number) ?? 0) || null;
  const vehicleId = String((vehicle.id as string) ?? (trip.vehicleId as string) ?? "");

  // Dates
  const pickup = (trip.scheduledPickup as string) ?? (trip.startTime as string) ?? (trip.pickupTime as string) ?? null;
  const ret = (trip.scheduledReturn as string) ?? (trip.endTime as string) ?? (trip.returnTime as string) ?? null;

  // Earnings — host payout info
  const earnings = (trip.hostEarnings as Record<string, unknown>) ?? (trip.earnings as Record<string, unknown>) ?? {};
  const earningsAmount = Number((earnings.amount as number) ?? (trip.earningsAmount as number) ?? 0) || null;
  const earningsCurrency = String((earnings.currency as string) ?? "USD");

  // Location
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

  // Get token
  const { data: tokenRow } = await supabase.from("turo_tokens").select("bearer_token, id").limit(1).maybeSingle();
  if (!tokenRow) return NextResponse.json({ error: "Turo não está conectado" }, { status: 400 });

  const token = tokenRow.bearer_token;
  const errors: string[] = [];
  let synced = 0;

  // Fetch upcoming trips
  const upcomingData = await fetchTuroFeed(
    "https://turo.com/api/v2/feeds/upcoming-trips",
    token
  ).catch((e: Error) => { errors.push(`upcoming: ${e.message}`); return null; });

  // Fetch trip history
  const historyData = await fetchTuroFeed(
    "https://turo.com/api/v2/feeds/trip-history",
    token
  ).catch((e: Error) => { errors.push(`history: ${e.message}`); return null; });

  const allTrips: Record<string, unknown>[] = [];

  if (upcomingData) {
    const items = upcomingData.events ?? upcomingData.trips ?? upcomingData.items ?? upcomingData ?? [];
    const arr = Array.isArray(items) ? items : [];
    allTrips.push(...arr);
  }

  if (historyData) {
    const items = historyData.events ?? historyData.trips ?? historyData.items ?? historyData ?? [];
    const arr = Array.isArray(items) ? items : [];
    allTrips.push(...arr);
  }

  // Deduplicate by trip id
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
      await supabase.from("turo_trips").upsert(row, { onConflict: "turo_trip_id" });
      synced++;
    } catch {
      // skip malformed trips
    }
  }

  // Update last synced timestamp
  await supabase.from("turo_tokens").update({ last_synced_at: new Date().toISOString() }).eq("id", tokenRow.id);

  return NextResponse.json({ ok: true, synced, errors });
}
