import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

/** One Stripe payment on a booking and how much of it can still be refunded (in cents). */
export type RefundablePayment = { kind: "deposit" | "balance"; paymentIntentId: string; refundableCents: number };

type RefundBooking = {
  id: string;
  status: string;
  deposit_payment_intent_id: string | null;
  balance_payment_intent_id: string | null;
  balance_status: string | null;
  refunded_amount: number | string | null;
};

export type RefundResult =
  | { ok: true; refundedCents: number; refundIds: string[]; fullyRefunded: boolean }
  | { ok: false; reason: string };

async function refundable(kind: RefundablePayment["kind"], piId: string | null): Promise<RefundablePayment | null> {
  if (!piId) return null;
  const pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
  if (pi.status !== "succeeded") return null;
  const charge = pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  const left = (pi.amount_received ?? 0) - (charge?.amount_refunded ?? 0);
  return left > 0 ? { kind, paymentIntentId: pi.id, refundableCents: left } : null;
}

const SELECT = "id, status, deposit_payment_intent_id, balance_payment_intent_id, balance_status, refunded_amount";

async function loadBooking(id: string): Promise<RefundBooking | null> {
  const { data } = await supabaseAdmin.from("bookings").select(SELECT).eq("id", id).maybeSingle();
  return data as RefundBooking | null;
}

/** Everything still refundable on a booking (balance first, then deposit), read live from Stripe. */
export async function refundablePayments(bookingId: string): Promise<RefundablePayment[] | null> {
  const b = await loadBooking(bookingId);
  if (!b) return null;
  const list = await Promise.all([
    refundable("balance", b.balance_status === "paid" ? b.balance_payment_intent_id : null),
    refundable("deposit", b.deposit_payment_intent_id),
  ]);
  return list.filter((p): p is RefundablePayment => !!p);
}

/**
 * Refunds a website booking through Stripe. `amountCents` omitted = everything left.
 * The balance payment is refunded first, then the deposit. A full refund also cancels the
 * booking and any balance still scheduled, so the cron never charges it afterwards.
 * The $99 damage hold is separate (an authorization, not a charge) and is not touched.
 */
export async function refundBooking(bookingId: string, opts: { amountCents?: number; note?: string } = {}): Promise<RefundResult> {
  const b = await loadBooking(bookingId);
  if (!b) return { ok: false, reason: "Reserva não encontrada." };
  const payments = (await refundablePayments(bookingId)) ?? [];
  const available = payments.reduce((s, p) => s + p.refundableCents, 0);
  if (available <= 0) return { ok: false, reason: "Nada a reembolsar: esta reserva não tem pagamento no Stripe, ou já foi todo reembolsado." };

  const want = opts.amountCents ?? available;
  if (!Number.isInteger(want) || want <= 0) return { ok: false, reason: "Valor inválido." };
  if (want > available) return { ok: false, reason: `O máximo reembolsável é $${(available / 100).toFixed(2)}.` };

  let left = want;
  const refundIds: string[] = [];
  for (const p of payments) {
    if (left <= 0) break;
    const cents = Math.min(left, p.refundableCents);
    // Key includes what was refundable, so a double-click returns the same refund instead
    // of refunding twice, while a later, separate partial refund gets a fresh key.
    const refund = await stripe.refunds.create(
      { payment_intent: p.paymentIntentId, amount: cents, metadata: { booking_id: b.id, part: p.kind } },
      { idempotencyKey: `booking-refund-${b.id}-${p.paymentIntentId}-${p.refundableCents}-${cents}` }
    );
    refundIds.push(refund.id);
    left -= cents;
  }

  const fullyRefunded = want === available;
  const update: Record<string, unknown> = {
    refunded_amount: (Math.round(Number(b.refunded_amount ?? 0) * 100) + want) / 100,
    refunded_at: new Date().toISOString(),
    ...(opts.note ? { refund_note: opts.note.slice(0, 500) } : {}),
  };
  if (fullyRefunded) {
    update.status = "cancelled";
    if (b.balance_status === "scheduled" || b.balance_status === "failed") update.balance_status = "none";
  }
  await supabaseAdmin.from("bookings").update(update).eq("id", b.id);
  return { ok: true, refundedCents: want, refundIds, fullyRefunded };
}
