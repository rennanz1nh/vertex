// The refundable $99 damage deposit on storefront bookings, as a card authorization (hold):
//
//   checkout      nothing charged; damage_hold_amount is stored and, once the booking is paid,
//                 damage_hold_status = 'scheduled' (the card is already saved off-session).
//   pick-up day   the hourly cron places the hold off-session (capture_method: manual).
//                 Declined → 'failed': admin alerted, customer emailed a link to authorize it.
//   car out       a card authorization only lives ~7 days (up to ~30 with extended
//                 authorization, requested when available), so the cron places a fresh hold
//                 before the current one lapses while the car is still out.
//   returned      admin clicks "Carro devolvido" (returned_at); 3 days later the cron cancels
//                 the hold and the money is back on the customer's card. Nobody clicked →
//                 3 days after the scheduled return.
//   damage        admin "Cobrar dano" captures up to the held amount before the release; the
//                 rest of the hold is released by Stripe at capture.
//
// Every state change is a conditional update on damage_hold_status (claim 'processing'
// first), so the cron, the admin buttons and the customer's link can race without
// double-holding, double-charging or releasing a hold that is being charged.
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { DAMAGE_HOLD_AMOUNT, businessToday, damageHoldReleaseAt, formatUsd, shortRange, toCents } from "@/lib/booking-payment-plan";
import { notifyPush } from "@/lib/notify";
import { carNameFor, sendHoldFailedEmail, type BookingRecord } from "@/lib/booking-emails";

export type DamageHoldStatus = "none" | "scheduled" | "processing" | "held" | "failed" | "released" | "captured";

/** Minimum gap between automatic retries of a declined hold. */
const RETRY_AFTER_HOURS = 20;
/** Place the replacement hold this long before the current one lapses. */
const RENEW_BEFORE_HOURS = 36;
/** A 'processing' row older than this was left by a crashed run and is reconciled. */
const STUCK_AFTER_MINUTES = 15;
/** Card authorizations without extended authorization last 7 days. */
const DEFAULT_HOLD_DAYS = 7;

export type HoldResult = { ok: true; status?: DamageHoldStatus } | { ok: false; reason: string; skipped?: boolean };

async function load(id: string): Promise<BookingRecord | null> {
  const { data } = await supabaseAdmin.from("bookings").select("*").eq("id", id).maybeSingle();
  return (data as BookingRecord | null) ?? null;
}

function holdAmount(b: BookingRecord): number {
  return Number(b.damage_hold_amount ?? 0);
}

function releaseAt(b: BookingRecord): Date {
  return damageHoldReleaseAt({ returned_at: (b.returned_at as string | null) ?? null, return_date: b.return_date, return_time: b.return_time });
}

/** The hold is placed from the start of pick-up day (business time zone). */
function pickupDayStarted(b: BookingRecord, now: Date): boolean {
  return b.pickup_date <= businessToday(now);
}

function chargeOf(pi: Stripe.PaymentIntent): Stripe.Charge | null {
  return pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
}

function expiresAtOf(pi: Stripe.PaymentIntent): string {
  const before = chargeOf(pi)?.payment_method_details?.card?.capture_before;
  const ms = before ? before * 1000 : pi.created * 1000 + DEFAULT_HOLD_DAYS * 86_400_000;
  return new Date(ms).toISOString();
}

function paymentMethodId(pi: Stripe.PaymentIntent): string | null {
  return typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id ?? null;
}

function friendlyDecline(err: unknown): string {
  const e = err as { code?: string; decline_code?: string };
  if (e?.code === "authentication_required") return "your bank asked to confirm the payment";
  if (e?.decline_code === "insufficient_funds") return "insufficient funds";
  if (e?.code === "expired_card") return "the card has expired";
  if (e?.code === "card_declined") return "your card was declined";
  return "the authorization could not be completed";
}

function description(carName: string, b: BookingRecord): string {
  return `Refundable damage deposit (hold) · ${carName} · ${shortRange(b.pickup_date, b.return_date)}`;
}

/**
 * Creates a manual-capture PaymentIntent, asking for extended authorization (car rentals can
 * hold up to ~30 days). Accounts without that feature reject the option, so it is retried
 * without it.
 */
