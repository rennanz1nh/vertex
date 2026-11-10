"use client";

import { useEffect, useRef, useState } from "react";
import { loadStripe, type Stripe, type StripeElements } from "@stripe/stripe-js";
import { Loader2, Lock } from "lucide-react";

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe() {
  stripePromise ??= loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  return stripePromise;
}

type Props = {
  clientSecret: string;
  payLabel: string;
  /** Where Stripe sends the customer back after a bank (3-D Secure) redirect. */
  returnUrl: string;
  /** Shown above the button: what the customer authorizes. */
  consent?: string;
  onSuccess: () => void | Promise<void>;
};

/** Stripe Payment Element (card) for a PaymentIntent created on the server. */
export default function StripePaymentForm({ clientSecret, payLabel, returnUrl, consent, onSuccess }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [elements, setElements] = useState<StripeElements | null>(null);
  const [ready, setReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    getStripe().then((s) => {
      if (cancelled || !mountRef.current) return;
      if (!s) {
        setLoadFailed(true);
        return;
      }
      const els = s.elements({
        clientSecret,
        appearance: { theme: "stripe", variables: { colorPrimary: "#111111", borderRadius: "2px", fontSizeBase: "14px" } },
      });
      const el = els.create("payment", { layout: "tabs" });
      el.on("ready", () => setReady(true));
      // e.g. a wrong publishable key or a PaymentIntent from another Stripe account/mode.
      el.on("loaderror", (event) => {
        console.error("Stripe Payment Element failed to load", event.error);
        setLoadFailed(true);
      });
      el.mount(mountRef.current);
      destroy = () => el.destroy();
      setStripe(s);
      setElements(els);
    });
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [clientSecret]);

  async function pay() {
    if (!stripe || !elements) return;
    setPaying(true);
    setError(null);
    const { error: err, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: returnUrl },
    });
    if (err) {
      setError(err.message || "The payment could not be completed. Please try another card.");
      setPaying(false);
      return;
    }
    // "requires_capture": an authorization (the damage-deposit hold) went through.
    if (paymentIntent && ["succeeded", "processing", "requires_capture"].includes(paymentIntent.status)) {
      await onSuccess();
    } else {
      setError("The payment was not completed. Please try again.");
    }
    setPaying(false);
  }

  return (
    <div className="space-y-4">
      <div ref={mountRef} className="min-h-[120px]" />
      {loadFailed && (
        <p className="text-sm text-red-600">
          We couldn&apos;t load the secure payment form. Your card has not been charged. Please try again in a few minutes or contact us.
        </p>
      )}
      {!ready && !loadFailed && (
        <p className="text-xs text-gray-500 flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading secure payment form&hellip;
        </p>
      )}
      {consent && <p className="text-[11px] leading-relaxed text-gray-500">{consent}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={pay}
        disabled={!ready || paying}
        className="w-full bg-black text-white text-sm font-medium px-8 py-3 hover:bg-brand transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        {paying ? "Processing…" : payLabel}
      </button>
    </div>
  );
}
