import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendBookingConfirmedEmail, type BookingRecord } from "@/lib/booking-emails";

// Called by the admin Reservas panel right after a booking's status is saved as
// "confirmed". Storefront bookings already get this email when the customer pays at
// checkout; this covers bookings entered or confirmed by hand in the admin.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const { data: booking, error } = await supabaseAdmin.from("bookings").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (!booking.customer_email) return NextResponse.json({ ok: true, skipped: true });

  await sendBookingConfirmedEmail(booking as BookingRecord);
  return NextResponse.json({ ok: true });
}
