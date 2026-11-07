import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { applyDepositSucceeded } from "@/lib/booking-payments";

// Called by the checkout right after the card is confirmed (and by the return page after a
// 3-D Secure redirect), so the booking is confirmed without waiting for the Stripe webhook.
// The webhook does the same; whichever lands first wins, the other is a no-op.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const { data: b } = await supabaseAdmin
    .from("bookings")
    .select("id, status, deposit_payment_intent_id, deposit_paid_at, payment_token")
    .eq("id", id)
    .maybeSingle();
  if (!b || b.payment_token !== token) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (b.deposit_paid_at) return NextResponse.json({ status: "confirmed" });
  if (!b.deposit_payment_intent_id) return NextResponse.json({ status: b.status });

  const pi = await stripe.paymentIntents.retrieve(b.deposit_payment_intent_id);
  if (pi.status === "succeeded") {
    await applyDepositSucceeded(pi);
    return NextResponse.json({ status: "confirmed" });
  }
  return NextResponse.json({ status: pi.status });
}
