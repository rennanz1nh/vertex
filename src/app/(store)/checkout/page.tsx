"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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
import { formatPrice } from "@/lib/utils";
import { US_STATES } from "@/lib/us-states";
import RentalAgreementModal from "@/components/store/RentalAgreementModal";
import { RENTAL_AGREEMENT_VERSION } from "@/lib/rental-agreement";

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

function LicensePhotoField({
  label,
  file,
  error,
  onChange,
}: {
  label: string;
  file: File | null;
  error?: string;
  onChange: (file: File | null) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <label
        className={`flex items-center gap-3 border rounded-sm px-3 py-2 text-sm cursor-pointer hover:border-gray-400 ${
          error ? "border-red-400" : "border-gray-300"
        }`}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="w-10 h-10 object-cover rounded-sm shrink-0" />
        ) : (
          <span className="w-10 h-10 rounded-sm bg-gray-100 shrink-0" />
        )}
        <span className="flex-1 truncate text-gray-600">
          {file ? file.name : "Tap to upload a photo"}
        </span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
      </label>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

const emptyDriver: DriverInfo = {
  fullName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  licenseNumber: "",
  licenseExpiration: "",
  licenseState: "",
};

const MAX_LICENSE_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_LICENSE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export default function CheckoutPage() {
  const [draft, setDraft] = useState<TripDraft | null>(null);
  const [driver, setDriver] = useState<DriverInfo>(emptyDriver);
  const [licenseFront, setLicenseFront] = useState<File | null>(null);
  const [licenseBack, setLicenseBack] = useState<File | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof DriverInfo, string>> & { licenseFront?: string; licenseBack?: string }>({});
  const [requested, setRequested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [agreementOpen, setAgreementOpen] = useState(false);

  useEffect(() => {
    const load = () => {
      const d = getTripDraft();
      setDraft(d);
      if (d?.driver) setDriver(d.driver);
    };
    load();
  }, []);

  if (requested) {
    return (
      <div className="max-w-[900px] mx-auto px-4 py-20 text-center">
        <h1 className="font-serif text-2xl md:text-3xl font-light text-gray-900 mb-3">
          Trip request sent!
        </h1>
        <p className="text-sm text-gray-600 max-w-md mx-auto mb-8">
          We&apos;ve sent your request to the host. You&apos;ll get a confirmation once it&apos;s
          approved. No payment has been charged yet.
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

  if (!draft) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 py-20 text-center">
        <h1 className="font-serif text-2xl font-light text-gray-900 mb-3">No trip selected yet</h1>
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
  const breakdown = tripPriceBreakdown({ ...draft, driver: driver.dateOfBirth ? driver : null });
  const age = driver.dateOfBirth ? ageFromDateOfBirth(driver.dateOfBirth) : null;
  const youngDriverFee = age != null ? youngDriverFeePerDay(age) : 0;

  function updateDriver(patch: Partial<DriverInfo>) {
    setDriver((d) => ({ ...d, ...patch }));
  }

  function validate(): boolean {
    const requiredAge = Math.max(MINIMUM_DRIVER_AGE, draft?.minDriverAge || MINIMUM_DRIVER_AGE);
    const next: Partial<Record<keyof DriverInfo, string>> & { licenseFront?: string; licenseBack?: string } = {};
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
    return Object.keys(next).length === 0;
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

  function handleRequestToBook() {
    if (!draft) return;
    if (!validate()) return;
    if (!licenseFront || !licenseBack) return;
    saveTripDraft({ ...draft, driver });
    setSubmitError(null);
    setAgreementOpen(true);
  }

  async function handleAgreementAccept(signatureDataUrl: string) {
    if (!draft || !licenseFront || !licenseBack) return;

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
      setAgreementOpen(false);
      setRequested(true);
      clearTripDraft();
    } catch (e) {
      console.error("Failed to submit booking request:", e);
      setSubmitError("We couldn't send your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      <h1 className="font-serif text-2xl md:text-3xl font-light text-gray-900 mb-8">
        Review &amp; Request to Book
      </h1>

      <div className="flex flex-col lg:flex-row gap-10">
        <div className="flex-1">
          {/* Trip summary */}
          <div className="flex gap-4 pb-6 mb-8 border-b border-gray-100">
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
              <p className="text-xs text-gray-400 mt-1">
                {days} day{days > 1 ? "s" : ""} &middot; {breakdown.plan.name} protection
                {draft.extras.length > 0 ? ` · ${draft.extras.length} extra${draft.extras.length > 1 ? "s" : ""}` : ""}
              </p>
            </div>
            <Link href="/cart" className="text-xs text-gray-500 hover:text-black underline self-start">
              Edit trip
            </Link>
          </div>

          {/* Driver info */}
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Driver information</h2>
            <p className="text-xs text-gray-500 mb-4">
              This is required before any trip can be approved. Use a valid, US-issued driver&apos;s
              license.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Full legal name</label>
                <input
                  type="text"
                  value={driver.fullName}
                  onChange={(e) => updateDriver({ fullName: e.target.value })}
                  placeholder="As shown on your driver's license"
                  className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
                />
                {errors.fullName && <p className="text-xs text-red-600 mt-1">{errors.fullName}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                <input
                  type="email"
                  value={driver.email}
                  onChange={(e) => updateDriver({ email: e.target.value })}
                  placeholder="you@example.com"
                  className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
                />
                {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                <input
                  type="tel"
                  value={driver.phone}
                  onChange={(e) => updateDriver({ phone: e.target.value })}
                  placeholder="(555) 555-5555"
                  className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
                />
                {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date of birth</label>
                <input
                  type="date"
                  lang="en-US"
                  value={driver.dateOfBirth}
                  onChange={(e) => updateDriver({ dateOfBirth: e.target.value })}
                  className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
                />
                {errors.dateOfBirth && <p className="text-xs text-red-600 mt-1">{errors.dateOfBirth}</p>}
                {!errors.dateOfBirth && age != null && youngDriverFee > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    A young driver fee of {formatPrice(youngDriverFee)}/day applies for drivers under 25.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Driver&apos;s license number</label>
                <input
                  type="text"
                  value={driver.licenseNumber}
                  onChange={(e) => updateDriver({ licenseNumber: e.target.value })}
                  className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
                />
                {errors.licenseNumber && <p className="text-xs text-red-600 mt-1">{errors.licenseNumber}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">License expiration date</label>
                <input
                  type="date"
                  lang="en-US"
                  value={driver.licenseExpiration}
                  onChange={(e) => updateDriver({ licenseExpiration: e.target.value })}
                  className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
                />
                {errors.licenseExpiration && (
                  <p className="text-xs text-red-600 mt-1">{errors.licenseExpiration}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Issuing state</label>
                <select
                  value={driver.licenseState}
                  onChange={(e) => updateDriver({ licenseState: e.target.value })}
                  className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm bg-white"
                >
                  <option value="">Select state</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {errors.licenseState && <p className="text-xs text-red-600 mt-1">{errors.licenseState}</p>}
              </div>

              <LicensePhotoField
                label="License photo (front)"
                file={licenseFront}
                error={errors.licenseFront}
                onChange={(f) => pickLicensePhoto(f, "licenseFront")}
              />
              <LicensePhotoField
                label="License photo (back)"
                file={licenseBack}
                error={errors.licenseBack}
                onChange={(f) => pickLicensePhoto(f, "licenseBack")}
              />
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
            {breakdown.youngDriverFeeTotal > 0 && (
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Young driver fee</span>
                <span>{formatPrice(breakdown.youngDriverFeeTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-gray-400 mb-4 mt-2">
              <span>Taxes &amp; fees</span>
              <span>Not calculated (no checkout yet)</span>
            </div>
            <div className="border-t border-gray-200 pt-4 flex justify-between text-sm font-semibold text-gray-900 mb-6">
              <span>Estimated total</span>
              <span>{formatPrice(breakdown.total)}</span>
            </div>

            <button
              onClick={handleRequestToBook}
              disabled={submitting}
              className="block w-full bg-black text-white text-sm font-medium py-3 text-center hover:bg-brand transition-colors disabled:opacity-60"
            >
              Request to Book
            </button>
            <p className="text-[11px] text-gray-400 mt-2 text-center">
              No payment is collected — checkout isn&apos;t connected yet.
            </p>
            <Link
              href="/cart"
              className="block w-full text-center text-sm text-gray-500 hover:text-black mt-3 underline"
            >
              Back to Trip
            </Link>
          </div>
        </div>
      </div>

      <RentalAgreementModal
        open={agreementOpen}
        renterName={driver.fullName}
        submitting={submitting}
        error={submitError}
        onClose={() => setAgreementOpen(false)}
        onAccept={handleAgreementAccept}
      />
    </div>
  );
}
