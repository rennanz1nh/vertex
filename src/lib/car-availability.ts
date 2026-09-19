import { supabaseAdmin } from "@/lib/supabase-admin";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True only when both are well-formed ISO dates and returnDate is strictly after pickupDate. */
export function isValidDateRange(pickupDate?: string, returnDate?: string): boolean {
  if (!pickupDate || !returnDate) return false;
  if (!ISO_DATE.test(pickupDate) || !ISO_DATE.test(returnDate)) return false;
  return returnDate > pickupDate;
}

/**
 * Car ids with an active (non-cancelled) booking that overlaps [pickupDate, returnDate) —
 * same day-granularity overlap the admin Calendar/Dashboard timeline already uses (a car
 * returned the morning of day X can be picked up again that same day). Runs server-side
 * only, with the service role: the storefront never gets direct read access to bookings,
 * which hold renter PII, just this yes/no availability signal for the dates it asked about.
 */
export async function getUnavailableCarIds(pickupDate: string, returnDate: string): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("car_id")
    .neq("status", "cancelled")
    .lt("pickup_date", returnDate)
    .gt("return_date", pickupDate);

  if (error) {
    console.error("getUnavailableCarIds failed:", error);
    return new Set();
  }
  return new Set((data || []).map((b) => b.car_id as string));
}
