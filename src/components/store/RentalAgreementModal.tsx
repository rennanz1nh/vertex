"use client";

import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, PenLine } from "lucide-react";
import SignaturePad, { type SignaturePadHandle } from "./SignaturePad";
import { RENTAL_AGREEMENT_SECTIONS, RENTAL_AGREEMENT_ACKNOWLEDGMENTS } from "@/lib/rental-agreement";

type Props = {
  open: boolean;
  renterName: string;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onAccept: (signatureDataUrl: string) => void;
};

export default function RentalAgreementModal({ open, renterName, submitting, error, onClose, onAccept }: Props) {
  const [checked, setChecked] = useState<boolean[]>(() => RENTAL_AGREEMENT_ACKNOWLEDGMENTS.map(() => false));
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const padRef = useRef<SignaturePadHandle>(null);

  const allChecked = checked.every(Boolean);
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  function toggle(i: number) {
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  function handleAccept() {
    setSignatureError(null);
    if (!allChecked) return;
    if (!padRef.current || padRef.current.isEmpty()) {
      setSignatureError("Please sign above before continuing.");
      return;
    }
    onAccept(padRef.current.toDataURL());
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rental Agreement</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p className="text-xs text-gray-500">
            Vertex Rental Car USA LLC — General Rental Terms. Please read before signing to request your
            booking.
          </p>

          <div className="border rounded-sm max-h-[38vh] overflow-y-auto p-4 space-y-4 bg-gray-50">
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

          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-900">Renter&apos;s express acknowledgments</p>
            {RENTAL_AGREEMENT_ACKNOWLEDGMENTS.map((text, i) => (
              <label key={i} className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
                <Checkbox checked={checked[i]} onCheckedChange={() => toggle(i)} className="mt-0.5" />
                <span>{text}</span>
              </label>
            ))}
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                <PenLine className="h-3.5 w-3.5" /> Renter signature
              </p>
              <p className="text-[11px] text-gray-400">
                {renterName || "Renter"} — {today}
              </p>
            </div>
            <SignaturePad ref={padRef} />
            <div className="flex justify-between items-center mt-1.5">
              {signatureError ? (
                <p className="text-xs text-red-600">{signatureError}</p>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => padRef.current?.clear()}
                className="text-xs text-gray-500 hover:text-black underline"
              >
                Clear
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-red-600 text-center">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t mt-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleAccept} disabled={!allChecked || submitting} className="bg-black hover:bg-brand">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending request…
              </>
            ) : (
              "I Agree & Sign"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
