// End to end, from an empty database: a customer books on the site, pays the deposit, and the
// $99 damage-deposit hold goes through its whole life (placed on pick-up day, released 3 days
// after "Carro devolvido", or charged for damage, or declined and authorized through the
// customer's link, or renewed during a long rental). The real route handlers and libraries
// run; only Supabase, Stripe, email and push are replaced by in-memory stand-ins.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ---- In-memory Supabase --------------------------------------------------------------
type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
let seq = 0;
const BOOKING_DEFAULTS = (): Row => ({
  id: `bk${++seq}`, payment_token: `tok${seq}`, created_at: new Date().toISOString(), notes: null,
  balance_status: "none", balance_attempts: 0, balance_last_attempt_at: null, balance_payment_intent_id: null,
  deposit_paid_at: null, deposit_payment_intent_id: null, stripe_payment_method_id: null, turo_blocked_at: null,
  damage_hold_amount: null, damage_hold_status: "none", damage_hold_payment_intent_id: null, damage_hold_authorized_at: null,
  damage_hold_expires_at: null, damage_hold_attempts: 0, damage_hold_last_attempt_at: null, damage_hold_last_error: null,
  damage_hold_released_at: null, damage_charged_amount: null, damage_charged_at: null, damage_charge_note: null, returned_at: null,
});

function query(table: string) {
  db[table] ??= [];
  const filters: ((r: Row) => boolean)[] = [];
  let patch: Row | null = null;
  let insertRow: Row | null = null;
  const run = () => {
    if (insertRow) {
      const row = { ...(table === "bookings" ? BOOKING_DEFAULTS() : { id: `${table}${++seq}` }), ...insertRow };
      db[table].push(row);
      return [row];
    }
    const rows = db[table].filter((r) => filters.every((f) => f(r)));
    if (patch) rows.forEach((r) => Object.assign(r, patch));
    return rows.map((r) => ({ ...r }));
  };
  const b = {
    select: () => b,
    order: () => b,
    update: (p: Row) => { patch = p; return b; },
    insert: (r: Row) => { insertRow = r; return b; },
    eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return b; },
    neq: (k: string, v: unknown) => { filters.push((r) => r[k] !== v); return b; },
    is: (k: string, v: unknown) => { filters.push((r) => (r[k] ?? null) === v); return b; },
    not: (k: string, _op: string, v: unknown) => { filters.push((r) => (r[k] ?? null) !== v); return b; },
    in: (k: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[k])); return b; },
    lte: (k: string, v: string) => { filters.push((r) => String(r[k]) <= v); return b; },
    lt: (k: string, v: string) => { filters.push((r) => String(r[k]) < v); return b; },
    gt: (k: string, v: number) => { filters.push((r) => Number(r[k] ?? 0) > v); return b; },
    maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    single: async () => { const r = run()[0]; return { data: r ?? null, error: r ? null : new Error("no row") }; },
    then: (res: (v: { data: Row[]; error: null }) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve({ data: run(), error: null }).then(res, rej),
  };
  return b;
}
vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: {
    from: (t: string) => query(t),
    storage: { from: () => ({ upload: async (path: string) => ({ data: { path }, error: null }) }) },
  },
}));

