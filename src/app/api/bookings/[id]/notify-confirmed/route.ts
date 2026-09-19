import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { sendAutomaticEmail } from "@/lib/automatic-emails";
import { PROTECTION_PLANS, EXTRAS, tripDays, type ProtectionPlanId, type ExtraId } from "@/lib/tripDraft";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } }
  );
}

function formatUsDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Called by the admin Reservas panel right after a booking's status is saved as
// "confirmed" — i.e. once the admin has confirmed payment came through (Stripe isn't
// wired up for bookings yet, so that confirmation currently happens outside the app).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const supabase = getSupabase();

  const { data: booking, error } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const email = booking.customer_email as string | null;
  if (!email) return NextResponse.json({ ok: true, skipped: true });

  const { data: car } = await supabase
    .from("products")
    .select("name, make, model, year")
    .eq("id", booking.car_id as string)
    .maybeSingle();
  const carName =
    car?.name || [car?.year, car?.make, car?.model].filter(Boolean).join(" ") || "your vehicle";

  const plan = PROTECTION_PLANS.find((p) => p.id === (booking.protection_plan as ProtectionPlanId));
  const extraIds = Array.isArray(booking.extras) ? (booking.extras as ExtraId[]) : [];
  const extrasList = extraIds.length
    ? extraIds.map((extraId) => EXTRAS.find((e) => e.id === extraId)?.name).filter(Boolean).join(", ")
    : "None";
  const days = tripDays({ pickupDate: booking.pickup_date as string, returnDate: booking.return_date as string });
  const customerName = (booking.customer_name as string | null) || (booking.driver_full_name as string | null) || "there";

  await sendAutomaticEmail(
    "booking_confirmed",
    { email, name: customerName },
    {
      customer_name: customerName,
      confirmation_number: (booking.id as string).slice(0, 8).toUpperCase(),
      car_name: carName,
      pickup_date: formatUsDate(booking.pickup_date as string),
      pickup_time: booking.pickup_time as string,
      return_date: formatUsDate(booking.return_date as string),
      return_time: booking.return_time as string,
      days: String(days),
      protection_plan: plan?.name || (booking.protection_plan as string),
      extras_list: extrasList,
      estimated_total: `$${Number(booking.estimated_total).toFixed(2)}`,
    }
  );

  return NextResponse.json({ ok: true });
}
