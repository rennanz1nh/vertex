"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import StripePaymentForm from "@/components/store/StripePaymentForm";
import { DAMAGE_HOLD_RELEASE_DAYS, formatLongDate, formatUsd } from "@/lib/booking-payment-plan";

type Summary = {
  carName: string;
  pickupDate: string;
  pickupTime: string;
  returnDate: string;
  returnTime: string;
  status: string;
  holdAmount: number;
  holdStatus: string;
  releaseAt: string;
};

// The link in the "damage deposit could not be placed" email: authorize the $99 hold with any card.
function AuthorizeHold() {
  const params = useSearchParams();
  const id = params.get("id");
  const token = params.get("token");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [held, setHeld] = useState(false);
  const [loadError, setError] = useState<string | null>(null);
  const error = !id || !token ? "This link is incomplete. Please use the link from your email." : loadError;

  useEffect(() => {
    if (!id || !token) return;
    (async () => {
      const r = await fetch(`/api/bookings/${id}/hold?token=${encodeURIComponent(token)}`);
      if (!r.ok) return setError("We couldn't find this booking. Please use the link from your email.");
      const s = (await r.json()) as Summary;
      setSummary(s);
      if (s.holdStatus === "held") return setHeld(true);
      const i = await fetch(`/api/bookings/${id}/hold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "intent" }),
      });
      const d = await i.json();
      if (d.status === "held") return setHeld(true);
      if (!i.ok || !d.clientSecret) return setError(d.error || "There is no damage deposit to authorize on this booking.");
      setClientSecret(d.clientSecret);
    })().catch(() => setError("Something went wrong. Please try again."));
  }, [id, token]);

  async function onSuccess() {
    await fetch(`/api/bookings/${id}/hold`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action: "complete" }),
    }).catch(() => null);
    setHeld(true);
  }

  if (error) return <p className="text-sm text-red-600 text-center">{error}</p>;
  if (!summary) return <p className="text-sm text-gray-500 flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading&hellip;</p>;
  const amount = formatUsd(summary.holdAmount);

  return (
    <>
      <h1 className="font-serif text-2xl md:text-3xl font-light text-gray-900 mb-1">{held ? "Thank you, the deposit is authorized!" : "Authorize your damage deposit"}</h1>
      <p className="text-xs text-gray-500 mb-6">
        {summary.carName} &middot; {formatLongDate(summary.pickupDate)} at {summary.pickupTime} &rarr; {formatLongDate(summary.returnDate)} at {summary.returnTime}
      </p>
      <div className="border rounded-sm p-4 mb-6 text-sm space-y-2 bg-gray-50">
        <div className="flex justify-between font-medium text-gray-900"><span>Refundable damage deposit (hold)</span><span>{amount}</span></div>
        <p className="text-xs text-gray-600">
          This is a hold on your card, not a charge. It is released automatically {DAMAGE_HOLD_RELEASE_DAYS} days after you return the car, unless there is damage to the vehicle.
        </p>
      </div>
      {!held && clientSecret && id && token && (
        <StripePaymentForm
          clientSecret={clientSecret}
          payLabel={`Authorize ${amount} hold`}
          returnUrl={`${window.location.origin}/booking/hold?id=${id}&token=${token}`}
          consent={`By authorizing, you allow Vertex Rental Car USA LLC to hold ${amount} on this card and to place a new hold on it if your trip outlasts this one. The hold is released ${DAMAGE_HOLD_RELEASE_DAYS} days after you return the car, unless there is damage.`}
          onSuccess={onSuccess}
        />
      )}
      {held && <p className="text-sm text-gray-600">You&apos;re all set. Nothing was charged; the hold comes off your card {DAMAGE_HOLD_RELEASE_DAYS} days after you return the car.</p>}
    </>
  );
}

export default function AuthorizeHoldPage() {
  return (
    <div className="max-w-[560px] mx-auto px-4 py-12">
      <Suspense fallback={null}>
        <AuthorizeHold />
      </Suspense>
    </div>
  );
}
