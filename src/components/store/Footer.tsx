import Link from "next/link";
import FooterSearch from "./FooterSearch";
import FooterNewsletter from "./FooterNewsletter";
import { VERTEX_BRAND_GRADIENT } from "@/lib/brand-gradient";

export default function Footer() {
  return (
    <footer
      className="bg-[#f5f5f5] border-t border-gray-200 mt-16"
      style={{ backgroundImage: VERTEX_BRAND_GRADIENT }}
    >
      <div className="max-w-[1600px] mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Col 1: Brand */}
          <div className="flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-2 font-display text-lg font-normal text-gray-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/Small.png" alt="" className="h-7 w-7 shrink-0" />
              Vertex Rental Cars
            </Link>
            <div className="flex items-center gap-3">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-gray-600 hover:text-black transition-colors">
                <FacebookIcon />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-gray-600 hover:text-black transition-colors">
                <InstagramIcon />
              </a>
              <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="text-gray-600 hover:text-black transition-colors">
                <TikTokIcon />
              </a>
            </div>
            <div className="mt-2">
              <FooterSearch />
            </div>
          </div>

          {/* Col 2: Vehicles */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Vehicles</h4>
            <ul className="space-y-1.5 text-sm text-gray-600">
              <li><Link href="/products" className="font-semibold text-gray-900 hover:underline">All Vehicles</Link></li>
              <li><Link href="/products?category=compact" className="hover:underline">Compact</Link></li>
              <li><Link href="/products?category=big-van" className="hover:underline">Big Van</Link></li>
              <li><Link href="/products?category=luxe" className="hover:underline">Luxe</Link></li>
              <li><Link href="/products?category=sport" className="hover:underline">Sport</Link></li>
              <li><Link href="/clearance" className="font-semibold text-gray-900 hover:underline">Special Offers</Link></li>
              <li><Link href="/contact-us" className="font-semibold text-gray-900 hover:underline">Contact Us</Link></li>
            </ul>
          </div>

          {/* Col 3: Contact */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Contact</h4>
            <ul className="space-y-1 text-sm text-gray-600 mb-5">
              <li>Orlando USA</li>
            </ul>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Policies</h4>
            <ul className="space-y-1.5 text-sm text-gray-600">
              <li><Link href="/terms" className="hover:underline">Terms &amp; Conditions</Link></li>
              <li><Link href="/privacy" className="hover:underline">Privacy Policy</Link></li>
              <li><Link href="/refund-policy" className="hover:underline">Refund Policy</Link></li>
            </ul>
          </div>

          {/* Col 4: Newsletter */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Newsletter</h4>
            <p className="text-xs text-gray-600 mb-4">
              Subscribe to our newsletter for exclusive rental deals and new fleet updates
            </p>
            <FooterNewsletter />
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-200 px-4 py-5">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <Link href="/terms" className="hover:underline">Terms &amp; Conditions</Link>
              <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
              <Link href="/accessibility" className="hover:underline">Accessibility Statement</Link>
            </div>
            <p>© {new Date().getFullYear()} Vertex Rental Cars</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.79a8.18 8.18 0 004.78 1.54V6.88a4.85 4.85 0 01-1.01-.19z" />
    </svg>
  );
}
