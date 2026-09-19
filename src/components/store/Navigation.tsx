"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import SearchBox from "./SearchBox";

// Shared with the mobile hamburger menu (Header.tsx) so both stay in sync.
export const navItems = [
  { label: "All Vehicles", href: "/products" },
  { label: "Compact", href: "/products?category=compact" },
  { label: "Big Van", href: "/products?category=big-van" },
  { label: "Luxe", href: "/products?category=luxe" },
  { label: "Sport", href: "/products?category=sport" },
  { label: "Special Offers", href: "/clearance" },
];

export default function Navigation() {
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();

  // Query-string variants (?category=…) aren't distinguished here — usePathname alone
  // can't see them, and useSearchParams would force this bar into a Suspense boundary.
  // "All Vehicles" lights up for any /products URL; the class links just navigate.
  function isActive(item: (typeof navItems)[number]) {
    return pathname === item.href.split("?")[0] && !item.href.includes("?");
  }

  return (
    <div>
      <nav className="flex items-center justify-center border-t border-gray-100">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <div key={item.label} className="relative group">
              <Link
                href={item.href}
                className={`flex items-center px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  active ? "text-brand" : "text-gray-800 group-hover:text-brand"
                }`}
              >
                {/* dot that appears on hover / when active (matches Wix "•") */}
                <span
                  className={`text-brand transition-opacity duration-200 ${
                    active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}
                >
                  •
                </span>
                <span className="ml-1">{item.label}</span>
              </Link>
            </div>
          );
        })}

        {/* Search sits right after Special Offers, same light-gray tone as the rest of
            the row (a bit lighter than the nav text) — clicking it toggles the
            centered search bar below the whole menu. */}
        <button
          onClick={() => setSearchOpen((o) => !o)}
          aria-label="Search"
          aria-expanded={searchOpen}
          className="flex items-center px-4 py-3 text-gray-500 hover:text-brand transition-colors"
        >
          <Search size={16} />
        </button>
      </nav>

      {searchOpen && (
        <div className="flex justify-center py-3 border-t border-gray-100">
          <SearchBox variant="bar" open={searchOpen} onOpenChange={setSearchOpen} />
        </div>
      )}
    </div>
  );
}