// ---- Stateful fake Stripe ------------------------------------------------------------
type PI = {
  id: string; object: "payment_intent"; amount: number; amount_received: number; currency: string; status: string;
  capture_method: string; customer?: string; payment_method: string | null; setup_future_usage?: string;
  metadata: Record<string, string>; client_secret: string; created: number; latest_charge: unknown;
  payment_method_options?: unknown; off_session?: boolean;
};
const stripeState = {
  pis: new Map<string, PI>(),
  idem: new Map<string, PI>(),
  declining: new Set<string>(),
  extendedAuth: false,
  n: 0,
  calls: [] as { op: string; id?: string; params?: Record<string, unknown> }[],
};
function chargeFor(pi: PI) {
  const holdDays = stripeState.extendedAuth && pi.payment_method_options ? 30 : 7;
  return { id: `ch_${pi.id}`, object: "charge", payment_method_details: { card: { capture_before: Math.floor(Date.now() / 1000) + holdDays * 86400 } } };
}
function settle(pi: PI, pm: string) {
  if (stripeState.declining.has(pm)) {
    pi.status = "requires_payment_method";
    throw Object.assign(new Error("Your card was declined."), { type: "StripeCardError", code: "card_declined", payment_intent: { id: pi.id } });
  }
  pi.payment_method = pm;
  if (pi.capture_method === "manual") pi.status = "requires_capture";
  else { pi.status = "succeeded"; pi.amount_received = pi.amount; }
  pi.latest_charge = chargeFor(pi);
}
const fakeStripe = {
  customers: {
    list: async () => ({ data: [] }),
    create: async () => ({ id: "cus_test" }),
  },
  paymentIntents: {
    create: async (params: Record<string, unknown>, opts?: { idempotencyKey?: string }) => {
      stripeState.calls.push({ op: "create", params });
      if (opts?.idempotencyKey && stripeState.idem.has(opts.idempotencyKey)) return { ...stripeState.idem.get(opts.idempotencyKey)! };
      const pmo = params.payment_method_options as { card?: { request_extended_authorization?: string } } | undefined;
      if (pmo?.card?.request_extended_authorization && !stripeState.extendedAuth) {
        throw Object.assign(new Error("Extended authorization is not available for your account."), {
          type: "StripeInvalidRequestError", param: "payment_method_options[card][request_extended_authorization]",
        });
      }
      const id = `pi_${++stripeState.n}`;
      const pi: PI = {
        id, object: "payment_intent", amount: Number(params.amount), amount_received: 0, currency: "usd",
        status: "requires_payment_method", capture_method: String(params.capture_method ?? "automatic"),
        customer: params.customer as string, payment_method: (params.payment_method as string) ?? null,
        setup_future_usage: params.setup_future_usage as string, metadata: (params.metadata as Record<string, string>) ?? {},
        client_secret: `${id}_secret`, created: Math.floor(Date.now() / 1000), latest_charge: null,
        payment_method_options: params.payment_method_options, off_session: !!params.off_session,
      };
      stripeState.pis.set(id, pi);
      if (opts?.idempotencyKey) stripeState.idem.set(opts.idempotencyKey, pi);
      if (params.confirm) settle(pi, String(params.payment_method));
      return { ...pi };
    },
    retrieve: async (id: string) => {
      const pi = stripeState.pis.get(id);
      if (!pi) throw new Error(`No such payment_intent: ${id}`);
      return { ...pi };
    },
    cancel: async (id: string) => {
      stripeState.calls.push({ op: "cancel", id });
      const pi = stripeState.pis.get(id)!;
      if (pi.status === "succeeded") throw new Error("cannot cancel a succeeded PaymentIntent");
      pi.status = "canceled";
      return { ...pi };
    },
    capture: async (id: string, params: { amount_to_capture?: number }) => {
      stripeState.calls.push({ op: "capture", id, params });
      const pi = stripeState.pis.get(id)!;
      if (pi.status !== "requires_capture") throw new Error(`cannot capture a ${pi.status} PaymentIntent`);
      if ((params.amount_to_capture ?? 0) > pi.amount) throw new Error("amount_to_capture too large");
      pi.status = "succeeded";
      pi.amount_received = params.amount_to_capture ?? pi.amount;
      return { ...pi };
    },
  },
};
vi.mock("@/lib/stripe", () => ({ get stripe() { return fakeStripe; } }));

/** What Stripe.js does when the customer submits the card form. */
function customerConfirms(piId: string, pm: string) {
  settle(stripeState.pis.get(piId)!, pm);
}

