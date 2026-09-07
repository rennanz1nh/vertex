"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SESSION_FLAG = "cm_visit_tracked";

// Fires one "new visit" push notification per browser session (not per page view),
// on the first store page the visitor lands on.
export function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_FLAG)) return;
    sessionStorage.setItem(SESSION_FLAG, "1");

    fetch("/api/track/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {});
    // Only ever runs once per session (guarded by the flag above), so it's fine
    // that this effect doesn't re-run on subsequent client-side navigations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