async function createHoldIntent(params: Stripe.PaymentIntentCreateParams, idempotencyKey: string): Promise<Stripe.PaymentIntent> {
  const withExtended: Stripe.PaymentIntentCreateParams = {
    ...params,
    capture_method: "manual",
    payment_method_types: ["card"],
    payment_method_options: { card: { request_extended_authorization: "if_available" } },
    expand: ["latest_charge"],
  };
  try {
    return await stripe.paymentIntents.create(withExtended, { idempotencyKey: `${idempotencyKey}-ext` });
  } catch (err) {
    const e = err as { type?: string; param?: string; message?: string };
    const aboutExtended = e?.type === "StripeInvalidRequestError" && /extended_authorization/.test(`${e.param ?? ""} ${e.message ?? ""}`);
    if (!aboutExtended) throw err;
    const plain: Stripe.PaymentIntentCreateParams = { ...withExtended };
    delete plain.payment_method_options;
    return stripe.paymentIntents.create(plain, { idempotencyKey });
  }
}

/** Records an authorized hold (from the cron, the customer's link or the webhook). Idempotent. */
export async function markHoldAuthorized(pi: Stripe.PaymentIntent): Promise<boolean> {
  const bookingId = pi.metadata?.booking_id;
  if (!bookingId || pi.metadata?.kind !== "damage_hold" || pi.status !== "requires_capture") return false;
  const full = chargeOf(pi) ? pi : await stripe.paymentIntents.retrieve(pi.id, { expand: ["latest_charge"] });
  const { data } = await supabaseAdmin
    .from("bookings")
    .update({
      damage_hold_status: "held",
      damage_hold_payment_intent_id: pi.id,
      damage_hold_authorized_at: new Date().toISOString(),
      damage_hold_expires_at: expiresAtOf(full),
      damage_hold_last_error: null,
      ...(paymentMethodId(pi) ? { stripe_payment_method_id: paymentMethodId(pi) } : {}),
    })
    .eq("id", bookingId)
    .in("damage_hold_status", ["scheduled", "processing", "failed"])
    .select("id")
    .maybeSingle();
  return !!data;
}

async function recordFailure(b: BookingRecord, reason: string, piId: string | null, detail?: string): Promise<void> {
  const firstFailure = b.damage_hold_status !== "failed";
  await supabaseAdmin
    .from("bookings")
    .update({
      damage_hold_status: "failed",
      damage_hold_last_error: detail ? `${reason} (${detail})`.slice(0, 500) : reason,
      ...(piId ? { damage_hold_payment_intent_id: piId } : {}),
    })
    .eq("id", b.id);
  // Alert once per failure streak (retries run every ~20h until the release date).
  if (!firstFailure) return;
  const carName = await carNameFor(b.car_id);
  const customer = b.customer_name || b.customer_email || "";
  const amount = formatUsd(holdAmount(b));
  await supabaseAdmin.from("admin_notifications").insert({
    type: "payment_failed",
    title: "Caução de dano não bloqueou",
    message: `${carName} · ${customer} · ${amount} · ${reason}`,
    link: "/admin/bookings",
  });
  await Promise.all([
    sendHoldFailedEmail(b, reason),
    notifyPush("booking_hold_failed", { car: carName, customer, amount, reason }, { priority: "high" }),
  ]);
}

/**
 * Places the hold on the saved card, off-session. Runs from pick-up day until the release
 * date; `force` (admin "Tentar de novo") skips the pick-up-day and retry-spacing checks.
 */
