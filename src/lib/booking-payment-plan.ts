// Payment schedule for storefront bookings: the customer picks 20% at checkout with the
// remaining 80% charged automatically 5 days before pickup, or 100% at checkout. A booking
// made inside that 5-day window can only pay 100%. Pure functions (no Stripe/DB) so the checkout UI and the server agree.

export const DEPOSIT_RATE = 0.2;
export const BALANCE_DAYS_BEFORE_PICKUP = 5;
/** Dates (pickup, due dates, "today") are calendar days where the cars are. */
export const BUSINESS_TIME_ZONE = "America/New_York";
/**
 * Refundable damage deposit: nothing is charged at checkout; a hold of this amount is placed
 * on the saved card on pick-up day and released DAMAGE_HOLD_RELEASE_DAYS after the car is
 * marked returned, unless damage is charged first.
 */
export const DAMAGE_HOLD_AMOUNT = 99;
export const DAMAGE_HOLD_RELEASE_DAYS = 3;

export type PaymentPlanKind = "deposit_balance" | "full";
/** What the customer picked at checkout. "deposit" is only honored when the pickup is far enough out. */
export type PaymentChoice = "deposit" | "full";

export type PaymentPlan = {
  plan: PaymentPlanKind;
  /** Charged at checkout. */
  depositAmount: number;
  /** Charged off-session on balanceDueDate (0 for "full"). */
  balanceAmount: number;
  balanceDueDate: string | null;
};

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** YYYY-MM-DD of `now` in the business time zone. */
export function businessToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Calendar arithmetic on YYYY-MM-DD strings (no time zone involved). */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** The 20% option exists only while the balance due date is still in the future. */
export function depositAvailable(pickupDate: string, today: string = businessToday()): boolean {
  return today < addDays(pickupDate, -BALANCE_DAYS_BEFORE_PICKUP);
}

export function paymentPlan(
  total: number,
  pickupDate: string,
  today: string = businessToday(),
  choice: PaymentChoice = "deposit",
): PaymentPlan {
  const totalCents = toCents(total);
  const dueDate = addDays(pickupDate, -BALANCE_DAYS_BEFORE_PICKUP);
  if (choice === "full" || !depositAvailable(pickupDate, today)) {
    return { plan: "full", depositAmount: totalCents / 100, balanceAmount: 0, balanceDueDate: null };
  }
  const depositCents = Math.round(totalCents * DEPOSIT_RATE);
  return {
    plan: "deposit_balance",
    depositAmount: depositCents / 100,
    balanceAmount: (totalCents - depositCents) / 100,
    balanceDueDate: dueDate,
  };
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

/** "Sun, Sep 20, 2026" for a YYYY-MM-DD date. */
export function formatLongDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

/** The damage-deposit sentence shown at checkout, on the confirmation screen and in emails. */
export function damageHoldSummary(amount: number = DAMAGE_HOLD_AMOUNT): string {
  return `A refundable ${formatUsd(amount)} damage deposit will be held (not charged) on the same card on pick-up day and released automatically ${DAMAGE_HOLD_RELEASE_DAYS} days after you return the car.`;
}

/** One sentence for emails and the confirmation screen (plus the damage deposit, when there is one). */
export function paymentSummary(
  p: Pick<PaymentPlan, "plan" | "depositAmount" | "balanceAmount" | "balanceDueDate">,
  damageHold: number = 0,
): string {
  const paid =
    p.plan === "full" || !p.balanceDueDate || p.balanceAmount <= 0
      ? `Paid in full: ${formatUsd(p.depositAmount)}.`
      : `Paid today: ${formatUsd(p.depositAmount)} (20% deposit). The remaining ${formatUsd(p.balanceAmount)} will be charged automatically to the same card on ${formatLongDate(p.balanceDueDate)}.`;
  return damageHold > 0 ? `${paid} ${damageHoldSummary(damageHold)}` : paid;
}

/** UTC instant of a wall-clock date and time ("YYYY-MM-DD", "HH:MM") in the business time zone. */
export function businessDateTime(isoDate: string, time: string = "00:00"): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  const [hh, mm] = (/^\d{1,2}:\d{2}/.test(time) ? time : "00:00").split(":").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);
  // The zone's offset at that moment: format the UTC guess there and see how far off it reads.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(asUtc));
  const get = (t: string) => Number(parts.find((x) => x.type === t)?.value);
  const shown = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(asUtc + (asUtc - shown));
}

/**
 * When the damage-deposit hold comes off: DAMAGE_HOLD_RELEASE_DAYS after the admin marked the
 * car returned, or, if nobody did, the same time after the scheduled return.
 */
export function damageHoldReleaseAt(b: { returned_at?: string | null; return_date: string; return_time?: string | null }): Date {
  const base = b.returned_at ? new Date(b.returned_at) : businessDateTime(b.return_date, b.return_time ?? "00:00");
  return new Date(base.getTime() + DAMAGE_HOLD_RELEASE_DAYS * 86_400_000);
}

/** "Dec 20" for a YYYY-MM-DD date. */
export function shortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Dec 20 → Dec 23". */
export function shortRange(pickupDate: string, returnDate: string): string {
  return `${shortDate(pickupDate)} → ${shortDate(returnDate)}`;
}
