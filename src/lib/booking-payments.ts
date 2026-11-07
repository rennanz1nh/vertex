// Stripe side of storefront bookings: the deposit (or full amount) is paid on-session at
// checkout with the card saved to a Stripe Customer; the balance is charged off-session to
// that saved card on balance_due_date by /api/cron/booking-payments. Every state change is
// a conditional update, so the webhook, the checkout's own finalize call and the cron can
// all run on the same booking without double-charging or double-emailing.
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { businessToday, formatUsd, toCents } from "@/lib/booking-payment-plan";
import { sendBalanceFailedEmail, sendBookingConfirmedEmail, carNameFor, type BookingRecord } from "@/lib/booking-emails";
import { sendBookingAlerts } from "@/lib/booking-alerts";

/** Unpaid checkout attempts hold the car's dates this long before being released. */
export const PENDING_DEPOSIT_TTL_MINUTES = 30;
/** Minimum gap between automatic retries of a failed balance charge. */
const RETRY_AFTER_HOURS = 20;

export type PaymentKind = "deposit" | "full" | "balance";

export async function getOrCreateStripeCustomer(email: string, name: string, phone?: string): Promise<string> {
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data[0]) return existing.data[0].id;
  const created = await stripe.customers.create({ email, name, phone: phone || undefined, metadata: { source: "vertex-booking" } });
  return created.id;
}

function paymentMethodId(pi: Stripe.PaymentIntent): string | null {
  return typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id ?? null;
}

async function loadBooking(id: string): Promise<BookingRecord | null> {
  const { data } = await supabaseAdmin.from("bookings").select("*").eq("id", id).maybeSingle();
  return (data as BookingRecord | null) ?? null;
}

/**
 * Deposit/full payment went through: confirm the booking, keep the card for the balance,
 * schedule the balance and send the confirmation email. Safe to call more than once.
 */
export async function applyDepositSucceeded(pi: Stripe.PaymentIntent): Promise<BookingRecord | null> {
  if (pi.status !== "succeeded") return null;
  const { data: current } = await supabaseAdmin
    .from("bookings")
    .select("id, payment_plan, balance_amount")
    .eq("deposit_payment_intent_id", pi.id)
    .maybeSingle();
  if (!current) return null;

  const scheduleBalance = current.payment_plan === "deposit_balance" && Number(current.balance_amount) > 0;
  const { data: updated } = await supabaseAdmin
    .from("bookings")
    .update({
      status: "confirmed",
      deposit_paid_at: new Date().toISOString(),
      stripe_payment_method_id: paymentMethodId(pi),
      balance_status: scheduleBalance ? "scheduled" : "none",
    })
    .eq("id", current.id)
    .is("deposit_paid_at", null)
    .select("*")
    .maybeSingle();

  if (updated) {
    // Only the call that actually flipped the row sends the emails: the customer's
    // confirmation and the business alert (email + SMS + push).
    await Promise.all([sendBookingConfirmedEmail(updated as BookingRecord), sendBookingAlerts(updated as BookingRecord)]);
    return updated as BookingRecord;
  }
  return loadBooking(current.id);
}

/** Balance paid (off-session by the cron, or by the customer on the pay page). Idempotent. */
export async function markBalancePaid(pi: Stripe.PaymentIntent): Promise<void> {
  const bookingId = pi.metadata?.booking_id;
  if (!bookingId || pi.status !== "succeeded") return;
  await supabaseAdmin
    .from("bookings")
    .update({
      balance_status: "paid",
      balance_paid_at: new Date().toISOString(),
      balance_payment_intent_id: pi.id,
      balance_last_error: null,
      stripe_payment_method_id: paymentMethodId(pi),
    })
    .eq("id", bookingId)
    .neq("balance_status", "paid");
}

function friendlyDecline(err: unknown): string {
  const e = err as { code?: string; decline_code?: string; message?: string };
  if (e?.code === "authentication_required") return "your bank asked to confirm the payment";
  if (e?.decline_code === "insufficient_funds") return "insufficient funds";
  if (e?.code === "expired_card") return "the card has expired";
  if (e?.code === "card_declined") return "your card was declined";
  return "the payment could not be completed";
}