export async function placeHold(bookingId: string, { force = false, now = new Date() } = {}): Promise<HoldResult> {
  const b = await load(bookingId);
  if (!b) return { ok: false, reason: "booking not found", skipped: true };
  if (!["confirmed", "completed"].includes(b.status)) return { ok: false, reason: `booking is ${b.status}`, skipped: true };
  if (!["scheduled", "failed"].includes(String(b.damage_hold_status))) return { ok: false, reason: `hold is ${b.damage_hold_status}`, skipped: true };
  const amount = holdAmount(b);
  if (amount <= 0) return { ok: false, reason: "no damage deposit on this booking", skipped: true };
  if (now >= releaseAt(b)) return { ok: false, reason: "the release date has passed", skipped: true };
  if (!force) {
    if (!pickupDayStarted(b, now)) return { ok: false, reason: "not pick-up day yet", skipped: true };
    const last = b.damage_hold_last_attempt_at ? new Date(String(b.damage_hold_last_attempt_at)).getTime() : 0;
    if (b.damage_hold_status === "failed" && now.getTime() - last < RETRY_AFTER_HOURS * 3_600_000) {
      return { ok: false, reason: "retried recently", skipped: true };
    }
  }

  // The customer may have authorized it through their link and nothing recorded it yet.
  if (b.damage_hold_payment_intent_id) {
    const prev = await stripe.paymentIntents.retrieve(String(b.damage_hold_payment_intent_id), { expand: ["latest_charge"] }).catch(() => null);
    if (prev?.status === "requires_capture" && (await markHoldAuthorized(prev))) return { ok: true, status: "held" };
  }

  const attempt = Number(b.damage_hold_attempts ?? 0) + 1;
  const { data: claimed } = await supabaseAdmin
    .from("bookings")
    .update({ damage_hold_status: "processing", damage_hold_attempts: attempt, damage_hold_last_attempt_at: now.toISOString() })
    .eq("id", b.id)
    .in("damage_hold_status", ["scheduled", "failed"])
    .select("id")
    .maybeSingle();
  if (!claimed) return { ok: false, reason: "already being placed", skipped: true };

  if (!b.stripe_customer_id || !b.stripe_payment_method_id) {
    await recordFailure(b, "no saved card", null);
    return { ok: false, reason: "no saved card" };
  }

  try {
    const pi = await createHoldIntent(
      {
        amount: toCents(amount),
        currency: "usd",
        customer: String(b.stripe_customer_id),
        payment_method: String(b.stripe_payment_method_id),
        off_session: true,
        confirm: true,
        description: description(await carNameFor(b.car_id), b),
        metadata: { booking_id: b.id, kind: "damage_hold" },
      },
      `hold-${b.id}-${attempt}`,
    );
    if (pi.status === "requires_capture") {
      await markHoldAuthorized(pi);
      return { ok: true, status: "held" };
    }
    await recordFailure(b, pi.status === "requires_action" ? "your bank asked to confirm the payment" : `authorization ${pi.status}`, pi.id);
    return { ok: false, reason: pi.status };
  } catch (err) {
    const piId = (err as { payment_intent?: { id?: string } })?.payment_intent?.id ?? null;
    const reason = friendlyDecline(err);
    await recordFailure(b, reason, piId, (err as Error)?.message);
    return { ok: false, reason };
  }
}

/**
 * Takes the hold off the card. `force` (admin "Liberar agora") skips the 3-day wait. A
 * cancelled booking is always released.
 */
export async function releaseHold(bookingId: string, { force = false, now = new Date() } = {}): Promise<HoldResult> {
  const b = await load(bookingId);
  if (!b) return { ok: false, reason: "booking not found", skipped: true };
  if (b.damage_hold_status !== "held") return { ok: false, reason: `hold is ${b.damage_hold_status}`, skipped: true };
  if (!force && b.status !== "cancelled" && now < releaseAt(b)) return { ok: false, reason: "not due yet", skipped: true };

  const { data: claimed } = await supabaseAdmin
    .from("bookings")
    .update({ damage_hold_status: "processing", damage_hold_last_attempt_at: now.toISOString() })
    .eq("id", b.id)
    .eq("damage_hold_status", "held")
    .select("id")
    .maybeSingle();
  if (!claimed) return { ok: false, reason: "hold is being changed", skipped: true };

  const piId = String(b.damage_hold_payment_intent_id ?? "");
  try {
    let pi = piId ? await stripe.paymentIntents.retrieve(piId) : null;
    if (pi && pi.status === "succeeded") {
      // Captured outside the app (Stripe dashboard): record it rather than hide it.
      await supabaseAdmin
        .from("bookings")
        .update({ damage_hold_status: "captured", damage_charged_amount: pi.amount_received / 100, damage_charged_at: now.toISOString() })
        .eq("id", b.id);
      return { ok: true, status: "captured" };
    }
    if (pi && pi.status !== "canceled") pi = await stripe.paymentIntents.cancel(pi.id);
    await supabaseAdmin
      .from("bookings")
      .update({ damage_hold_status: "released", damage_hold_released_at: now.toISOString(), damage_hold_last_error: null })
      .eq("id", b.id);
    return { ok: true, status: "released" };
  } catch (err) {
    await supabaseAdmin
      .from("bookings")
      .update({ damage_hold_status: "held", damage_hold_last_error: `release failed: ${(err as Error)?.message ?? err}`.slice(0, 500) })
      .eq("id", b.id);
    return { ok: false, reason: (err as Error)?.message ?? "release failed" };
  }
}

