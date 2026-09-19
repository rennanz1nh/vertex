"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  getTripDraft,
  saveTripDraft,
  clearTripDraft,
  tripDays,
  tripPriceBreakdown,
  ageFromDateOfBirth,
  youngDriverFeePerDay,
  MINIMUM_DRIVER_AGE,
  type TripDraft,
  type DriverInfo,
} from "@/lib/tripDraft";
import { RENTAL_AGREEMENT_VERSION } from "@/lib/rental-agreement";

const emptyDriver: DriverInfo = {
  fullName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  licenseNumber: "",
  licenseExpiration: "",
  licenseState: "",
};

export const MAX_LICENSE_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB
export const ALLOWED_LICENSE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export type DriverErrors = Partial<Record<keyof DriverInfo, string>> & { licenseFront?: string; licenseBack?: string };

type Breakdown = ReturnType<typeof tripPriceBreakdown>;

type CheckoutContextValue = {
  loaded: boolean;
  draft: TripDraft | null;
  driver: DriverInfo;
  updateDriver: (patch: Partial<DriverInfo>) => void;
  licenseFront: File | null;
  licenseBack: File | null;
  pickLicensePhoto: (file: File | null, side: "licenseFront" | "licenseBack") => void;
  errors: DriverErrors;
  validateDriverStep: () => boolean;
  driverStepComplete: boolean;
  days: number;
  breakdown: Breakdown | null;
  age: number | null;
  youngDriverFee: number;
  requested: boolean;
  submitting: boolean;
  submitError: string | null;
  submitBooking: (signatureDataUrl: string) => Promise<boolean>;
};

const CheckoutContext = createContext<CheckoutContextValue | null>(null);