// ---- Email / push / alerts / admin auth / availability ---------------------------------
const emails: { trigger: string; to: string; vars: Record<string, string> }[] = [];
vi.mock("@/lib/automatic-emails", () => ({
  sendAutomaticEmail: async (trigger: string, to: { email: string }, vars: Record<string, string>) => {
    emails.push({ trigger, to: to.email, vars });
    return { ok: true };
  },
}));
const pushes: { key: string; vars: Record<string, unknown> }[] = [];
vi.mock("@/lib/notify", () => ({ notifyPush: async (key: string, vars: Record<string, unknown>) => { pushes.push({ key, vars }); } }));
vi.mock("@/lib/booking-alerts", () => ({ sendBookingAlerts: async () => {} }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: async () => ({ ok: true, status: 200, userId: "admin" }) }));
vi.mock("@/lib/car-availability", () => ({
  getUnavailableCarIds: async () => new Set<string>(),
  isValidDateRange: (a?: string, b?: string) => !!a && !!b && b > a,
}));

import { POST as requestBooking } from "@/app/api/bookings/request/route";
import { POST as finalizeBooking } from "@/app/api/bookings/[id]/finalize/route";
import { GET as runCron } from "@/app/api/cron/booking-payments/route";
import { POST as adminHold } from "@/app/api/admin/bookings/[id]/damage-hold/route";
import { GET as holdLinkGet, POST as holdLinkPost } from "@/app/api/bookings/[id]/hold/route";
import { tripPriceBreakdown } from "@/lib/trip-pricing";
import { businessDateTime, damageHoldReleaseAt, paymentSummary } from "@/lib/booking-payment-plan";

// ---- Helpers ---------------------------------------------------------------------------
const CAR = { id: "car1", name: "2020 Kia Rio", make: "Kia", model: "Rio", year: 2020, daily_rate: "80", discounted_daily_rate: null, min_driver_age: 21, store_visible: true };