/**
 * The car is still out and the current hold lapses before the release date: place a fresh
 * hold, then cancel the old one. If the new one is declined the old one stays until it
 * lapses; the cron then treats it as failed and the customer gets the link.
 */
async function renewHold(b: BookingRecord, now: Date): Promise<HoldResult> {
  const { data: claimed } = await supabaseAdmin
    .from("bookings")
    .update({ damage_hold_status: "processing", damage_hold_last_attempt_at: now.toISOString() })
    .eq("id", b.id)
    .eq("damage_hold_status", "held")
    .select("id")
    .maybeSingle();
  if (!claimed) return { ok: false, reason: "hold is being changed", skipped: true };
  const attempt = Number(b.damage_hold_attempts ?? 0) + 1;
  const oldId = String(b.damage_hold_payment_intent_id ?? "");
  try {
    const pi = await createHoldIntent(
      {
        amount: toCents(holdAmount(b)),
        currency: "usd",
        customer: String(b.stripe_customer_id),
        payment_method: String(b.stripe_payment_method_id),
        off_session: true,
        confirm: true,
        description: description(await carNameFor(b.car_id), b),
        metadata: { booking_id: b.id, kind: "damage_hold", renews: oldId },
      },
      `hold-${b.id}-${attempt}`,
    );
    if (pi.status !== "requires_capture") throw Object.assign(new Error(`authorization ${pi.status}`), { payment_intent: pi });
    if (oldId) await stripe.paymentIntents.cancel(oldId).catch(() => null);
    await supabaseAdmin
      .from("bookings")
      .update({
        damage_hold_status: "held",
        damage_hold_payment_intent_id: pi.id,
        damage_hold_authorized_at: now.toISOString(),
        damage_hold_expires_at: expiresAtOf(pi),
        damage_hold_attempts: attempt,
        damage_hold_last_error: null,
      })
      .eq("id", b.id);
    return { ok: true, status: "held" };
  } catch (err) {
    const reason = friendlyDecline(err);
    await supabaseAdmin
      .from("bookings")
      .update({ damage_hold_status: "held", damage_hold_attempts: attempt, damage_hold_last_error: `renewal failed: ${reason}` })
      .eq("id", b.id);
    const carName = await carNameFor(b.car_id);
    await notifyPush("booking_hold_failed", {
      car: carName,
      customer: b.customer_name || b.customer_email || "",
      amount: formatUsd(holdAmount(b)),
      reason: `renovação falhou (${reason}); o bloqueio atual vale até ${new Date(String(b.damage_hold_expires_at)).toLocaleDateString("en-US")}`,
    }, { priority: "high" });
    return { ok: false, reason };
  }
}

/**
 * Admin "Cobrar dano": captures `amount` (≤ the hold) from the hold; the rest is released at
 * once. With no hold on the card (it was declined), charges the saved card off-session, as
 * the rental agreement authorizes.
 */
