// Payment schedule for storefront bookings: the customer picks 20% at checkout with the
// remaining 80% charged automatically 5 days before pickup, or 100% at checkout. A booking
// made inside that 5-day window can only pay 100%. Pure functions (no Stripe/DB) so the checkout UI and the server agree.

export const DEPOSIT_RATE = 0.2;
export const BALANCE_DAYS_BEFORE_PICKUP = 5;
/** Dates (pickup, due dates, "today") are calendar days where the cars are. */
export const BUSINESS_TIME_ZONE = "America/New_York";

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

/** One sentence for emails and the confirmation screen. */
export function paymentSummary(p: Pick<PaymentPlan, "plan" | "depositAmount" | "balanceAmount" | "balanceDueDate">): string {
  if (p.plan === "full" || !p.balanceDueDate || p.balanceAmount <= 0) {
    return `Paid in full: ${formatUsd(p.depositAmount)}.`;
  }
  return `Paid today: ${formatUsd(p.depositAmount)} (20% deposit). The remaining ${formatUsd(p.balanceAmount)} will be charged automatically to the same card on ${formatLongDate(p.balanceDueDate)}.`;
}
