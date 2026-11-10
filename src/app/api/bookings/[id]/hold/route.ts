import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { holdPaymentIntent, markHoldAuthorized, damageHoldReleaseAtFor } from "@/lib/damage-hold";
import { carNameFor, type BookingRecord } from "@/lib/booking-emails";

// The customer's "authorize the damage-deposit hold" link (/booking/hold?id=…&token=…), sent
// when the hold could not be placed on the saved card. Same token model as /booking/pay.
async function load(id: string, token: string | null): Promise<BookingRecord | null> {
  if (!token) return null;
  const { data } = await supabaseAdmin.from("bookings").select("*").eq("id", id).maybeSingle();
  if (!data || data.payment_token !== token) return null;
  return data as BookingRecord;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await load(id, req.nextUrl.searchParams.get("token"));
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  return NextResponse.json({
    carName: await carNameFor(b.car_id),
    pickupDate: b.pickup_date,
    pickupTime: b.pickup_time,
    returnDate: b.return_date,
    returnTime: b.return_time,
    status: b.status,
    holdAmount: Number(b.damage_hold_amount ?? 0),
    holdStatus: b.damage_hold_status,
    releaseAt: damageHoldReleaseAtFor(b).toISOString(),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { token, action } = (await req.json().catch(() => ({}))) as { token?: string; action?: "intent" | "complete" };
  const b = await load(id, token ?? null);
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (b.damage_hold_status === "held") return NextResponse.json({ status: "held" });

  if (action === "complete") {
    if (b.damage_hold_payment_intent_id) {
      const pi = await stripe.paymentIntents.retrieve(String(b.damage_hold_payment_intent_id), { expand: ["latest_charge"] });
      if (pi.status === "requires_capture") {
        await markHoldAuthorized(pi);
        return NextResponse.json({ status: "held" });
      }
      return NextResponse.json({ status: pi.status });
    }
    return NextResponse.json({ status: b.damage_hold_status });
  }

  if (!["confirmed", "completed"].includes(b.status) || b.damage_hold_status !== "failed") {
    return NextResponse.json({ error: "There is no damage deposit to authorize on this booking right now." }, { status: 409 });
  }
  if (new Date() >= damageHoldReleaseAtFor(b)) {
    return NextResponse.json({ error: "This damage deposit is no longer needed." }, { status: 409 });
  }
  const pi = await holdPaymentIntent(b);
  if (pi.status === "requires_capture") {
    await markHoldAuthorized(pi);
    return NextResponse.json({ status: "held" });
  }
  return NextResponse.json({ clientSecret: pi.client_secret, amount: pi.amount / 100 });
}