export async function chargeDamage(bookingId: string, amount: number, note: string, { now = new Date() } = {}): Promise<HoldResult> {
  const b = await load(bookingId);
  if (!b) return { ok: false, reason: "booking not found" };
  const max = holdAmount(b) || DAMAGE_HOLD_AMOUNT;
  const cents = toCents(amount);
  if (!Number.isFinite(amount) || cents <= 0) return { ok: false, reason: "informe um valor maior que zero" };
  if (cents > toCents(max)) return { ok: false, reason: `o valor máximo é ${formatUsd(max)}` };

  const from = String(b.damage_hold_status);
  if (!["held", "failed", "scheduled"].includes(from)) return { ok: false, reason: `a caução está ${from}` };
  const { data: claimed } = await supabaseAdmin
    .from("bookings")
    .update({ damage_hold_status: "processing", damage_hold_last_attempt_at: now.toISOString() })
    .eq("id", b.id)
    .eq("damage_hold_status", from)
    .select("id")
    .maybeSingle();
  if (!claimed) return { ok: false, reason: "a caução está sendo alterada, tente de novo" };

  const captured = async (pi: Stripe.PaymentIntent) => {
    await supabaseAdmin
      .from("bookings")
      .update({
        damage_hold_status: "captured",
        damage_charged_amount: pi.amount_received / 100,
        damage_charged_at: now.toISOString(),
        damage_charge_note: note?.trim() || null,
        damage_hold_payment_intent_id: pi.id,
        damage_hold_last_error: null,
      })
      .eq("id", b.id);
  };

  try {
    if (from === "held") {
      const pi = await stripe.paymentIntents.capture(String(b.damage_hold_payment_intent_id), { amount_to_capture: cents });
      if (pi.status !== "succeeded") throw new Error(`capture ${pi.status}`);
      await captured(pi);
      return { ok: true, status: "captured" };
    }
    if (!b.stripe_customer_id || !b.stripe_payment_method_id) throw new Error("no saved card");
    const pi = await stripe.paymentIntents.create(
      {
        amount: cents,
        currency: "usd",
        customer: String(b.stripe_customer_id),
        payment_method: String(b.stripe_payment_method_id),
        off_session: true,
        confirm: true,
        description: `Damage charge · ${await carNameFor(b.car_id)} · ${shortRange(b.pickup_date, b.return_date)}`,
        receipt_email: b.customer_email || undefined,
        metadata: { booking_id: b.id, kind: "damage_charge" },
      },
      { idempotencyKey: `damage-${b.id}-${cents}-${Number(b.damage_hold_attempts ?? 0)}` },
    );
    if (pi.status !== "succeeded") throw new Error(`payment ${pi.status}`);
    await captured(pi);
    return { ok: true, status: "captured" };
  } catch (err) {
    const reason = from === "held" ? (err as Error)?.message ?? "capture failed" : friendlyDecline(err);
    await supabaseAdmin
      .from("bookings")
      .update({ damage_hold_status: from, damage_hold_last_error: `damage charge failed: ${reason}`.slice(0, 500) })
      .eq("id", b.id);
    return { ok: false, reason };
  }
}

/** Admin "Carro devolvido": starts the 3-day countdown to the release. */
export async function markReturned(bookingId: string, { now = new Date() } = {}): Promise<{ ok: true; releaseAt: string } | { ok: false; reason: string }> {
  const b = await load(bookingId);
  if (!b) return { ok: false, reason: "reserva não encontrada" };
  if (b.status === "cancelled") return { ok: false, reason: "a reserva está cancelada" };
  if (b.returned_at) return { ok: true, releaseAt: releaseAt(b).toISOString() };
  const returnedAt = now.toISOString();
  await supabaseAdmin
    .from("bookings")
    .update({ returned_at: returnedAt, ...(b.status === "confirmed" ? { status: "completed" } : {}) })
    .eq("id", b.id)
    .is("returned_at", null);
  return { ok: true, releaseAt: damageHoldReleaseAt({ returned_at: returnedAt, return_date: b.return_date }).toISOString() };
}

/** A 'processing' row left behind by a crashed run: put it back where Stripe says it is. */
async function reconcileStuck(b: BookingRecord, now: Date): Promise<void> {
  const piId = b.damage_hold_payment_intent_id ? String(b.damage_hold_payment_intent_id) : null;
  const pi = piId ? await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] }).catch(() => null) : null;
  let patch: Record<string, unknown>;
  if (pi?.status === "requires_capture") {
    patch = { damage_hold_status: "held", damage_hold_expires_at: expiresAtOf(pi) };
  } else if (pi?.status === "succeeded") {
    patch = { damage_hold_status: "captured", damage_charged_amount: pi.amount_received / 100, damage_charged_at: now.toISOString() };
  } else if (pi?.status === "canceled" && b.damage_hold_released_at == null && now >= releaseAt(b)) {
    patch = { damage_hold_status: "released", damage_hold_released_at: now.toISOString() };
  } else {
    patch = { damage_hold_status: "failed", damage_hold_last_error: "interrupted; will retry" };
  }
  await supabaseAdmin.from("bookings").update(patch).eq("id", b.id).eq("damage_hold_status", "processing");
}

/**
 * Hourly from /api/cron/booking-payments: places holds due today, retries declined ones,
 * renews holds about to lapse while the car is out, releases holds 3 days after the return
 * (or right away for a cancelled booking) and repairs rows left mid-change.
 */