export type ChargeResult = { ok: true } | { ok: false; reason: string; skipped?: boolean };

/**
 * Charges the balance to the saved card, off-session. `force` (admin "charge now") skips
 * the due-date and retry-spacing checks. Failure: marks the booking, notifies the admin
 * bell and emails the customer a link to pay with another card.
 */
export async function chargeBalance(bookingId: string, { force = false } = {}): Promise<ChargeResult> {
  const b = await loadBooking(bookingId);
  if (!b) return { ok: false, reason: "booking not found", skipped: true };
  if (b.status !== "confirmed" || b.payment_plan !== "deposit_balance") return { ok: false, reason: "not a confirmed deposit booking", skipped: true };
  if (!["scheduled", "failed"].includes(String(b.balance_status))) return { ok: false, reason: `balance is ${b.balance_status}`, skipped: true };
  const amount = Number(b.balance_amount ?? 0);
  if (amount <= 0) return { ok: false, reason: "no balance", skipped: true };
  if (!force) {
    if (!b.balance_due_date || b.balance_due_date > businessToday()) return { ok: false, reason: "not due yet", skipped: true };
    const last = b.balance_last_attempt_at ? new Date(String(b.balance_last_attempt_at)).getTime() : 0;
    if (Date.now() - last < RETRY_AFTER_HOURS * 3_600_000) return { ok: false, reason: "retried recently", skipped: true };
  }

  // The customer may have paid through their pay link and the webhook not landed yet.
  if (b.balance_payment_intent_id) {
    const prev = await stripe.paymentIntents.retrieve(String(b.balance_payment_intent_id)).catch(() => null);
    if (prev?.status === "succeeded") {
      await markBalancePaid(prev);
      return { ok: true };
    }
    if (prev?.status === "processing") return { ok: false, reason: "a payment is processing", skipped: true };
  }

  // Claim the row so two runs can never charge the same balance at once.
  const attempt = Number(b.balance_attempts ?? 0) + 1;
  const { data: claimed } = await supabaseAdmin
    .from("bookings")
    .update({ balance_status: "processing", balance_attempts: attempt, balance_last_attempt_at: new Date().toISOString() })
    .eq("id", b.id)
    .in("balance_status", ["scheduled", "failed"])
    .select("id")
    .maybeSingle();
  if (!claimed) return { ok: false, reason: "already being charged", skipped: true };

  if (!b.stripe_customer_id || !b.stripe_payment_method_id) {
    await recordBalanceFailure(b, "no saved card", null);
    return { ok: false, reason: "no saved card" };
  }

  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount: toCents(amount),
        currency: "usd",
        customer: String(b.stripe_customer_id),
        payment_method: String(b.stripe_payment_method_id),
        off_session: true,
        confirm: true,
        description: `Remaining balance · ${await carNameFor(b.car_id)} · ${b.pickup_date}`,
        receipt_email: b.customer_email || undefined,
        metadata: { booking_id: b.id, kind: "balance" satisfies PaymentKind },
      },
      { idempotencyKey: `balance-${b.id}-${attempt}` },
    );
    if (pi.status === "succeeded") {
      await markBalancePaid(pi);
      return { ok: true };
    }
    await recordBalanceFailure(b, pi.status === "requires_action" ? "your bank asked to confirm the payment" : `payment ${pi.status}`, pi.id);
    return { ok: false, reason: pi.status };
  } catch (err) {
    const piId = (err as { payment_intent?: { id?: string } })?.payment_intent?.id ?? null;
    const reason = friendlyDecline(err);
    await recordBalanceFailure(b, reason, piId, (err as Error)?.message);
    return { ok: false, reason };
  }
}

