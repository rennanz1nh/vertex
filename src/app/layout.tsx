import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { getSiteSettings } from "@/lib/site-settings";
import { resolveSiteUrl } from "@/lib/seo";

const montserratArabic = localFont({
  variable: "--font-display",
  display: "swap",
  src: [
    { path: "../fonts/montserrat-arabic/Thin.ttf", weight: "100", style: "normal" },
    { path: "../fonts/montserrat-arabic/ExtraLight.ttf", weight: "200", style: "normal" },
    { path: "../fonts/montserrat-arabic/Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/montserrat-arabic/Medium.ttf", weight: "500", style: "normal" },
    { path: "../fonts/montserrat-arabic/SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../fonts/montserrat-arabic/Bold.ttf", weight: "700", style: "normal" },
    { path: "../fonts/montserrat-arabic/ExtraBold.ttf", weight: "800", style: "normal" },
    { path: "../fonts/montserrat-arabic/Black.ttf", weight: "900", style: "normal" },
  ],
});

const isProd = !!process.env.VERCEL;
const isProdDomain = process.env.VERCEL_ENV === "production";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const siteUrl = resolveSiteUrl(settings);
  const siteName = settings?.site_name || "Vertex Rental Cars";

  // Domain-verification tokens (Search Console + Meta) go into <head> as meta tags.
  const verification: Metadata["verification"] = {};
  if (settings?.google_site_verification) verification.google = settings.google_site_verification;
  if (settings?.facebook_domain_verification) {
    verification.other = { "facebook-domain-verification": settings.facebook_domain_verification };
  }

  return {
    metadataBase: new URL(siteUrl),
    title: isProd ? settings?.default_title || siteName : "Localhost",
    description:
      settings?.default_description ||
      "Vertex Rental Cars — premium car rentals. Book your vehicle online with fast, reliable service.",
    keywords: "car rental, rent a car, vehicle rental, vertex rental cars",
    verification: isProd && (verification.google || verification.other) ? verification : undefined,
    icons: isProdDomain
      ? {
          icon: [
            { url: "/icons/favicon-yellow.ico" },
            { url: "/icons/icon-yellow.png", sizes: "512x512", type: "image/png" },
          ],
          apple: "/icons/apple-icon-yellow.png",
        }
      : {
          icon: [{ url: "/images/admin-logo.png", type: "image/png" }],
          apple: "/images/admin-logo.png",
        },
    // Controls the icon + title shown when a user taps "Add to Home Screen" on iOS.
    appleWebApp: isProd
      ? { title: siteName, capable: true, statusBarStyle: "default" }
      : undefined,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={montserratArabic.variable}>
      <body className="min-h-screen flex flex-col bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
