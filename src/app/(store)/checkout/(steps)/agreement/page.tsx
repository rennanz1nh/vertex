"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, PenLine, Printer } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import SignaturePad, { type SignaturePadHandle } from "@/components/store/SignaturePad";
import { RENTAL_AGREEMENT_SECTIONS, RENTAL_AGREEMENT_ACKNOWLEDGMENTS } from "@/lib/rental-agreement";
import { printRentalAgreementTerms } from "@/lib/rental-agreement-print";
import { useCheckout } from "../CheckoutContext";
import StepProgress from "@/components/store/StepProgress";

export default function CheckoutAgreementPage() {
  const router = useRouter();
  const { loaded, draft, driver, driverStepComplete, requested, submitting, submitError, submitBooking } =
    useCheckout();
  const [checked, setChecked] = useState(false);
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const padRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    if (loaded && !requested && (!draft || !driverStepComplete)) router.replace("/checkout");
  }, [loaded, requested, draft, driverStepComplete, router]);

  if (requested) {
    return (
      <div className="max-w-[900px] mx-auto px-4 py-20 text-center">
        <h1 className="font-serif text-2xl md:text-3xl font-light text-gray-900 mb-3">Trip request sent!</h1>
        <p className="text-sm text-gray-600 max-w-md mx-auto mb-8">
          We&apos;ve sent your request to the host. You&apos;ll get a confirmation once it&apos;s approved. No
          payment has been charged yet.
        </p>
        <Link
          href="/products"
          className="inline-block bg-black text-white px-8 py-3 text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          Browse More Vehicles
        </Link>
      </div>
    );
  }

  if (!loaded || !draft || !driverStepComplete) return null;

  const allChecked = checked;
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  function toggle() {
    setChecked((v) => !v);
  }

  function handlePrint() {
    setPrintError(null);
    try {
      printRentalAgreementTerms(driver.fullName || undefined);
    } catch (e) {
      setPrintError(e instanceof Error ? e.message : "Could not open the print window.");
    }
  }

  async function handleSubmit() {
    setSignatureError(null);
    if (!allChecked) return;
    if (!padRef.current || padRef.current.isEmpty()) {
      setSignatureError("Please sign above before continuing.");
      return;
    }
    await submitBooking(padRef.current.toDataURL());
  }

  return (
    <div className="max-w-[800px] mx-auto px-4 py-8">
      <StepProgress current={4} />
      <h1 className="font-serif text-2xl md:text-3xl font-light text-gray-900 mb-1">Rental Agreement</h1>
      <p className="text-xs text-gray-500 mb-6">Step 4 of 4</p>

      <p className="text-xs text-gray-500 mb-4">
        Vertex Rental Car USA LLC &mdash; General Rental Terms. Please read before signing to request your booking.
      </p>

      <div className="border rounded-sm max-h-[45vh] overflow-y-auto p-4 space-y-4 bg-gray-50 mb-6">
        {RENTAL_AGREEMENT_SECTIONS.map((section) => (
          <div key={section.heading}>
            <h3 className="text-xs font-semibold text-gray-900 mb-1">{section.heading}</h3>
            {section.body.map((p, i) => (
              <p key={i} className="text-xs text-gray-600 leading-relaxed mb-1.5">
                {p}
              </p>
            ))}
            {section.bullets && (
              <ul className="list-disc pl-4 space-y-1 mb-1.5">
                {section.bullets.map((b, i) => (
                  <li key={i} className="text-xs text-gray-600 leading-relaxed">
                    {b}
                  </li>
                ))}
              </ul>
            )}
            {section.notice && (
              <div className="border border-amber-300 bg-amber-50 rounded-sm p-2 mt-1.5">
                <p className="text-xs text-amber-900 leading-relaxed font-medium">{section.notice}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-2 mb-6">
        <p className="text-xs font-semibold text-gray-900">Renter&apos;s express acknowledgments</p>
        <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
          <Checkbox checked={checked} onCheckedChange={toggle} className="mt-0.5" />
          <span>
            By checking this box, I agree to all of the following:
            <ul className="list-disc pl-4 mt-1 space-y-1">
              {RENTAL_AGREEMENT_ACKNOWLEDGMENTS.map((text, i) => (
                <li key={i}>{text}</li>
              ))}
            </ul>
          </span>
        </label>
      </div>

      <div className="border-t pt-4 mb-6">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
            <PenLine className="h-3.5 w-3.5" /> Renter signature
          </p>
          <p className="text-[11px] text-gray-400">
            {driver.fullName || "Renter"} &mdash; {today}
          </p>
        </div>
        <SignaturePad ref={padRef} />
        <div className="flex justify-between items-center mt-1.5">
          {signatureError ? <p className="text-xs text-red-600">{signatureError}</p> : <span />}
          <button
            type="button"
            onClick={() => padRef.current?.clear()}
            className="text-xs text-gray-500 hover:text-black underline"
          >
            Clear
          </button>
        </div>
      </div>

      {submitError && <p className="text-xs text-red-600 text-center mb-4">{submitError}</p>}
      {printError && <p className="text-xs text-red-600 text-center mb-4">{printError}</p>}

      <div className="flex justify-between items-center pt-6 border-t border-gray-100">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/checkout/review")}
            disabled={submitting}
            className="text-sm text-gray-500 hover:text-black underline disabled:opacity-60"
          >
            &larr; Back
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="text-sm text-gray-500 hover:text-black underline flex items-center gap-1"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!allChecked || submitting}
          className="bg-black text-white text-sm font-medium px-8 py-3 hover:bg-brand transition-colors disabled:opacity-60 flex items-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Sending request&hellip;
            </>
          ) : (
            "Request to Book"
          )}
        </button>
      </div>
      <p className="text-[11px] text-gray-400 mt-2 text-center">
        No payment is collected &mdash; checkout isn&apos;t connected yet.
      </p>
    </div>
  );
}
