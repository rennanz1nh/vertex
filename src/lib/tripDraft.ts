"use client";

export type ProtectionPlanId = "basic" | "standard" | "premium";
export type ExtraId = "additional_driver" | "unlimited_mileage" | "prepaid_refuel";

export const PROTECTION_PLANS: {
  id: ProtectionPlanId;
  name: string;
  pricePerDay: number;
  deductible: string;
  description: string;
}[] = [
  {
    id: "basic",
    name: "Basic",
    pricePerDay: 0,
    deductible: "$3,000 deductible",
    description: "Minimum coverage required to drive. Highest out-of-pocket cost if something happens.",
  },
  {
    id: "standard",
    name: "Standard",
    pricePerDay: 15,
    deductible: "$1,000 deductible",
    description: "Balanced coverage for most trips, with a moderate deductible.",
  },
  {
    id: "premium",
    name: "Premium",
    pricePerDay: 25,
    deductible: "$0 deductible",
    description: "Our most complete protection. Drive with nothing out of pocket if something happens.",
  },
];

export const EXTRAS: { id: ExtraId; name: string; description: string; price: number; perDay: boolean }[] = [
  {
    id: "additional_driver",
    name: "Additional driver",
    description: "Add one more person authorized to drive this car during the trip.",
    price: 10,
    perDay: true,
  },
  {
    id: "unlimited_mileage",
    name: "Unlimited mileage",
    description: "Skip the mileage limit and drive as much as you want.",
    price: 12,
    perDay: true,
  },
  {
    id: "prepaid_refuel",
    name: "Prepaid refuel",
    description: "Return the car with any amount of fuel — we'll handle the rest.",
    price: 35,
    perDay: false,
  },
];

// Turo-style young driver surcharge (per day), on top of the trip price.
export function youngDriverFeePerDay(age: number): number {
  if (age < 21) return 50;
  if (age < 25) return 30;
  return 0;
}

export const MINIMUM_DRIVER_AGE = 18;

export type DriverInfo = {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string; // ISO date
  licenseNumber: string;
  licenseExpiration: string; // ISO date
  licenseState: string;
};

export type TripDraft = {
  carId: string;
  carName: string;
  carImage: string | null;
  dailyRate: number;
  minDriverAge: number;
  pickupDate: string; // ISO date, e.g. 2026-09-20
  pickupTime: string; // HH:mm
  returnDate: string;
  returnTime: string;
  protectionPlan: ProtectionPlanId | null;
  extras: ExtraId[];
  driver: DriverInfo | null;
};

const TRIP_KEY = "vertex_trip_draft";

export function getTripDraft(): TripDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TRIP_KEY);
    return raw ? (JSON.parse(raw) as TripDraft) : null;
  } catch {
    return null;
  }
}

export function saveTripDraft(draft: TripDraft) {
  localStorage.setItem(TRIP_KEY, JSON.stringify(draft));
  window.dispatchEvent(new Event("trip-draft-updated"));
}

export function updateTripDraft(patch: Partial<TripDraft>) {
  const current = getTripDraft();
  if (!current) return;
  saveTripDraft({ ...current, ...patch });
}

export function clearTripDraft() {
  localStorage.removeItem(TRIP_KEY);
  window.dispatchEvent(new Event("trip-draft-updated"));
}

export function tripDays(draft: Pick<TripDraft, "pickupDate" | "returnDate">): number {
  const start = new Date(draft.pickupDate);
  const end = new Date(draft.returnDate);
  const ms = end.getTime() - start.getTime();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return Math.max(1, days);
}

export function ageFromDateOfBirth(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export function tripPriceBreakdown(draft: TripDraft) {
  const days = tripDays(draft);
  const tripSubtotal = draft.dailyRate * days;

  const plan = PROTECTION_PLANS.find((p) => p.id === draft.protectionPlan) || PROTECTION_PLANS[0];
  const protectionTotal = plan.pricePerDay * days;

  const extrasTotal = draft.extras.reduce((sum, id) => {
    const extra = EXTRAS.find((e) => e.id === id);
    if (!extra) return sum;
    return sum + (extra.perDay ? extra.price * days : extra.price);
  }, 0);

  const age = draft.driver ? ageFromDateOfBirth(draft.driver.dateOfBirth) : null;
  const youngDriverFeeDaily = age != null ? youngDriverFeePerDay(age) : 0;
  const youngDriverFeeTotal = youngDriverFeeDaily * days;

  const total = tripSubtotal + protectionTotal + extrasTotal + youngDriverFeeTotal;

  return {
    days,
    tripSubtotal,
    plan,
    protectionTotal,
    extrasTotal,
    age,
    youngDriverFeeDaily,
    youngDriverFeeTotal,
    total,
  };
}
