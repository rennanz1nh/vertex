"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/utils";
import { US_STATES } from "@/lib/us-states";
import { useCheckout, formatUsDate } from "./CheckoutContext";
import StepProgress from "@/components/store/StepProgress";

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
        <span className="flex-1 truncate text-gray-600">{file ? file.name : "Tap to upload a photo"}</span>
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

export default function CheckoutDriverInfoPage() {
  const router = useRouter();
  const {
    loaded,
    draft,
    driver,
    updateDriver,
    licenseFront,
    licenseBack,
    pickLicensePhoto,
    errors,
    validateDriverStep,
    days,
    age,
    youngDriverFee,
  } = useCheckout();

  if (!loaded) return null;

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

  function handleContinue() {
    if (validateDriverStep()) router.push("/checkout/review");
  }

  return (
    <div className="max-w-[800px] mx-auto px-4 py-8">
      <StepProgress current={2} />
      <h1 className="font-serif text-2xl md:text-3xl font-light text-gray-900 mb-1">Driver Information</h1>
      <p className="text-xs text-gray-500 mb-6">Step 2 of 4</p>

      {/* Trip summary */}
      <div className="flex gap-4 pb-6 mb-6 border-b border-gray-100">
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
        <Link href="/cart" className="text-xs text-gray-500 hover:text-black underline self-start">
          Edit trip
        </Link>
      </div>

      {/* Driver info */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Driver information</h2>
        <p className="text-xs text-gray-500 mb-4">
          This is required before any trip can be approved. Use a valid, US-issued driver&apos;s license.
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
            {errors.licenseExpiration && <p className="text-xs text-red-600 mt-1">{errors.licenseExpiration}</p>}
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

      <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-100">
        <Link href="/cart" className="text-sm text-gray-500 hover:text-black underline">
          &larr; Back to Trip
        </Link>
        <button
          onClick={handleContinue}
          className="bg-black text-white text-sm font-medium px-8 py-3 hover:bg-brand transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
