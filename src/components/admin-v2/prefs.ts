"use client";

import { useSyncExternalStore } from "react";

// Per-browser admin preferences (V2 on/off, theme, collapsed rail). Mirrored in memory so
// toggles still work for the session when localStorage is blocked.
const PREF_EVENT = "admin-v2-pref";
const memoryPrefs = new Map<string, string>();

function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? memoryPrefs.get(key) ?? null;
  } catch {
    return memoryPrefs.get(key) ?? null;
  }
}

export function writePref(key: string, value: string) {
  memoryPrefs.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Blocked storage: the in-memory value still applies until reload.
  }
  window.dispatchEvent(new Event(PREF_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(PREF_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(PREF_EVENT, onChange);
  };
}

export function usePref(key: string): string | null {
  return useSyncExternalStore(subscribe, () => readPref(key), () => null);
}

export const THEME_KEY = "admin-v2-theme";
export const RAIL_KEY = "admin-v2-rail";
