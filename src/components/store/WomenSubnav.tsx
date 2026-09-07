"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WOMEN_SUBNAV } from "@/lib/categories";

/** "Choose by:" secondary nav for the Women section, matching the Wix site. */
export default function WomenSubnav() {
  const pathname = usePathname();

  return (
    <div className="bg-[#f5f5f5] border-b border-gray-200">
      <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-center gap-4 sm:gap-6 text-sm md:text-base">
        <span className="text-gray-500">Choose by:</span>
        {WOMEN_SUBNAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`font-medium transition-colors ${
                active ? "text-brand" : "text-gray-800 hover:text-brand"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
