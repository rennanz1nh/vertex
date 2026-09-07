"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Site-wide "which buttons get clicked" tracking for the Website Analytics page — one
 * delegated listener instead of hand-tagging every button, so new buttons are covered
 * automatically. Reports through the same gtag() GA4 already uses for pageviews
 * (see SiteScripts.tsx); does nothing if GA4 isn't configured (gtag undefined).
 */
export function ButtonClickTracker() {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!window.gtag) return;
      const target = e.target as HTMLElement | null;
      const el = target?.closest('button, a, [role="button"], [data-track-label]') as HTMLElement | null;
      if (!el) return;

      const label =
        el.getAttribute("data-track-label") ||
        el.getAttribute("aria-label") ||
        el.textContent?.trim().replace(/\s+/g, " ").slice(0, 60) ||
        el.tagName.toLowerCase();
      if (!label) return;

      window.gtag("event", "button_click", {
        button_label: label,
        page_path: window.location.pathname,
      });
    }

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, []);

  return null;
}