function at(iso: string) {
  vi.setSystemTime(new Date(iso));
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const json = (url: string, body: unknown) =>
  new NextRequest(url, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
const booking = () => db.bookings[0];
const pi = (id: unknown) => stripeState.pis.get(String(id))!;

async function bookFromScratch({ pickupDate, returnDate, card = "pm_visa" }: { pickupDate: string; returnDate: string; card?: string }) {
  const driver = {
    fullName: "Jane Doe", email: "Jane@Example.com", phone: "+1 305 555 0100", dateOfBirth: "1990-05-01",
    licenseNumber: "D1234567", licenseExpiration: "2030-01-01", licenseState: "FL",
  };
  const draft = {
    carId: CAR.id, carName: "", carImage: null, dailyRate: 80, minDriverAge: 21,
    pickupDate, pickupTime: "10:00", returnDate, returnTime: "10:00", protectionPlan: null, extras: [], driver,
  };
  const priced = tripPriceBreakdown(draft as never);
  const form = new FormData();
  form.set("payload", JSON.stringify({
    carId: CAR.id, pickupDate, pickupTime: "10:00", returnDate, returnTime: "10:00", dailyRate: 80,
    protectionPlan: "basic", extras: [], driver, rentalAgreementVersion: "v1", paymentChoice: "deposit",
    breakdown: { ...priced, total: priced.total },
  }));
  const img = () => new File([new Uint8Array([1, 2, 3])], "front.jpg", { type: "image/jpeg" });
  form.set("licenseFront", img());
  form.set("licenseBack", img());
  form.set("rentalAgreementSignature", new File([new Uint8Array([1])], "sig.png", { type: "image/png" }));
  const res = await requestBooking(new NextRequest("http://localhost/api/bookings/request", { method: "POST", body: form }));
  const data = await res.json();
  expect(res.status).toBe(200);
  // The customer types the card into the Stripe form at checkout and pays the deposit.
  customerConfirms(String(booking().deposit_payment_intent_id), card);
  const fin = await finalizeBooking(json(`http://localhost/api/bookings/${data.bookingId}/finalize`, { token: data.token }), params(data.bookingId));
  expect(await fin.json()).toEqual({ status: "confirmed" });
  return data as { bookingId: string; token: string; damageHold: number; schedule: { plan: string } };
}

async function cron(iso: string) {
  at(iso);
  const res = await runCron(new NextRequest("http://localhost/api/cron/booking-payments"));
  return (await res.json()) as { damageHolds: { placed: number; failed: number; renewed: number; released: number } };
}

async function admin(id: string, body: Record<string, unknown>) {
  const res = await adminHold(json(`http://localhost/api/admin/bookings/${id}/damage-hold`, body), params(id));
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  for (const k of Object.keys(db)) delete db[k];
  db.products = [{ ...CAR }];
  db.clients = [];
  seq = 0;
  stripeState.pis.clear();
  stripeState.idem.clear();
  stripeState.declining.clear();
  stripeState.extendedAuth = false;
  stripeState.calls.length = 0;
  emails.length = 0;
  pushes.length = 0;
});
afterEach(() => vi.useRealTimers());

// ---- The flows -------------------------------------------------------------------------
describe("damage deposit: a booking from scratch", () => {
  it("is shown at checkout, held on pick-up day and released 3 days after 'Carro devolvido'", async () => {
    at("2026-11-10T15:00:00Z");
    const { bookingId, damageHold, schedule } = await bookFromScratch({ pickupDate: "2026-11-20", returnDate: "2026-11-23" });

    // Checkout: nothing about the $99 is charged; the booking carries it and it is scheduled.
    expect(damageHold).toBe(99);
    expect(schedule.plan).toBe("deposit_balance");
    expect(stripeState.calls.filter((c) => c.op === "create")).toHaveLength(1); // only the 20% deposit
    expect(booking()).toMatchObject({ status: "confirmed", damage_hold_amount: 99, damage_hold_status: "scheduled", stripe_payment_method_id: "pm_visa" });
    const confirmation = emails.find((e) => e.trigger === "booking_confirmed")!;
    expect(confirmation.vars.payment_summary).toContain("refundable $99.00 damage deposit will be held (not charged)");

    // Balance day (5 days before pick-up): the 80% is charged, the hold is not placed yet.
    await cron("2026-11-15T15:17:00Z");
    expect(booking()).toMatchObject({ balance_status: "paid", damage_hold_status: "scheduled" });
    await cron("2026-11-20T04:17:00Z"); // 11:17pm Nov 19 in Florida
    expect(booking().damage_hold_status).toBe("scheduled");

    // Pick-up day (first run after midnight in Florida): $99 authorized, not captured.
    const r = await cron("2026-11-20T05:17:00Z");
    expect(r.damageHolds.placed).toBe(1);
    const hold = pi(booking().damage_hold_payment_intent_id);
    expect(hold).toMatchObject({ amount: 9900, capture_method: "manual", status: "requires_capture", amount_received: 0, off_session: true, payment_method: "pm_visa" });
    expect(hold.metadata).toEqual({ booking_id: bookingId, kind: "damage_hold" });
    expect(booking()).toMatchObject({ damage_hold_status: "held", damage_hold_last_error: null });
    expect(new Date(String(booking().damage_hold_expires_at)).toISOString()).toBe("2026-11-27T05:17:00.000Z");

    // Running again the same day does nothing more.
    await cron("2026-11-20T06:17:00Z");
    expect(stripeState.calls.filter((c) => c.op === "create" && (c.params?.metadata as Row)?.kind === "damage_hold")).toHaveLength(2); // the -ext attempt + the plain retry

    // The car comes back; the admin clicks "Carro devolvido".
    at("2026-11-23T15:30:00Z");
    const ret = await admin(bookingId, { action: "returned" });
    expect(ret.body).toEqual({ ok: true, releaseAt: "2026-11-26T15:30:00.000Z" });
    expect(booking()).toMatchObject({ status: "completed", returned_at: "2026-11-23T15:30:00.000Z" });

    // Not before 3 days...
    await cron("2026-11-26T15:17:00Z");
    expect(booking().damage_hold_status).toBe("held");
    expect(pi(booking().damage_hold_payment_intent_id).status).toBe("requires_capture");
    // ...and released by itself right after, with nobody clicking "Cobrar dano".
    const rel = await cron("2026-11-26T16:17:00Z");
    expect(rel.damageHolds.released).toBe(1);
    expect(booking()).toMatchObject({ damage_hold_status: "released", damage_hold_released_at: "2026-11-26T16:17:00.000Z" });
    expect(pi(booking().damage_hold_payment_intent_id)).toMatchObject({ status: "canceled", amount_received: 0 });

    // Afterwards the deposit can no longer be charged.
    expect((await admin(bookingId, { action: "charge", amount: 50 })).body).toMatchObject({ ok: false });
    expect(emails.map((e) => e.trigger)).toEqual(["booking_confirmed"]);
  });

  it("'Cobrar dano' within the 3 days captures part of the hold; the rest goes back at once", async () => {
    at("2026-11-10T15:00:00Z");
    const { bookingId } = await bookFromScratch({ pickupDate: "2026-11-20", returnDate: "2026-11-23" });
    await cron("2026-11-20T12:17:00Z");
    at("2026-11-23T15:00:00Z");
    await admin(bookingId, { action: "returned" });

    at("2026-11-24T14:00:00Z");
    expect((await admin(bookingId, { action: "charge", amount: 120 })).body).toEqual({ ok: false, reason: "o valor máximo é $99.00" });
    expect((await admin(bookingId, { action: "charge", amount: 0 })).body).toMatchObject({ ok: false });
    const charged = await admin(bookingId, { action: "charge", amount: 40, note: "Risco no para-choque" });
    expect(charged.body).toEqual({ ok: true, status: "captured" });
    const hold = pi(booking().damage_hold_payment_intent_id);
    expect(stripeState.calls.find((c) => c.op === "capture")?.params).toEqual({ amount_to_capture: 4000 });
    expect(hold).toMatchObject({ status: "succeeded", amount_received: 4000 });
    expect(booking()).toMatchObject({ damage_hold_status: "captured", damage_charged_amount: 40, damage_charge_note: "Risco no para-choque" });

    // The 3-day release no longer touches it, and it cannot be charged twice.
    await cron("2026-11-27T16:17:00Z");
    expect(booking().damage_hold_status).toBe("captured");
    expect(stripeState.calls.filter((c) => c.op === "cancel")).toHaveLength(0);
    expect((await admin(bookingId, { action: "charge", amount: 10 })).body).toMatchObject({ ok: false });
  });

  it("'Liberar agora' releases right away, without waiting the 3 days", async () => {
    at("2026-11-10T15:00:00Z");
    const { bookingId } = await bookFromScratch({ pickupDate: "2026-11-20", returnDate: "2026-11-23" });
    await cron("2026-11-20T12:17:00Z");
    at("2026-11-23T15:00:00Z");
    await admin(bookingId, { action: "returned" });
    expect((await admin(bookingId, { action: "release" })).body).toEqual({ ok: true, status: "released" });
    expect(pi(booking().damage_hold_payment_intent_id).status).toBe("canceled");
  });

  it("a declined hold: admin and customer are told once; the customer authorizes it through the link", async () => {
    at("2026-11-10T15:00:00Z");
    const { bookingId, token } = await bookFromScratch({ pickupDate: "2026-11-20", returnDate: "2026-11-23", card: "pm_low_funds" });
    stripeState.declining.add("pm_low_funds"); // the card stops approving after the deposit
    await cron("2026-11-15T15:17:00Z"); // balance fails too; not the subject here
    emails.length = 0;
    pushes.length = 0;

    const r = await cron("2026-11-20T05:17:00Z");
    expect(r.damageHolds.failed).toBe(1);
    expect(booking()).toMatchObject({ damage_hold_status: "failed", damage_hold_last_error: expect.stringContaining("your card was declined") });
    expect(db.admin_notifications.at(-1)).toMatchObject({ title: "Caução de dano não bloqueou" });
    expect(pushes.filter((p) => p.key === "booking_hold_failed")).toHaveLength(1);
    const mail = emails.find((e) => e.trigger === "booking_hold_failed")!;
    expect(mail.to).toBe("jane@example.com");
    expect(mail.vars).toMatchObject({ hold_amount: "$99.00", failure_reason: "your card was declined", hold_link: `https://vertexrentalcar.com/booking/hold?id=${bookingId}&token=${token}` });

    // An hour later: no retry, no second email.
    await cron("2026-11-20T06:17:00Z");
    expect(emails.filter((e) => e.trigger === "booking_hold_failed")).toHaveLength(1);
    // ~22h later it is retried, declined again, still no second email or push.
    await cron("2026-11-21T03:17:00Z");
    expect(booking()).toMatchObject({ damage_hold_status: "failed", damage_hold_attempts: 2 });
    expect(emails.filter((e) => e.trigger === "booking_hold_failed")).toHaveLength(1);
    expect(pushes.filter((p) => p.key === "booking_hold_failed")).toHaveLength(1);

    // The customer opens the link and authorizes the hold with another card.
    const sum = await (await holdLinkGet(new NextRequest(`http://localhost/api/bookings/${bookingId}/hold?token=${token}`), params(bookingId))).json();
    expect(sum).toMatchObject({ holdAmount: 99, holdStatus: "failed", carName: "2020 Kia Rio" });
    expect((await holdLinkGet(new NextRequest(`http://localhost/api/bookings/${bookingId}/hold?token=wrong`), params(bookingId))).status).toBe(404);
    const intent = await (await holdLinkPost(json("http://localhost/x", { token, action: "intent" }), params(bookingId))).json();
    expect(intent.clientSecret).toMatch(/_secret$/);
    const linkPi = pi(booking().damage_hold_payment_intent_id);
    expect(linkPi).toMatchObject({ amount: 9900, capture_method: "manual", setup_future_usage: "off_session", customer: "cus_test" });
    customerConfirms(linkPi.id, "pm_new_card");
    expect(await (await holdLinkPost(json("http://localhost/x", { token, action: "complete" }), params(bookingId))).json()).toEqual({ status: "held" });
    expect(booking()).toMatchObject({ damage_hold_status: "held", stripe_payment_method_id: "pm_new_card", damage_hold_last_error: null });

    // From here it is the normal flow: released 3 days after the return.
    at("2026-11-23T15:00:00Z");
    await admin(bookingId, { action: "returned" });
    await cron("2026-11-26T15:17:00Z");
    expect(booking().damage_hold_status).toBe("released");
    expect(linkPi.status).toBe("canceled");
  });

  it("'Tentar de novo' places a declined hold again right away", async () => {
    at("2026-11-10T15:00:00Z");
    const { bookingId } = await bookFromScratch({ pickupDate: "2026-11-20", returnDate: "2026-11-23", card: "pm_flaky" });
    stripeState.declining.add("pm_flaky");
    await cron("2026-11-20T05:17:00Z");
    expect(booking().damage_hold_status).toBe("failed");
    stripeState.declining.delete("pm_flaky");
    at("2026-11-20T07:00:00Z");
    expect((await admin(bookingId, { action: "retry" })).body).toEqual({ ok: true, status: "held" });
  });

  it("a long rental: the hold is renewed before it lapses while the car is still out", async () => {
    at("2026-11-10T15:00:00Z");
    await bookFromScratch({ pickupDate: "2026-11-20", returnDate: "2026-12-04" });
    await cron("2026-11-20T05:17:00Z");
    const first = String(booking().damage_hold_payment_intent_id);
    expect(booking().damage_hold_expires_at).toBe("2026-11-27T05:17:00.000Z");

    await cron("2026-11-25T16:17:00Z"); // lapses in 37h: not yet
    expect(booking().damage_hold_payment_intent_id).toBe(first);
    const r = await cron("2026-11-25T18:17:00Z"); // lapses in 35h: renew
    expect(r.damageHolds.renewed).toBe(1);
    const second = String(booking().damage_hold_payment_intent_id);
    expect(second).not.toBe(first);
    expect(pi(first).status).toBe("canceled");
    expect(pi(second)).toMatchObject({ status: "requires_capture", amount: 9900 });
    expect(booking()).toMatchObject({ damage_hold_status: "held", damage_hold_expires_at: "2026-12-02T18:17:00.000Z" });

    // Nobody clicks "Carro devolvido": it is released 3 days after the scheduled return
    // (Dec 4, 10:00 in Florida = 15:00 UTC), after one more renewal.
    await cron("2026-12-01T18:17:00Z");
    expect(booking().damage_hold_expires_at).toBe("2026-12-08T18:17:00.000Z");
    await cron("2026-12-07T14:17:00Z");
    expect(booking().damage_hold_status).toBe("held");
    await cron("2026-12-07T15:17:00Z");
    expect(booking().damage_hold_status).toBe("released");
    const live = [...stripeState.pis.values()].filter((p) => p.metadata.kind === "damage_hold" && p.status === "requires_capture");
    expect(live).toHaveLength(0);
  });

  it("asks for extended authorization; when the account has it, a long rental needs no renewal", async () => {
    stripeState.extendedAuth = true;
    at("2026-11-10T15:00:00Z");
    await bookFromScratch({ pickupDate: "2026-11-20", returnDate: "2026-12-04" });
    await cron("2026-11-20T05:17:00Z");
    const hold = pi(booking().damage_hold_payment_intent_id);
    expect(hold.payment_method_options).toEqual({ card: { request_extended_authorization: "if_available" } });
    expect(booking().damage_hold_expires_at).toBe("2026-12-20T05:17:00.000Z");
    await cron("2026-11-26T18:17:00Z");
    expect(booking().damage_hold_payment_intent_id).toBe(hold.id);
  });

  it("a cancelled booking gets its hold released on the next run", async () => {
    at("2026-11-10T15:00:00Z");
    await bookFromScratch({ pickupDate: "2026-11-20", returnDate: "2026-11-23" });
    await cron("2026-11-20T05:17:00Z");
    booking().status = "cancelled";
    await cron("2026-11-20T06:17:00Z");
    expect(booking().damage_hold_status).toBe("released");
  });

  it("a booking cancelled before pick-up never gets a hold", async () => {
    at("2026-11-10T15:00:00Z");
    await bookFromScratch({ pickupDate: "2026-11-20", returnDate: "2026-11-23" });
    booking().status = "cancelled";
    await cron("2026-11-20T05:17:00Z");
    expect(booking().damage_hold_status).toBe("scheduled");
    expect([...stripeState.pis.values()].some((p) => p.metadata.kind === "damage_hold")).toBe(false);
  });
});

describe("dates", () => {
  it("reads wall-clock times in Florida, across daylight saving", () => {
    expect(businessDateTime("2026-11-20", "10:00").toISOString()).toBe("2026-11-20T15:00:00.000Z");
    expect(businessDateTime("2026-07-01", "10:00").toISOString()).toBe("2026-07-01T14:00:00.000Z");
    expect(damageHoldReleaseAt({ return_date: "2026-11-23", return_time: "10:00" }).toISOString()).toBe("2026-11-26T15:00:00.000Z");
    expect(damageHoldReleaseAt({ returned_at: "2026-11-23T20:00:00Z", return_date: "2026-11-23" }).toISOString()).toBe("2026-11-26T20:00:00.000Z");
  });

  it("the summary mentions the deposit only when there is one", () => {
    const p = { plan: "full" as const, depositAmount: 300, balanceAmount: 0, balanceDueDate: null };
    expect(paymentSummary(p)).toBe("Paid in full: $300.00.");
    expect(paymentSummary(p, 99)).toContain("released automatically 3 days after you return the car");
  });
});