// Shared across the three checkout step pages (/checkout, /checkout/review,
// /checkout/agreement) via the (steps) route group's layout — this is what lets license
// photo File objects and the in-progress driver form survive a client-side navigation
// between those pages (each step is its own route/component, so plain per-page state
// would be lost on every "Continue"). It's still just in-memory: a hard refresh mid-flow
// loses it, same as the file inputs always did — each step guards for that and sends the
// visitor back to /checkout to start over rather than erroring.
export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<TripDraft | null>(null);
  const [driver, setDriver] = useState<DriverInfo>(emptyDriver);
  const [licenseFront, setLicenseFront] = useState<File | null>(null);
  const [licenseBack, setLicenseBack] = useState<File | null>(null);
  const [errors, setErrors] = useState<DriverErrors>({});
  const [requested, setRequested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const d = getTripDraft();
    setDraft(d);
    if (d?.driver) setDriver(d.driver);
    setLoaded(true);
  }, []);

  function updateDriver(patch: Partial<DriverInfo>) {
    setDriver((d) => ({ ...d, ...patch }));
  }

  function pickLicensePhoto(file: File | null, side: "licenseFront" | "licenseBack") {
    setErrors((prev) => ({ ...prev, [side]: undefined }));
    if (!file) {
      if (side === "licenseFront") setLicenseFront(null);
      else setLicenseBack(null);
      return;
    }
    if (!ALLOWED_LICENSE_PHOTO_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, [side]: "Use a JPG, PNG, WEBP or HEIC photo." }));
      return;
    }
    if (file.size > MAX_LICENSE_PHOTO_BYTES) {
      setErrors((prev) => ({ ...prev, [side]: "That photo is too large (max 10MB)." }));
      return;
    }
    if (side === "licenseFront") setLicenseFront(file);
    else setLicenseBack(file);
  }

  const days = draft ? tripDays(draft) : 0;
  const breakdown = draft ? tripPriceBreakdown({ ...draft, driver: driver.dateOfBirth ? driver : null }) : null;
  const age = driver.dateOfBirth ? ageFromDateOfBirth(driver.dateOfBirth) : null;
  const youngDriverFee = age != null ? youngDriverFeePerDay(age) : 0;

  function validateDriverStep(): boolean {
    if (!draft) return false;
    const requiredAge = Math.max(MINIMUM_DRIVER_AGE, draft.minDriverAge || MINIMUM_DRIVER_AGE);
    const next: DriverErrors = {};
    if (!driver.fullName.trim()) next.fullName = "Enter the driver's full legal name.";
    if (!driver.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(driver.email.trim())) {
      next.email = "Enter a valid email address.";
    }
    if (!driver.phone.trim()) next.phone = "Enter a phone number.";
    if (!driver.dateOfBirth) {
      next.dateOfBirth = "Enter a date of birth.";
    } else if (ageFromDateOfBirth(driver.dateOfBirth) < requiredAge) {
      next.dateOfBirth = `Drivers must be at least ${requiredAge} years old for this vehicle.`;
    }
    if (!driver.licenseNumber.trim()) next.licenseNumber = "Enter a driver's license number.";
    if (!driver.licenseExpiration) {
      next.licenseExpiration = "Enter the license expiration date.";
    } else if (new Date(driver.licenseExpiration).getTime() < Date.now()) {
      next.licenseExpiration = "This license has expired.";
    }
    if (!driver.licenseState) next.licenseState = "Select the issuing state.";
    if (!licenseFront) next.licenseFront = "Upload a photo of the front of the license.";
    if (!licenseBack) next.licenseBack = "Upload a photo of the back of the license.";
    setErrors(next);
    if (Object.keys(next).length > 0) return false;
    saveTripDraft({ ...draft, driver });
    return true;
  }

  const driverStepComplete = Boolean(
    draft &&
      driver.fullName.trim() &&
      driver.email.trim() &&
      driver.phone.trim() &&
      driver.dateOfBirth &&
      driver.licenseNumber.trim() &&
      driver.licenseExpiration &&
      driver.licenseState &&
      licenseFront &&
      licenseBack
  );

  async function submitBooking(signatureDataUrl: string): Promise<boolean> {
    if (!draft || !breakdown || !licenseFront || !licenseBack) return false;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const signatureBlob = await (await fetch(signatureDataUrl)).blob();

      const formData = new FormData();
      formData.append(
        "payload",
        JSON.stringify({
          carId: draft.carId,
          pickupDate: draft.pickupDate,
          pickupTime: draft.pickupTime,
          returnDate: draft.returnDate,
          returnTime: draft.returnTime,
          dailyRate: draft.dailyRate,
          protectionPlan: breakdown.plan.id,
          extras: draft.extras,
          driver,
          breakdown: {
            tripSubtotal: breakdown.tripSubtotal,
            protectionTotal: breakdown.protectionTotal,
            extrasTotal: breakdown.extrasTotal,
            youngDriverFeeTotal: breakdown.youngDriverFeeTotal,
            total: breakdown.total,
          },
          rentalAgreementVersion: RENTAL_AGREEMENT_VERSION,
        })
      );
      formData.append("licenseFront", licenseFront);
      formData.append("licenseBack", licenseBack);
      formData.append("rentalAgreementSignature", signatureBlob, "signature.png");

      const res = await fetch("/api/bookings/request", { method: "POST", body: formData });
      if (!res.ok) throw new Error(await res.text());
      setRequested(true);
      clearTripDraft();
      return true;
    } catch (e) {
      console.error("Failed to submit booking request:", e);
      setSubmitError("We couldn't send your request. Please try again.");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CheckoutContext.Provider
      value={{
        loaded,
        draft,
        driver,
        updateDriver,
        licenseFront,
        licenseBack,
        pickLicensePhoto,
        errors,
        validateDriverStep,
        driverStepComplete,
        days,
        breakdown,
        age,
        youngDriverFee,
        requested,
        submitting,
        submitError,
        submitBooking,
      }}
    >
      {children}
    </CheckoutContext.Provider>
  );
}

export function useCheckout() {
  const ctx = useContext(CheckoutContext);
  if (!ctx) throw new Error("useCheckout must be used within CheckoutProvider");
  return ctx;
}

export function formatUsDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
