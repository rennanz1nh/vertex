"use client";

import { usePathname } from "next/navigation";

// Used for anything that's a distraction (or, on mobile, a literal obstruction) once
// someone is in the booking flow (Your Trip → Driver Info → Review → Agreement):
// - The Special Offers rail nudges visitors toward OTHER vehicles — fine while browsing
//   the catalog, but pulls them away from finishing the trip they already chose.
// - The floating chat widget is fixed to the bottom of the viewport, which on a mobile
//   Driver Info form (long, single-column) ends up sitting directly on top of whichever
//   field happens to scroll into that position, blocking it.
export default function HideOnCheckoutFlow({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inBookingFlow = pathname === "/cart" || pathname.startsWith("/checkout");
  if (inBookingFlow) return null;
  return <>{children}</>;
}
