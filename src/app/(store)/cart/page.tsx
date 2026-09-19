"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getTripDraft,
  saveTripDraft,
  tripDays,
  tripPriceBreakdown,
  PROTECTION_PLANS,
  EXTRAS,
  type TripDraft,
  type ProtectionPlanId,
  type ExtraId,
} from "@/lib/tripDraft";
import { formatPrice } from "@/lib/utils";
import StepProgress from "@/components/store/StepProgress";

function formatUsDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function TripPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<TripDraft | null>(null);

  useEffect(() => {
    const refresh = () => setDraft(getTripDraft());
    refresh();
    window.addEventListener("trip-draft-updated", refresh);
    return () => window.removeEventListener("trip-draft-updated", refresh);
  }, []);

  if (!draft) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 py-20 text-center">
        <h1 className="font-serif text-2xl font-light text-gray-900 mb-3">No trip selected yet</h1>
        <p className="text-sm text-gray-500 mb-6">Pick a vehicle and your trip dates to get started.</p>
        <Link
          href="/products"
          className="inline-block bg-black text-white px-8 py-3 text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          Browse Vehicles
        </Link>
      </div>
    );
  }

  const days = tripDays(draft);
  const breakdown = tripPriceBreakdown({ ...draft, protectionPlan: draft.protectionPlan || "basic" });

  function setProtectionPlan(id: ProtectionPlanId) {
    if (!draft) return;
    const updated = { ...draft, protectionPlan: id };
    setDraft(updated);
    saveTripDraft(updated);
  }

  function toggleExtra(id: ExtraId) {
    if (!draft) return;
    const has = draft.extras.includes(id);
    const extras = has ? draft.extras.filter((e) => e !== id) : [...draft.extras, id];
    const updated = { ...draft, extras };
    setDraft(updated);
    saveTripDraft(updated);
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      <StepProgress current={1} />
      <h1 className="font-serif text-2xl md:text-3xl font-light text-gray-900 mb-1">Your Trip</h1>
      <p className="text-xs text-gray-500 mb-6">Step 1 of 4</p>

      <div className="flex flex-col lg:flex-row gap-10">
        <div className="flex-1">
          {/* Trip summary card */}
          <div className="flex gap-4 pb-6 mb-6 border-b border-gray-100">
            <div className="w-24 h-24 bg-white shrink-0 relative">
              {draft.carImage ? (
                <Image src={draft.carImage} alt={draft.carName} fill className="object-contain p-2" sizes="96px" />
              ) : (
                <div className="w-full h-full bg-gray-100" />
              )}
            </div>
            <div className="flex-1">
              <Link href={`/products/${draft.carId}`} className="text-sm font-medium text-gray-900 hover:underline">
                {draft.carName}
              </Link>
              <p className="text-sm text-gray-500 mt-1">
                {formatUsDate(draft.pickupDate)} at {draft.pickupTime} &rarr; {formatUsDate(draft.returnDate)} at{" "}
                {draft.returnTime}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {days} day{days > 1 ? "s" : ""} &middot; {formatPrice(draft.dailyRate)}/day
              </p>
              <Link
                href={`/products/${draft.carId}`}
                className="inline-block text-xs text-gray-500 hover:text-black underline mt-2"
              >
                Change dates
              </Link>
            </div>
          </div>

          {/* Protection plan */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Choose a protection plan</h2>
            <p className="text-xs text-gray-500 mb-4">
              Every trip includes a protection plan. The less you pay, the higher your responsibility if
              something happens.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PROTECTION_PLANS.map((plan) => {
                const active = (draft.protectionPlan || "basic") === plan.id;
                return (
                  <button
                    key={plan.id}
                    onClick={() => setProtectionPlan(plan.id)}
                    className={`text-left border rounded-sm p-4 transition-colors ${
                      active ? "border-black ring-1 ring-black" : "border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900">{plan.name}</p>
                    <p className="text-sm text-brand font-medium mt-1">
                      {plan.pricePerDay === 0 ? "Included" : `${formatPrice(plan.pricePerDay)}/day`}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">{plan.deductible}</p>
                    <p className="text-xs text-gray-500 mt-1">{plan.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Extras */}
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Add extras</h2>
            <div className="divide-y divide-gray-100 border-t border-b border-gray-100">
              {EXTRAS.map((extra) => {
                const checked = draft.extras.includes(extra.id);
                return (
                  <label
                    key={extra.id}
                    className="flex items-start gap-3 py-4 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleExtra(extra.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{extra.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{extra.description}</p>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-nowrap">
                      {formatPrice(extra.price)}
                      {extra.perDay ? "/day" : ""}
                    </p>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="lg:w-80 shrink-0">
          <div className="bg-gray-50 p-6 sticky top-24">
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
            <div className="flex justify-between text-xs text-gray-400 mb-4 mt-2">
              <span>Taxes &amp; fees</span>
              <span>Calculated at review</span>
            </div>
            <div className="border-t border-gray-200 pt-4 flex justify-between text-sm font-semibold text-gray-900 mb-6">
              <span>Estimated total</span>
              <span>{formatPrice(breakdown.total)}</span>
            </div>
            <button
              onClick={() => router.push("/checkout")}
              className="block w-full bg-black text-white text-sm font-medium py-3 text-center hover:bg-brand transition-colors"
            >
              Continue
            </button>
            <Link
              href="/products"
              className="block w-full text-center text-sm text-gray-500 hover:text-black mt-3 underline"
            >
              Browse Other Vehicles
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
