"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, User, Menu, X } from "lucide-react";
import { getTripDraft } from "@/lib/tripDraft";
import Navigation, { navItems } from "./Navigation";
import LanguageSelector from "./LanguageSelector";
import SearchBox from "./SearchBox";

export default function Header() {
  const [cartCount, setCartCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const update = () => setCartCount(getTripDraft() ? 1 : 0);
    update();
    window.addEventListener("trip-draft-updated", update);
    return () => window.removeEventListener("trip-draft-updated", update);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-8">
        {/* Desktop: 3-column row (Search/Login · Logo · Cart/Lang/Reseller) */}
        <div className="hidden md:grid grid-cols-3 items-center pt-4 pb-1">
          {/* Left: Log In — Search now lives in the nav bar, after Clearance */}
          <div className="flex flex-col items-start gap-2 text-sm">
            {/* Plain <a>, not next/link: a client-side transition into /admin would carry
                this page's already-loaded gtag.js along with it, and GA4's history-based
                page tracking would then count every admin page visited afterward as store
                traffic. A full page load starts fresh with no analytics script at all,
                since the admin layout never renders SiteScripts. */}
            <a
              href="/admin"
              className="flex items-center gap-1.5 text-gray-700 hover:text-black transition-colors"
            >
              <User size={15} />
              <span>Log In</span>
            </a>
          </div>

          {/* Center: logo */}
          <Link href="/" className="flex items-center justify-center">
            <Image
              src="/images/store-logo.png"
              alt="Vertex Rental Cars"
              width={2000}
              height={1837}
              priority
              className="h-16 w-auto"
            />
          </Link>

          {/* Right: cart + language */}
          <div className="flex items-center justify-end gap-5">
            <Link href="/cart" className="relative flex items-center gap-1.5 text-gray-700 hover:text-black">
              <ShoppingCart size={19} />
              <span className="text-sm">{cartCount}</span>
            </Link>
            <LanguageSelector />
          </div>
        </div>

        {/* Desktop Navigation (centered below logo) */}
        <div className="hidden md:block">
          <Navigation />
        </div>

        {/* Mobile row */}
        <div className="md:hidden flex items-center justify-between py-3">
          <button className="p-1" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/Small.png" alt="" className="h-7 w-7" />
            <span className="font-display text-lg font-normal tracking-wide text-black">
              Vertex Rental Cars
            </span>
          </Link>

          <Link href="/cart" className="relative">
            <ShoppingCart size={20} className="text-gray-700" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-brand text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4">
          <div className="mb-4">
            <SearchBox mobile />
          </div>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <MobileNavLink key={item.label} href={item.href} label={item.label} onClick={() => setMobileMenuOpen(false)} />
            ))}
          </nav>
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-2 text-sm">
            {/* Plain <a>, not next/link — see the desktop Log In link above for why. */}
            <a href="/admin" className="flex items-center gap-2 text-gray-700" onClick={() => setMobileMenuOpen(false)}>
              <User size={16} /> Log In
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

function MobileNavLink({ href, label, onClick }: { href: string; label: string; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="py-2.5 px-2 text-sm font-medium text-gray-800 border-b border-gray-100 hover:text-black"
    >
      {label}
    </Link>
  );
}
