import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- In-memory stand-ins for Supabase and Stripe -------------------------------------
type Row = Record<string, unknown>;
const db: Record<string, Row[]> = { bookings: [], admin_notifications: [], products: [] };

function query(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let patch: Row | null = null;
  let insertRow: Row | null = null;
  const run = () => {
    if (insertRow) { db[table].push(insertRow); return [insertRow]; }
    const rows = db[table].filter((r) => filters.every((f) => f(r)));
    if (patch) rows.forEach((r) => Object.assign(r, patch));
    return rows;
  };
  const b = {
    select: () => b,
    update: (p: Row) => { patch = p; return b; },
    insert: (r: Row) => { insertRow = r; return b; },
    eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return b; },
    neq: (k: string, v: unknown) => { filters.push((r) => r[k] !== v); return b; },
    is: (k: string, v: unknown) => { filters.push((r) => (r[k] ?? null) === v); return b; },
    in: (k: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[k])); return b; },
    lte: (k: string, v: string) => { filters.push((r) => String(r[k]) <= v); return b; },
    maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    then: (res: (v: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: run(), error: null }).then(res),
  };
  return b;
}
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from: (t: string) => query(t) } }));

const createPI = vi.fn();
const retrievePI = vi.fn();
vi.mock("@/lib/stripe", () => ({ stripe: { paymentIntents: { create: (...a: unknown[]) => createPI(...a), retrieve: (...a: unknown[]) => retrievePI(...a) } } }));

const sentFailed = vi.fn();
vi.mock("@/lib/booking-emails", () => ({
  carNameFor: async () => "2020 Kia Rio",
  sendBookingConfirmedEmail: vi.fn(),
  sendBalanceFailedEmail: (...a: unknown[]) => sentFailed(...a),
}));

vi.mock("@/lib/booking-alerts", () => ({ sendBookingAlerts: vi.fn() }));

import { chargeBalance, chargeDueBalances } from "./booking-payments";

function booking(over: Row = {}): Row {
  return {
    id: "b1", car_id: "c1", status: "confirmed", payment_plan: "deposit_balance",
    balance_status: "scheduled", balance_amount: 249.6, balance_due_date: "2000-01-01",
    balance_attempts: 0, balance_last_attempt_at: null, balance_payment_intent_id: null,
    stripe_customer_id: "cus_1", stripe_payment_method_id: "pm_1", customer_email: "a@b.com",
    customer_name: "Ana", pickup_date: "2000-01-06", payment_token: "t", ...over,
  };
}

beforeEach(() => {
  db.bookings = [];
  db.admin_notifications = [];
  createPI.mockReset();
  retrievePI.mockReset();
  sentFailed.mockReset();
});

describe("chargeBalance", () => {
  it("charges the saved card off-session and marks the balance paid", async () => {
    db.bookings.push(booking());
    createPI.mockResolvedValue({ id: "pi_1", status: "succeeded", metadata: { booking_id: "b1" }, payment_method: "pm_1" });
    expect(await chargeBalance("b1")).toEqual({ ok: true });
    const [params, opts] = createPI.mock.calls[0];
    expect(params).toMatchObject({ amount: 24960, customer: "cus_1", payment_method: "pm_1", off_session: true, confirm: true });
    expect(opts).toEqual({ idempotencyKey: "balance-b1-1" });
    expect(db.bookings[0]).toMatchObject({ balance_status: "paid", balance_payment_intent_id: "pi_1" });
  });

  it("on a decline: marks failed, notifies the admin and emails the customer", async () => {
    db.bookings.push(booking());
    createPI.mockRejectedValue(Object.assign(new Error("Your card was declined."), { code: "card_declined", payment_intent: { id: "pi_x" } }));
    expect(await chargeBalance("b1")).toEqual({ ok: false, reason: "your card was declined" });
    expect(db.bookings[0]).toMatchObject({ balance_status: "failed", balance_payment_intent_id: "pi_x", balance_attempts: 1 });
    expect(db.admin_notifications[0]).toMatchObject({ type: "payment_failed" });
    expect(sentFailed).toHaveBeenCalledWith(expect.objectContaining({ id: "b1" }), "your card was declined");
  });

  it("does not charge before the due date unless forced", async () => {
    db.bookings.push(booking({ balance_due_date: "2999-01-01" }));
    expect(await chargeBalance("b1")).toMatchObject({ ok: false, skipped: true });
    expect(createPI).not.toHaveBeenCalled();
    createPI.mockResolvedValue({ id: "pi_2", status: "succeeded", metadata: { booking_id: "b1" } });
    expect(await chargeBalance("b1", { force: true })).toEqual({ ok: true });
  });

  it("waits ~24h before retrying a failed charge", async () => {
    db.bookings.push(booking({ balance_status: "failed", balance_last_attempt_at: new Date().toISOString() }));
    expect(await chargeBalance("b1")).toMatchObject({ ok: false, reason: "retried recently" });
    expect(createPI).not.toHaveBeenCalled();
  });

  it("never charges twice: a balance already paid through the pay link is just recorded", async () => {
    db.bookings.push(booking({ balance_status: "failed", balance_payment_intent_id: "pi_link" }));
    retrievePI.mockResolvedValue({ id: "pi_link", status: "succeeded", metadata: { booking_id: "b1" } });
    expect(await chargeBalance("b1")).toEqual({ ok: true });
    expect(createPI).not.toHaveBeenCalled();
    expect(db.bookings[0].balance_status).toBe("paid");
  });

  it("skips cancelled bookings and bookings already being charged", async () => {
    db.bookings.push(booking({ id: "b2", status: "cancelled" }), booking({ id: "b3", balance_status: "processing" }));
    expect(await chargeBalance("b2")).toMatchObject({ skipped: true });
    expect(await chargeBalance("b3")).toMatchObject({ skipped: true });
    expect(createPI).not.toHaveBeenCalled();
  });
});

describe("chargeDueBalances", () => {
  it("charges only confirmed bookings whose balance is due", async () => {
    db.bookings.push(booking({ id: "due" }), booking({ id: "later", balance_due_date: "2999-01-01" }), booking({ id: "manual", payment_plan: null }));
    createPI.mockImplementation(async (p: { metadata: { booking_id: string } }) => ({ id: "pi", status: "succeeded", metadata: p.metadata }));
    expect(await chargeDueBalances()).toEqual({ charged: 1, failed: 0 });
    expect(createPI).toHaveBeenCalledTimes(1);
  });
});
