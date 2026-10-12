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

// Cloudflare cookies are browser-specific and don't transfer to server-side requests.
// We strip them and rely solely on the access_token JWT for server calls.
function buildServerCookie(stored: string): string {
  const accessToken = extractAccessToken(stored);
  // Keep only non-Cloudflare Turo cookies
  const allowed = ["access_token", "JSESSIONID", "td_dv_uid", "rr_u_cid", "SPRING_SECURITY_REMEMBER_ME_COOKIE", "refresh_token"];
  const parts: string[] = [`access_token=${accessToken}`];
  for (const name of allowed.slice(1)) {
    const m = stored.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    if (m) parts.push(`${name}=${m[1]}`);
  }
  return parts.join("; ");
}

function turoHeaders(stored: string) {
  const accessToken = extractAccessToken(stored);
  return {
    Cookie: buildServerCookie(stored),
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

function isTokenExpiredOrSoon(accessToken: string, marginSeconds = 300): boolean {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString());
    const exp = Number(payload.exp ?? 0);
    return exp === 0 || Date.now() / 1000 > exp - marginSeconds;
  } catch {
    return true;
  }
}

function replaceCookieValue(cookieStr: string, name: string, newValue: string): string {
  const regex = new RegExp(`(^|;\\s*)${name}=[^;]*`, "g");
  if (regex.test(cookieStr)) {
    return cookieStr.replace(new RegExp(`(^|;\\s*)${name}=[^;]*`), `$1${name}=${newValue}`);
  }
  return `${cookieStr}; ${name}=${newValue}`;
}

// Uses refresh_token (valid 1 year) to get a new access_token without user interaction.
// Returns the updated cookie string to store, or null on failure.
async function refreshAccessToken(stored: string): Promise<string | null> {
  const refreshMatch = stored.match(/refresh_token=([^;]+)/);
  if (!refreshMatch) return null;
  const refreshToken = refreshMatch[1].trim();

  const res = await fetch("https://turo.com/api/v2/token", {
    method: "POST",
    headers: {
      Cookie: stored,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
      Referer: "https://turo.com/us/en/host",
      Origin: "https://turo.com",
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&client_id=web`,
  });

  // Parse Set-Cookie headers for new values
  // Node 18+ supports getSetCookie(); fall back to get('set-cookie')
  const setCookies: string[] = (res.headers as { getSetCookie?: () => string[] }).getSetCookie?.()
    ?? res.headers.get("set-cookie")?.split(/,\s*(?=[a-zA-Z_-]+=)/) ?? [];

  let updated = stored;
  for (const sc of setCookies) {
    const m = sc.match(/^([^=]+)=([^;]*)/);
    if (!m) continue;
    const [, name, value] = m;
    if (["access_token", "__cf_bm", "JSESSIONID"].includes(name) && value) {
      updated = replaceCookieValue(updated, name, value);
    }
  }

  // Verify we got a new non-empty access_token
  const newToken = extractAccessToken(updated);
  if (!newToken || isTokenExpiredOrSoon(newToken, 60)) return null;

  return updated;
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
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tokenErr) return NextResponse.json({ error: tokenErr.message }, { status: 500 });
  if (!tokenRow) return NextResponse.json({ error: "Turo não está conectado" }, { status: 400 });

  let stored = tokenRow.bearer_token;
  const errors: string[] = [];
  let tokenRefreshed = false;

  // Auto-refresh access_token if expired or expiring within 5 min
  const currentAccess = extractAccessToken(stored);
  if (isTokenExpiredOrSoon(currentAccess)) {
    const refreshed = await refreshAccessToken(stored).catch((e: Error) => {
      errors.push(`refresh: ${e.message}`);
      return null;
    });
    if (refreshed) {
      stored = refreshed;
      tokenRefreshed = true;
      // Persist the refreshed token to DB so next call benefits too
      await supabase
        .from("turo_tokens")
        .update({ bearer_token: stored, updated_at: new Date().toISOString() })
        .eq("id", tokenRow.id);
    } else {
      errors.push("Token expirado e refresh falhou — cole os cookies novamente no painel.");
    }
  }

  const seen = new Set<string>();
  const rows: ReturnType<typeof parseUpcomingItem>[] = [];

  // Fetch upcoming trips
  const upcomingData = await fetchJson(
    "https://turo.com/api/v2/feeds/upcoming-trips?appMode=HOST",
    stored
  ).catch((e: Error) => { errors.push(e.message); return null; });

  if (upcomingData) {
    for (const item of (upcomingData.upcomingTripItems as RawTrip[]) ?? []) {
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
        : ((historyData.tripHistoryFeeds as Record<string, unknown>)?.list ?? [])
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

  await supabase
    .from("turo_tokens")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  return NextResponse.json({ ok: true, synced, errors, totalFetched: rows.length, tokenRefreshed });
}
