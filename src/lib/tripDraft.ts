"use client";

export * from "@/lib/trip-pricing";
import type { TripDraft } from "@/lib/trip-pricing";

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

