"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import StripePaymentForm from "@/components/store/StripePaymentForm";
import { formatLongDate, formatUsd } from "@/lib/booking-payment-plan";

type Summary = {
  carName: string;
  pickupDate: string;
  pickupTime: string;
  returnDate: string;
  status: string;
  total: number;
  depositAmount: number;
  balanceAmount: number;
  balanceDueDate: string | null;
  balanceStatus: string;
};

// The link in the "payment failed" email: pay the remaining balance with any card.
function PayBalance() {
  const params = useSearchParams();
  const id = params.get("id");
  const token = params.get("token");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [loadError, setError] = useState<string | null>(null);
  const error = !id || !token ? "This payment link is incomplete. Please use the link from your email." : loadError;

  useEffect(() => {
    if (!id || !token) return;
    (async () => {
      const r = await fetch(`/api/bookings/${id}/pay?token=${encodeURIComponent(token)}`);
      if (!r.ok) return setError("We couldn't find this booking. Please use the link from your email.");
      const s = (await r.json()) as Summary;
      setSummary(s);
      if (s.balanceStatus === "paid") return setPaid(true);
      const i = await fetch(`/api/bookings/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "intent" }),
      });
      const d = await i.json();
      if (d.status === "paid") return setPaid(true);
      if (!i.ok || !d.clientSecret) return setError(d.error || "This booking has no balance to pay.");
      setClientSecret(d.clientSecret);
    })().catch(() => setError("Something went wrong. Please try again."));
  }, [id, token]);

  async function onSuccess() {
    await fetch(`/api/bookings/${id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action: "complete" }),
    }).catch(() => null);
    setPaid(true);
  }

  if (error) return <p className="text-sm text-red-600 text-center">{error}</p>;
  if (!summary) return <p className="text-sm text-gray-500 flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading&hellip;</p>;

  return (
    <>
      <h1 className="font-serif text-2xl md:text-3xl font-light text-gray-900 mb-1">{paid ? "Thank you, you're all paid!" : "Pay your remaining balance"}</h1>
      <p className="text-xs text-gray-500 mb-6">
        {summary.carName} &middot; {formatLongDate(summary.pickupDate)} at {summary.pickupTime} &rarr; {formatLongDate(summary.returnDate)}
      </p>
      <div className="border rounded-sm p-4 mb-6 text-sm space-y-2 bg-gray-50">
        <div className="flex justify-between text-gray-600"><span>Trip total</span><span>{formatUsd(summary.total)}</span></div>
        <div className="flex justify-between text-gray-600"><span>Deposit paid</span><span>&minus;{formatUsd(summary.depositAmount)}</span></div>
        <div className="flex justify-between border-t pt-2 font-medium text-gray-900">
          <span>{paid ? "Balance paid" : "Balance due"}</span><span>{formatUsd(summary.balanceAmount)}</span>
        </div>
      </div>
      {!paid && clientSecret && id && token && (
        <StripePaymentForm
          clientSecret={clientSecret}
          payLabel={`Pay ${formatUsd(summary.balanceAmount)}`}
          returnUrl={`${window.location.origin}/booking/pay?id=${id}&token=${token}`}
          onSuccess={onSuccess}
        />
      )}
      {paid && <p className="text-sm text-gray-600">We&apos;ll see you at pick-up. A receipt was sent to your email.</p>}
    </>
  );
}

export default function PayBalancePage() {
  return (
    <div className="max-w-[560px] mx-auto px-4 py-12">
      <Suspense fallback={null}>
        <PayBalance />
      </Suspense>
    </div>
  );
}