async function recordBalanceFailure(b: BookingRecord, reason: string, piId: string | null, detail?: string) {
  await supabaseAdmin
    .from("bookings")
    .update({
      balance_status: "failed",
      balance_last_error: detail ? `${reason} (${detail})`.slice(0, 500) : reason,
      ...(piId ? { balance_payment_intent_id: piId } : {}),
    })
    .eq("id", b.id);
  await supabaseAdmin.from("admin_notifications").insert({
    type: "payment_failed",
    title: "Cobrança do saldo falhou",
    message: `${await carNameFor(b.car_id)} · ${b.customer_name || b.customer_email || ""} · ${formatUsd(Number(b.balance_amount ?? 0))} · ${reason}`,
    link: "/admin/bookings",
  });
  await sendBalanceFailedEmail(b, reason);
}

/**
 * Releases cars held by checkouts that were never paid. Checks Stripe first, so a payment
 * that did succeed (webhook missed, tab closed) confirms the booking instead.
 */
export async function expireUnpaidCheckouts(): Promise<{ confirmed: number; released: number }> {
  const cutoff = new Date(Date.now() - PENDING_DEPOSIT_TTL_MINUTES * 60_000).toISOString();
  const { data } = await supabaseAdmin
    .from("bookings")
    .select("id, deposit_payment_intent_id")
    .eq("status", "pending_payment")
    .not("deposit_payment_intent_id", "is", null)
    .is("deposit_paid_at", null)
    .lt("created_at", cutoff);
  let confirmed = 0;
  let released = 0;
  for (const row of (data ?? []) as { id: string; deposit_payment_intent_id: string }[]) {
    try {
      const pi = await stripe.paymentIntents.retrieve(row.deposit_payment_intent_id);
      if (pi.status === "succeeded") {
        await applyDepositSucceeded(pi);
        confirmed++;
        continue;
      }
      if (pi.status === "processing") continue; // still settling; look again next run
      if (pi.status !== "canceled") await stripe.paymentIntents.cancel(pi.id).catch(() => null);
      await supabaseAdmin.from("bookings").update({ status: "cancelled", notes: "Checkout não pago — liberado automaticamente." }).eq("id", row.id).eq("status", "pending_payment");
      released++;
    } catch (err) {
      console.error("expireUnpaidCheckouts failed for", row.id, err);
    }
  }
  return { confirmed, released };
}

/** Every balance that is due today (or failed and is due for a retry). */
export async function chargeDueBalances(): Promise<{ charged: number; failed: number }> {
  const { data } = await supabaseAdmin
    .from("bookings")
    .select("id")
    .eq("status", "confirmed")
    .eq("payment_plan", "deposit_balance")
    .in("balance_status", ["scheduled", "failed"])
    .lte("balance_due_date", businessToday());
  let charged = 0;
  let failed = 0;
  for (const row of (data ?? []) as { id: string }[]) {
    const r = await chargeBalance(row.id);
    if (r.ok) charged++;
    else if (!("skipped" in r && r.skipped)) failed++;
  }
  return { charged, failed };
}

/**
 * For the customer's pay page: a PaymentIntent for the outstanding balance. Reuses the
 * last failed off-session attempt when possible (Stripe lets it be retried on-session).
 */
export async function balancePaymentIntent(b: BookingRecord): Promise<Stripe.PaymentIntent> {
  const amount = toCents(Number(b.balance_amount ?? 0));
  if (b.balance_payment_intent_id) {
    const prev = await stripe.paymentIntents.retrieve(String(b.balance_payment_intent_id));
    if (prev.amount === amount && ["requires_payment_method", "requires_confirmation", "requires_action"].includes(prev.status)) return prev;
    if (prev.status === "succeeded") return prev;
  }
  const pi = await stripe.paymentIntents.create({
    amount,
    currency: "usd",
    customer: b.stripe_customer_id ? String(b.stripe_customer_id) : undefined,
    setup_future_usage: "off_session",
    payment_method_types: ["card"],
    description: `Remaining balance · ${await carNameFor(b.car_id)} · ${b.pickup_date}`,
    receipt_email: b.customer_email || undefined,
    metadata: { booking_id: b.id, kind: "balance" satisfies PaymentKind },
  });
  await supabaseAdmin.from("bookings").update({ balance_payment_intent_id: pi.id }).eq("id", b.id);
  return pi;
}
