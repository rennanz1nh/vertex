"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import SearchBox from "./SearchBox";

const navItems = [
  {
    label: "Women",
    href: "/women",
    children: [
      { label: "Skin", href: "/women-skin" },
      { label: "Body", href: "/women-body" },
      { label: "Hair", href: "/women-hair" },
      { label: "Professional", href: "/professional" },
    ],
  },
  { label: "Men", href: "/men" },
  {
    label: "Courses",
    href: "/courses",
    children: [
      { label: "Skin Courses", href: "/courses-skin" },
      { label: "E-books", href: "/ebooks" },
    ],
  },
  {
    label: "Sell with us",
    href: "/sell-with-us",
    children: [
      { label: "Sell with us", href: "/sell-with-us" },
      { label: "American (FDA)", href: "/american-fda" },
    ],
  },
  { label: "Clearance", href: "/clearance" },
];

export default function Navigation() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();

  function isActive(item: (typeof navItems)[number]) {
    if (pathname === item.href) return true;
    return item.children?.some((c) => pathname === c.href) ?? false;
  }

  return (
    <div>
      <nav className="flex items-center justify-center border-t border-gray-100">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <div
              key={item.label}
              className="relative group"
              onMouseEnter={() => item.children && setOpenMenu(item.label)}
              onMouseLeave={() => setOpenMenu(null)}
            >
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
                {item.children && <ChevronDown size={14} className="mt-0.5 ml-1" />}
              </Link>

              {item.children && openMenu === item.label && (
                <div className="absolute top-full left-0 bg-white border border-gray-100 shadow-lg rounded-sm min-w-[180px] z-50 py-1">
                  {item.children.map((child) => (
                    <Link
                      key={child.label}
                      href={child.href}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-brand transition-colors"
                      onClick={() => setOpenMenu(null)}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Search sits right after Clearance, same light-gray tone as the rest of
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
