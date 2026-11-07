"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { clearTripDraft } from "@/lib/tripDraft";

// Where Stripe brings the customer back after a bank (3-D Secure) redirect at checkout.
function Confirmed() {
  const params = useSearchParams();
  const id = params.get("id");
  const token = params.get("token");
  const [fetched, setStatus] = useState<string | null>(null);
  const status = !id || !token ? "missing" : fetched;

  useEffect(() => {
    if (!id || !token) return;
    fetch(`/api/bookings/${id}/finalize`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then((r) => r.json())
      .then((d) => {
        setStatus(d.status ?? "error");
        if (d.status === "confirmed") clearTripDraft();
      })
      .catch(() => setStatus("error"));
  }, [id, token]);

  if (!status) {
    return <p className="text-sm text-gray-500 flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Confirming your payment&hellip;</p>;
  }
  const ok = status === "confirmed" || status === "processing";
  return (
    <>
      <h1 className="font-serif text-2xl md:text-3xl font-light text-gray-900 mb-3">{ok ? "Your trip is booked!" : "Payment not completed"}</h1>
      <p className="text-sm text-gray-600 max-w-md mx-auto mb-8">
        {status === "confirmed" && "We've emailed your confirmation with the payment schedule."}
        {status === "processing" && "Your payment is processing. We'll email your confirmation as soon as it clears."}
        {!ok && "Your card was not charged. Please go back and try again, or use another card."}
      </p>
      <Link href={ok ? "/products" : "/checkout"} className="inline-block bg-black text-white px-8 py-3 text-sm font-medium hover:bg-gray-800 transition-colors">
        {ok ? "Browse More Vehicles" : "Back to checkout"}
      </Link>
    </>
  );
}

export default function BookingConfirmedPage() {
  return (
    <div className="max-w-[900px] mx-auto px-4 py-20 text-center">
      <Suspense fallback={null}>
        <Confirmed />
      </Suspense>
    </div>
  );
}
