import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { MouseEvent } from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * True when a click landed on (or inside) an interactive element — used to let a
 * row-level "open view" onClick coexist with buttons/inputs/checkboxes inside the row.
 */
export function isInteractiveClickTarget(e: MouseEvent): boolean {
  const el = e.target as HTMLElement;
  return !!el.closest(
    'button, a, input, textarea, select, label, [role="checkbox"], [role="switch"], [role="menuitem"]'
  );
}

/**
 * Parses a price stored as a free-form string into a number.
 * Handles the spreadsheet format used in Supabase, e.g. " $26,04 ", " N/A ",
 * "$1,250.00", "18.04". Returns 0 when there is no valid/usable price.
 */
export function parsePrice(value: string | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  let s = value.trim();
  if (!s || /n\/?a/i.test(s)) return 0;

  // strip currency symbols and spaces, keep digits, separators and sign
  s = s.replace(/[^0-9.,-]/g, "");
  if (!s) return 0;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // the right-most separator is the decimal one; the other is a thousands sep
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    // single comma → decimal separator (Brazilian spreadsheet format)
    s = s.replace(",", ".");
  }

  const num = parseFloat(s);
  return Number.isFinite(num) ? num : 0;
}

export function formatPrice(price: number | string | null): string {
  const num = typeof price === "string" ? parsePrice(price) : price ?? 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}
