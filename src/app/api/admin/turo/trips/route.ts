import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter") ?? "all"; // upcoming | history | all

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } }
  );

  let query = supabase
    .from("turo_trips")
    .select("id, turo_trip_id, status, guest_name, renter_id, vehicle_make, vehicle_model, vehicle_year, vehicle_id, vehicle_vin, vehicle_license_plate, vehicle_type, vehicle_trim, vehicle_image_url, pickup_date, return_date, earnings_amount, earnings_currency, location_city, location_state, location_lat, location_lng, location_timezone, product_id, updated_at")
    .order("pickup_date", { ascending: false });

  const now = new Date().toISOString();
  if (filter === "upcoming") query = query.gte("pickup_date", now);
  else if (filter === "history") query = query.lt("pickup_date", now);

  const { data, error } = await query.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Our own cover photo wins over Turo's listing photo for every linked car, so the Turo
  // screens show the same picture as the site. Turo's stays as the fallback (and in turo_image_url).
  const trips = (data ?? []) as { product_id: string | null; vehicle_image_url: string | null }[];
  const ids = [...new Set(trips.map((t) => t.product_id).filter((id): id is string => !!id))];
  const covers = new Map<string, string>();
  if (ids.length) {
    const { data: cars } = await supabase.from("products").select("id, image_url").in("id", ids);
    for (const c of (cars ?? []) as { id: string; image_url: string | null }[]) {
      if (c.image_url?.trim()) covers.set(c.id, c.image_url);
    }
  }
  const withCovers = trips.map((t) => ({
    ...t,
    turo_image_url: t.vehicle_image_url,
    vehicle_image_url: (t.product_id && covers.get(t.product_id)) || t.vehicle_image_url,
  }));

  return NextResponse.json({ trips: withCovers });
}
