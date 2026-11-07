import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendAutomaticEmail } from "@/lib/automatic-emails";
import { PROTECTION_PLANS, EXTRAS, tripDays, type ProtectionPlanId, type ExtraId } from "@/lib/trip-pricing";
import { formatLongDate, formatUsd, paymentSummary, type PaymentPlanKind } from "@/lib/booking-payment-plan";

export type BookingRecord = Record<string, unknown> & {
  id: string;
  car_id: string;
  status: string;
  pickup_date: string;
  pickup_time: string;
  return_date: string;
  return_time: string;
  customer_email: string | null;
  customer_name: string | null;
  driver_full_name: string | null;
  estimated_total: number | string;
  payment_plan: PaymentPlanKind | null;
  deposit_amount: number | string | null;
  balance_amount: number | string | null;
  balance_due_date: string | null;
  payment_token: string;
};

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://vertexrentalcar.com").replace(/\/$/, "");
}

export function payLink(b: Pick<BookingRecord, "id" | "payment_token">): string {
  return `${siteUrl()}/booking/pay?id=${b.id}&token=${b.payment_token}`;
}

export async function carNameFor(carId: string): Promise<string> {
  const { data: car } = await supabaseAdmin.from("products").select("name, make, model, year").eq("id", carId).maybeSingle();
  return car?.name || [car?.year, car?.make, car?.model].filter(Boolean).join(" ") || "your vehicle";
}

function customerNameOf(b: BookingRecord): string {
  return b.customer_name || b.driver_full_name || "there";
}

function baseVars(b: BookingRecord, carName: string) {
  return {
    customer_name: customerNameOf(b),
    confirmation_number: b.id.slice(0, 8).toUpperCase(),
    car_name: carName,
    pickup_date: formatLongDate(b.pickup_date),
    pickup_time: b.pickup_time,
    return_date: formatLongDate(b.return_date),
    return_time: b.return_time,
  };
}

/** The "booking_confirmed" email, with the payment schedule when the booking was paid online. */
export async function sendBookingConfirmedEmail(b: BookingRecord): Promise<void> {
  if (!b.customer_email) return;
  const carName = await carNameFor(b.car_id);
  const plan = PROTECTION_PLANS.find((p) => p.id === (b.protection_plan as ProtectionPlanId));
  const extraIds = Array.isArray(b.extras) ? (b.extras as ExtraId[]) : [];
  const extrasList = extraIds.length
    ? extraIds.map((id) => EXTRAS.find((e) => e.id === id)?.name).filter(Boolean).join(", ")
    : "None";
  const summary = b.payment_plan
    ? paymentSummary({
        plan: b.payment_plan,
        depositAmount: Number(b.deposit_amount ?? 0),
        balanceAmount: Number(b.balance_amount ?? 0),
        balanceDueDate: b.balance_due_date,
      })
    : "";
  await sendAutomaticEmail("booking_confirmed", { email: b.customer_email, name: customerNameOf(b) }, {
    ...baseVars(b, carName),
    days: String(tripDays({ pickupDate: b.pickup_date, returnDate: b.return_date })),
    protection_plan: plan?.name || String(b.protection_plan ?? ""),
    extras_list: extrasList,
    estimated_total: formatUsd(Number(b.estimated_total)),
    payment_summary: summary,
  });
}

export async function sendBalanceFailedEmail(b: BookingRecord, failureReason: string): Promise<void> {
  if (!b.customer_email) return;
  const carName = await carNameFor(b.car_id);
  await sendAutomaticEmail("booking_payment_failed", { email: b.customer_email, name: customerNameOf(b) }, {
    ...baseVars(b, carName),
    balance_amount: formatUsd(Number(b.balance_amount ?? 0)),
    failure_reason: failureReason,
    pay_link: payLink(b),
  });
}
