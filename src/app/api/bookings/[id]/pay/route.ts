import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { balancePaymentIntent, markBalancePaid } from "@/lib/booking-payments";
import { carNameFor, type BookingRecord } from "@/lib/booking-emails";

// The customer's "pay remaining balance" link (/booking/pay?id=…&token=…), used when the
// automatic charge failed or to pay early. The token is the only credential: there are no
// customer accounts, and it is only ever sent to the customer's own email.
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
    status: b.status,
    total: Number(b.estimated_total),
    depositAmount: Number(b.deposit_amount ?? 0),
    balanceAmount: Number(b.balance_amount ?? 0),
    balanceDueDate: b.balance_due_date,
    balanceStatus: b.balance_status,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { token, action } = (await req.json().catch(() => ({}))) as { token?: string; action?: "intent" | "complete" };
  const b = await load(id, token ?? null);
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  if (action === "complete") {
    if (b.balance_payment_intent_id) {
      const pi = await stripe.paymentIntents.retrieve(String(b.balance_payment_intent_id));
      if (pi.status === "succeeded") {
        await markBalancePaid(pi);
        return NextResponse.json({ status: "paid" });
      }
      return NextResponse.json({ status: pi.status });
    }
    return NextResponse.json({ status: b.balance_status });
  }

  if (b.status !== "confirmed" || b.payment_plan !== "deposit_balance") {
    return NextResponse.json({ error: "There is no balance to pay on this booking." }, { status: 409 });
  }
  if (b.balance_status === "paid") return NextResponse.json({ status: "paid" });
  if (b.balance_status === "processing") {
    return NextResponse.json({ error: "A payment for this booking is already being processed. Please check back in a few minutes." }, { status: 409 });
  }
  const pi = await balancePaymentIntent(b);
  if (pi.status === "succeeded") {
    await markBalancePaid(pi);
    return NextResponse.json({ status: "paid" });
  }
  return NextResponse.json({ clientSecret: pi.client_secret, amount: pi.amount / 100 });
}