export async function processDamageHolds(now: Date = new Date()): Promise<{ placed: number; failed: number; renewed: number; released: number }> {
  const { data } = await supabaseAdmin
    .from("bookings")
    .select("*")
    .in("damage_hold_status", ["scheduled", "failed", "held", "processing"])
    .gt("damage_hold_amount", 0);
  const out = { placed: 0, failed: 0, renewed: 0, released: 0 };
  for (const b of (data ?? []) as BookingRecord[]) {
    try {
      const status = b.damage_hold_status as DamageHoldStatus;
      if (status === "processing") {
        const last = b.damage_hold_last_attempt_at ? new Date(String(b.damage_hold_last_attempt_at)).getTime() : 0;
        if (now.getTime() - last > STUCK_AFTER_MINUTES * 60_000) await reconcileStuck(b, now);
        continue;
      }
      if (status === "scheduled" || status === "failed") {
        if (!["confirmed", "completed"].includes(b.status)) continue;
        const r = await placeHold(b.id, { now });
        if (r.ok) out.placed++;
        else if (!("skipped" in r && r.skipped)) out.failed++;
        continue;
      }
      // held
      if (b.status === "cancelled" || now >= releaseAt(b)) {
        const r = await releaseHold(b.id, { now });
        if (r.ok && r.status === "released") out.released++;
        continue;
      }
      const pi = await stripe.paymentIntents.retrieve(String(b.damage_hold_payment_intent_id), { expand: ["latest_charge"] }).catch(() => null);
      if (pi && pi.status === "succeeded") {
        await supabaseAdmin
          .from("bookings")
          .update({ damage_hold_status: "captured", damage_charged_amount: pi.amount_received / 100, damage_charged_at: now.toISOString() })
          .eq("id", b.id)
          .eq("damage_hold_status", "held");
        continue;
      }
      if (pi && pi.status === "canceled") {
        // Lapsed (or cancelled in the dashboard) while the car is still out: hold again.
        await supabaseAdmin
          .from("bookings")
          .update({ damage_hold_status: "scheduled", damage_hold_last_error: "the previous hold lapsed" })
          .eq("id", b.id)
          .eq("damage_hold_status", "held");
        const r = await placeHold(b.id, { now, force: true });
        if (r.ok) out.placed++;
        else if (!("skipped" in r && r.skipped)) out.failed++;
        continue;
      }
      const expires = b.damage_hold_expires_at ? new Date(String(b.damage_hold_expires_at)).getTime() : Infinity;
      if (expires < releaseAt(b).getTime() && expires - now.getTime() < RENEW_BEFORE_HOURS * 3_600_000) {
        const r = await renewHold(b, now);
        if (r.ok) out.renewed++;
        else if (!("skipped" in r && r.skipped)) out.failed++;
      }
    } catch (err) {
      console.error("processDamageHolds failed for", b.id, err);
    }
  }
  return out;
}

/**
 * For the customer's "authorize the hold" link (sent when the off-session hold is declined):
 * an on-session manual-capture PaymentIntent with any card, saved for renewals.
 */
export async function holdPaymentIntent(b: BookingRecord, now: Date = new Date()): Promise<Stripe.PaymentIntent> {
  const amount = toCents(holdAmount(b));
  if (b.damage_hold_payment_intent_id) {
    const prev = await stripe.paymentIntents.retrieve(String(b.damage_hold_payment_intent_id), { expand: ["latest_charge"] });
    // Already authorized, or an earlier link attempt that can still be confirmed. The declined
    // off-session attempt is not reused: it would not save the new card for renewals.
    if (prev.metadata?.kind === "damage_hold" && prev.status === "requires_capture") return prev;
    if (
      prev.amount === amount && prev.metadata?.kind === "damage_hold" && prev.setup_future_usage === "off_session" &&
      ["requires_payment_method", "requires_confirmation", "requires_action"].includes(prev.status)
    ) {
      return prev;
    }
  }
  const pi = await createHoldIntent(
    {
      amount,
      currency: "usd",
      customer: b.stripe_customer_id ? String(b.stripe_customer_id) : undefined,
      setup_future_usage: "off_session",
      description: description(await carNameFor(b.car_id), b),
      metadata: { booking_id: b.id, kind: "damage_hold" },
    },
    `hold-link-${b.id}-${Number(b.damage_hold_attempts ?? 0)}-${now.toISOString().slice(0, 13)}`,
  );
  await supabaseAdmin.from("bookings").update({ damage_hold_payment_intent_id: pi.id }).eq("id", b.id).eq("damage_hold_status", "failed");
  return pi;
}

export { releaseAt as damageHoldReleaseAtFor };
