// Turo guests as first-class records (vertex.turo_guests), rebuilt from what the Turo sync
// already stores: trips (turo_trips.raw_data.renter), receipts (turo_receipts) and the
// reviews guests left us (turo_tokens.reviews_data). Turo never shares a guest's email,
// phone or address with hosts, so those live in our own our_* columns, which the sync
// never touches.
import type { SupabaseClient } from "@supabase/supabase-js";

type Json = Record<string, unknown>;

export type GuestTripInput = {
  id: string;
  turo_trip_id: string;
  renter_id: string | null;
  guest_name: string | null;
  status: string;
  pickup_date: string | null;
  return_date: string | null;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  location_city: string | null;
  raw_data: Json | null;
};

export type GuestReceiptInput = {
  reservation_id: string;
  trip_total: number | string | null;
  host_earned: number | string | null;
  data: Json | null;
};

export type GuestReviewInput = {
  authorId?: string | number | null;
  author?: Json | null;
  overallRating?: number | null;
  text?: string | null;
  created?: string | number | null;
  reservationId?: string | number | null;
};

export type GuestTripSummary = {
  tripRowId: string;
  reservationId: string;
  car: string;
  start: string | null;
  end: string | null;
  status: string;
  total: number | null;
  earned: number | null;
  city: string | null;
};

