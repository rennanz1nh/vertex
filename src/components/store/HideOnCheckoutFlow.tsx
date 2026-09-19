"use client";

import { usePathname } from "next/navigation";

// The Special Offers rail nudges visitors toward OTHER vehicles — useful browsing the
// catalog, but once someone has picked a car and is in the booking flow (Your Trip →
// Driver Info → Review → Agreement) it's a distraction pulling them away from finishing
// the trip they already chose, not an upsell.
export default function HideOnCheckoutFlow({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inBookingFlow = pathname === "/cart" || pathname.startsWith("/checkout");
  if (inBookingFlow) return null;
  return <>{children}</>;
}
