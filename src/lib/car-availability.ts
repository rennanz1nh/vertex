import { supabaseAdmin } from "@/lib/supabase-admin";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TURO_DEFAULT_TZ = "America/New_York";

/** True only when both are well-formed ISO dates and returnDate is strictly after pickupDate. */
export function isValidDateRange(pickupDate?: string, returnDate?: string): boolean {
  if (!pickupDate || !returnDate) return false;
  if (!ISO_DATE.test(pickupDate) || !ISO_DATE.test(returnDate)) return false;
  return returnDate > pickupDate;
}

/** Calendar date (YYYY-MM-DD) of an instant in the given IANA timezone. */
function localDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/**
 * Car ids that are busy anywhere in [pickupDate, returnDate), from either source:
 *  - our own active (non-cancelled) bookings, and
 *  - Turo trips linked to the car (turo_trips.product_id) that are not cancelled.
 * Same day-granularity overlap the admin Calendar/Dashboard timeline already uses (a car
 * returned the morning of day X can be picked up again that same day). Turo trips are stored
 * as instants, so they are converted to calendar dates in the trip's own timezone first.
 * Runs server-side only, with the service role: the storefront never gets direct read access
 * to bookings, which hold renter PII, just this yes/no availability signal for the dates it
 * asked about. Turo data is only as fresh as the last sync.
 */
export async function getUnavailableCarIds(pickupDate: string, returnDate: string): Promise<Set<string>> {
  const unavailable = new Set<string>();

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("car_id")
    .neq("status", "cancelled")
    .lt("pickup_date", returnDate)
    .gt("return_date", pickupDate);

  if (error) {
    console.error("getUnavailableCarIds failed:", error);
  } else {
    for (const b of data || []) unavailable.add(b.car_id as string);
  }

  // Widen the instant window by a day each side, then decide on exact local dates below.
  const lo = new Date(`${pickupDate}T00:00:00Z`);
  lo.setUTCDate(lo.getUTCDate() - 1);
  const hi = new Date(`${returnDate}T00:00:00Z`);
  hi.setUTCDate(hi.getUTCDate() + 1);

  const { data: turo, error: turoError } = await supabaseAdmin
    .from("turo_trips")
    .select("product_id, pickup_date, return_date, location_timezone, status")
    .not("product_id", "is", null)
    .not("status", "ilike", "%cancel%")
    .lt("pickup_date", hi.toISOString())
    .gt("return_date", lo.toISOString());

  if (turoError) {
    console.error("getUnavailableCarIds (turo) failed:", turoError);
  } else {
    for (const t of turo || []) {
      if (!t.pickup_date || !t.return_date) continue;
      const tz = t.location_timezone || TURO_DEFAULT_TZ;
      if (localDate(t.pickup_date, tz) < returnDate && localDate(t.return_date, tz) > pickupDate) {
        unavailable.add(t.product_id as string);
      }
    }
  }

  return unavailable;
}