export type GuestRecord = {
  renter_id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  profile_url: string | null;
  image_url: string | null;
  photo_verified: boolean | null;
  trips_count: number;
  cancelled_count: number;
  upcoming_count: number;
  first_trip_at: string | null;
  last_trip_at: string | null;
  total_days: number;
  total_spent: number;
  host_earned: number;
  reimbursements: number;
  miles_driven: number | null;
  reviews_count: number;
  avg_rating: number | null;
  last_review_text: string | null;
  last_review_at: string | null;
  cars: string[];
  trips: GuestTripSummary[];
  reviews: { rating: number | null; text: string | null; at: string | null; reservationId: string | null }[];
  updated_at: string;
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/** "$323.32" → 323.32, "- $35.93" → -35.93. */
export function parseMoney(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return null;
  const n = parseFloat(v.replace(/[^0-9.]/g, ""));
  if (Number.isNaN(n)) return null;
  return /^\s*-/.test(v) ? -n : n;
}

/**
 * Miles the guest actually drove: the receipt's "Miles driven" line. The other distance
 * lines ("Distance included", "Excess miles") are the allowance and the overage, not usage.
 */
export function milesFromReceipt(data: Json | null): number | null {
  const items = (data?.tripDistanceLineItems as Json[] | undefined) ?? [];
  const driven = items.find((i) => /driven|traveled|travelled/i.test(String(i.label ?? "")));
  const m = driven ? String(driven.value ?? "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*mi/i) : null;
  return m ? Math.round(Number(m[1])) : null;
}

/** Tolls, fuel, cleaning… billed to the guest after the trip. */
export function reimbursementsFromReceipt(data: Json | null): number {
  const total = parseMoney((data?.reimbursementTotalLineItem as Json | undefined)?.value);
  return total != null ? Math.abs(total) : 0;
}

function bestImage(img: Json | undefined): { url: string | null; verified: boolean | null } {
  if (!img || img.placeholder === true) return { url: null, verified: null };
  const thumbs = (img.thumbnails as Record<string, string> | undefined) ?? {};
  // Thumbnail keys look like "225x225"; take the biggest, else the original.
  const biggest = Object.entries(thumbs)
    .map(([k, v]) => ({ size: Number(k.split("x")[0]) || 0, v }))
    .sort((a, b) => b.size - a.size)[0]?.v;
  return { url: str(img.originalImageUrl) ?? biggest ?? null, verified: typeof img.verified === "boolean" ? img.verified : null };
}

function toIsoDate(v: unknown): string | null {
  if (typeof v === "number") return new Date(v).toISOString();
  if (typeof v === "string" && v) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

/** Pure: groups trips by Turo renter id and folds in receipts and reviews. */
export function buildGuests(
  trips: GuestTripInput[],
  receipts: GuestReceiptInput[],
  reviews: GuestReviewInput[],
  now: Date = new Date(),
): GuestRecord[] {
  const receiptById = new Map(receipts.map((r) => [String(r.reservation_id), r]));
  const reviewsByAuthor = new Map<string, GuestReviewInput[]>();
  for (const r of reviews) {
    const id = r.authorId ?? (r.author?.id as string | number | undefined);
    if (id == null) continue;
    const list = reviewsByAuthor.get(String(id)) ?? [];
    list.push(r);
    reviewsByAuthor.set(String(id), list);
  }

  const guests = new Map<string, GuestRecord & { _miles: number; _hasMiles: boolean }>();
  for (const t of trips) {
    const renter = ((t.raw_data?.renter ?? t.raw_data?.actor) as Json | undefined) ?? {};
    const renterId = t.renter_id ?? (renter.id != null ? String(renter.id) : null);
    if (!renterId) continue;

    let g = guests.get(renterId);
    if (!g) {
      const img = bestImage(renter.image as Json | undefined);
      const url = str(renter.url);
      g = {
        renter_id: renterId,
        name: str(renter.name) ?? str(t.guest_name) ?? "Hóspede Turo",
        first_name: str(renter.firstName),
        last_name: str(renter.lastName),
        profile_url: url ? (url.startsWith("http") ? url : `https://turo.com${url}`) : null,
        image_url: img.url,
        photo_verified: img.verified,
        trips_count: 0,
        cancelled_count: 0,
        upcoming_count: 0,
        first_trip_at: null,
        last_trip_at: null,
        total_days: 0,
        total_spent: 0,
        host_earned: 0,
        reimbursements: 0,
        miles_driven: null,
        reviews_count: 0,
        avg_rating: null,
        last_review_text: null,
        last_review_at: null,
        cars: [],
        trips: [],
        reviews: [],
        updated_at: now.toISOString(),
        _miles: 0,
        _hasMiles: false,
      };
      guests.set(renterId, g);
    } else if (!g.image_url) {
      const img = bestImage(renter.image as Json | undefined);
      if (img.url) { g.image_url = img.url; g.photo_verified = img.verified; }
    }

    const receipt = receiptById.get(String(t.turo_trip_id));
    const car = [t.vehicle_year, t.vehicle_make, t.vehicle_model].filter(Boolean).join(" ") || "Carro";
    const cancelled = /cancel/i.test(t.status);
    const total = receipt ? num(receipt.trip_total) : null;
    const earned = receipt ? num(receipt.host_earned) : null;
    g.trips.push({
      tripRowId: t.id,
      reservationId: String(t.turo_trip_id),
      car,
      start: t.pickup_date,
      end: t.return_date,
      status: t.status || (t.pickup_date && new Date(t.pickup_date) > now ? "UPCOMING" : ""),
      total,
      earned,
      city: str(t.location_city),
    });

    if (cancelled) {
      g.cancelled_count += 1;
      continue;
    }
    g.trips_count += 1;
    if (t.pickup_date && new Date(t.pickup_date) > now) g.upcoming_count += 1;
    if (t.pickup_date && (!g.first_trip_at || t.pickup_date < g.first_trip_at)) g.first_trip_at = t.pickup_date;
    if (t.pickup_date && (!g.last_trip_at || t.pickup_date > g.last_trip_at)) g.last_trip_at = t.pickup_date;
    if (t.pickup_date && t.return_date) {
      g.total_days += Math.max(1, Math.round((new Date(t.return_date).getTime() - new Date(t.pickup_date).getTime()) / 86_400_000));
    }
    if (!g.cars.includes(car)) g.cars.push(car);
    if (total != null) g.total_spent += total;
    if (earned != null) g.host_earned += earned;
    if (receipt) {
      g.reimbursements += reimbursementsFromReceipt(receipt.data);
      const miles = milesFromReceipt(receipt.data);
      if (miles != null) { g._miles += miles; g._hasMiles = true; }
    }
  }

  return [...guests.values()].map(({ _miles, _hasMiles, ...g }) => {
    const theirReviews = (reviewsByAuthor.get(g.renter_id) ?? [])
      .map((r) => ({
        rating: num(r.overallRating),
        text: str(r.text),
        at: toIsoDate(r.created),
        reservationId: r.reservationId != null ? String(r.reservationId) : null,
      }))
      .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
    const ratings = theirReviews.map((r) => r.rating).filter((n): n is number => n != null);
    return {
      ...g,
      total_spent: round2(g.total_spent),
      host_earned: round2(g.host_earned),
      reimbursements: round2(g.reimbursements),
      miles_driven: _hasMiles ? _miles : null,
      trips: g.trips.sort((a, b) => (b.start ?? "").localeCompare(a.start ?? "")),
      reviews: theirReviews,
      reviews_count: theirReviews.length,
      avg_rating: ratings.length ? round2(ratings.reduce((s, n) => s + n, 0) / ratings.length) : null,
      last_review_text: theirReviews.find((r) => r.text)?.text ?? null,
      last_review_at: theirReviews[0]?.at ?? null,
    };
  });
}

export const GUEST_PHOTO_BUCKET = "vertex-turo-guest-photos";

/** Copies guest photos from Turo's CDN into our storage, a few per run. Never throws. */
async function mirrorPhotos(supabase: SupabaseClient, limit = 40): Promise<number> {
  const { data } = await supabase
    .from("turo_guests")
    .select("renter_id, image_url, photo_source_url")
    .not("image_url", "is", null)
    .limit(500);
  const todo = ((data ?? []) as { renter_id: string; image_url: string; photo_source_url: string | null }[])
    .filter((g) => g.photo_source_url !== g.image_url)
    .slice(0, limit);
  let copied = 0;
  for (const g of todo) {
    try {
      const res = await fetch(g.image_url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      const type = res.headers.get("content-type") || "image/jpeg";
      if (!type.startsWith("image/")) continue;
      const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
      const path = `${g.renter_id}.${ext}`;
      const { error } = await supabase.storage
        .from(GUEST_PHOTO_BUCKET)
        .upload(path, await res.arrayBuffer(), { contentType: type, upsert: true });
      if (error) continue;
      await supabase.from("turo_guests").update({ photo_path: path, photo_source_url: g.image_url }).eq("renter_id", g.renter_id);
      copied++;
    } catch {
      // Turo's CDN unreachable for this one: the page falls back to image_url.
    }
  }
  return copied;
}

/**
 * Rebuilds every guest from the stored Turo data and saves it (our_* columns untouched),
 * then mirrors photos. `profiles` are raw public Turo profiles fetched by the browser sync.
 */
export async function refreshTuroGuests(
  supabase: SupabaseClient,
  profiles: { renterId: string; data: unknown }[] = [],
): Promise<{ guests: number; photos: number; profiles: number }> {
  const [{ data: trips }, { data: receipts }, { data: tokens }] = await Promise.all([
    supabase
      .from("turo_trips")
      .select("id, turo_trip_id, renter_id, guest_name, status, pickup_date, return_date, vehicle_year, vehicle_make, vehicle_model, location_city, raw_data"),
    supabase.from("turo_receipts").select("reservation_id, trip_total, host_earned, data"),
    supabase.from("turo_tokens").select("reviews_data"),
  ]);
  const reviews = ((tokens ?? []) as { reviews_data: Json | null }[]).flatMap(
    (t) => ((t.reviews_data?.items as GuestReviewInput[] | undefined) ?? []),
  );
  const guests = buildGuests((trips ?? []) as GuestTripInput[], (receipts ?? []) as GuestReceiptInput[], reviews);

  for (let i = 0; i < guests.length; i += 100) {
    const { error } = await supabase.from("turo_guests").upsert(guests.slice(i, i + 100), { onConflict: "renter_id" });
    if (error) console.error("turo_guests upsert failed", error.message);
  }

  let savedProfiles = 0;
  for (const p of profiles) {
    if (!p?.renterId || !p.data) continue;
    const { error } = await supabase
      .from("turo_guests")
      .update({ profile_data: p.data, profile_synced_at: new Date().toISOString() })
      .eq("renter_id", String(p.renterId));
    if (!error) savedProfiles++;
  }

  const photos = await mirrorPhotos(supabase);
  return { guests: guests.length, photos, profiles: savedProfiles };
}
