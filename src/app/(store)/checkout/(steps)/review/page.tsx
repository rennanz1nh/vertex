"use client";

import { DAMAGE_HOLD_AMOUNT, DAMAGE_HOLD_RELEASE_DAYS, depositAvailable, formatLongDate, paymentPlan } from "@/lib/booking-payment-plan";
import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/utils";
import { useCheckout, formatUsDate } from "../CheckoutContext";
import StepProgress from "@/components/store/StepProgress";

export default function CheckoutReviewPage() {
  const router = useRouter();
  const { loaded, draft, driver, driverStepComplete, days, breakdown, paymentChoice, setPaymentChoice } = useCheckout();

  useEffect(() => {
    if (loaded && (!draft || !driverStepComplete)) router.replace("/checkout");
  }, [loaded, draft, driverStepComplete, router]);

  if (!loaded || !draft || !driverStepComplete || !breakdown) return null;
  const canSplit = depositAvailable(draft.pickupDate);
  const split = paymentPlan(breakdown.total, draft.pickupDate, undefined, "deposit");

  return (
    <div className="max-w-[800px] mx-auto px-4 py-8">
      <StepProgress current={3} />
      <h1 className="font-serif text-2xl md:text-3xl font-light text-gray-900 mb-1">Review Your Trip</h1>
      <p className="text-xs text-gray-500 mb-6">Step 3 of 4</p>

      {/* Trip details */}
      <div className="border border-gray-200 rounded-sm p-5 mb-6">
        <div className="flex gap-4 pb-4 mb-4 border-b border-gray-100">
          <div className="w-20 h-20 bg-white shrink-0 relative">
            {draft.carImage ? (
              <Image src={draft.carImage} alt={draft.carName} fill className="object-contain p-2" sizes="80px" />
            ) : (
              <div className="w-full h-full bg-gray-100" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">{draft.carName}</p>
            <p className="text-sm text-gray-500 mt-1">
              {formatUsDate(draft.pickupDate)} at {draft.pickupTime} &rarr; {formatUsDate(draft.returnDate)} at{" "}
              {draft.returnTime}
            </p>
            <p className="text-xs text-gray-400 mt-1">{days} day{days > 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Protection plan</span>
          <span className="text-gray-900">{breakdown.plan.name}</span>
        </div>
        {draft.extras.length > 0 && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>Extras</span>
            <span className="text-gray-900">{draft.extras.length} selected</span>
          </div>
        )}
      </div>

      {/* Driver summary */}
      <div className="border border-gray-200 rounded-sm p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Driver information</h2>
          <Link href="/checkout" className="text-xs text-gray-500 hover:text-black underline">
            Edit
          </Link>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-gray-400">Full legal name</dt>
            <dd className="text-gray-900">{driver.fullName}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Email</dt>
            <dd className="text-gray-900">{driver.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Phone</dt>
            <dd className="text-gray-900">{driver.phone}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Date of birth</dt>
            <dd className="text-gray-900">{driver.dateOfBirth}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Driver&apos;s license</dt>
            <dd className="text-gray-900">{driver.licenseNumber} ({driver.licenseState})</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">License expiration</dt>
            <dd className="text-gray-900">{driver.licenseExpiration}</dd>
          </div>
        </dl>
      </div>

      {/* Price breakdown */}
      <div className="bg-gray-50 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Price Breakdown</h2>
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>
            {formatPrice(draft.dailyRate)} &times; {days} day{days > 1 ? "s" : ""}
          </span>
          <span>{formatPrice(breakdown.tripSubtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>{breakdown.plan.name} protection</span>
          <span>{formatPrice(breakdown.protectionTotal)}</span>
        </div>
        {breakdown.extrasTotal > 0 && (
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Extras</span>
            <span>{formatPrice(breakdown.extrasTotal)}</span>
          </div>
        )}
        {breakdown.youngDriverFeeTotal > 0 && (
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Young driver fee</span>
            <span>{formatPrice(breakdown.youngDriverFeeTotal)}</span>
          </div>
        )}
        <div className="border-t border-gray-200 pt-4 mt-2 flex justify-between text-sm font-semibold text-gray-900">
          <span>Trip total</span>
          <span>{formatPrice(breakdown.total)}</span>
        </div>
        <div className="border-t border-dashed border-gray-200 pt-3 mt-3">
          <div className="flex justify-between text-sm text-gray-900">
            <span>Refundable damage deposit</span>
            <span>{formatPrice(DAMAGE_HOLD_AMOUNT)} hold</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Not charged today and not part of the trip total. A {formatPrice(DAMAGE_HOLD_AMOUNT)} hold is placed on your card on
            pick-up day and released automatically {DAMAGE_HOLD_RELEASE_DAYS} days after you return the car, unless there is damage to the vehicle.
          </p>
        </div>
      </div>

      {/* How to pay */}
      <div className="border border-gray-200 rounded-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">How would you like to pay?</h2>
        {canSplit ? (
          <div className="space-y-2" role="radiogroup" aria-label="Payment option">
            {([
              {
                id: "deposit" as const,
                title: `Pay 20% now: ${formatPrice(split.depositAmount)}`,
                detail: `The remaining ${formatPrice(split.balanceAmount)} is charged automatically to the same card on ${formatLongDate(split.balanceDueDate!)}, 5 days before pick-up.`,
              },
              {
                id: "full" as const,
                title: `Pay in full now: ${formatPrice(breakdown.total)}`,
                detail: "One payment today. Nothing else is charged before your trip.",
              },
            ]).map((opt) => (
              <label
                key={opt.id}
                className={`flex items-start gap-3 border rounded-sm p-3 cursor-pointer ${paymentChoice === opt.id ? "border-black bg-gray-50" : "border-gray-200"}`}
              >
                <input
                  type="radio"
                  name="paymentChoice"
                  className="mt-1 accent-black"
                  checked={paymentChoice === opt.id}
                  onChange={() => setPaymentChoice(opt.id)}
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900">{opt.title}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">{opt.detail}</span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            Pick-up is less than 5 days away, so the full {formatPrice(breakdown.total)} is charged when you book.
          </p>
        )}
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-gray-100">
        <button
          onClick={() => router.push("/checkout")}
          className="text-sm text-gray-500 hover:text-black underline"
        >
          &larr; Back
        </button>
        <button
          onClick={() => router.push("/checkout/agreement")}
          className="bg-black text-white text-sm font-medium px-8 py-3 hover:bg-brand transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
